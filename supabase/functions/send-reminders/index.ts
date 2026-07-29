// Sends a one-time reminder to both the model and the master 3 hours
// before a confirmed booking's session starts. Triggered periodically by
// a pg_cron job (see supabase/migrations/0009_reminder_cron.sql), not by
// a user action — so it authenticates via a shared secret header instead
// of Telegram initData, and must be deployed with --no-verify-jwt (same
// reason as telegram-webhook: the caller here is Postgres, not our own
// frontend, so it never sends a Supabase Authorization header either).
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleOptions, json } from "../_shared/http.ts";
import { callTelegramApi } from "../_shared/telegram.ts";
import { formatRuDateTime } from "../_shared/formatDate.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const REMINDER_LEAD_MS = 3 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (CRON_SECRET) {
    const incomingSecret = req.headers.get("x-cron-secret");
    if (incomingSecret !== CRON_SECRET) return json({ error: "forbidden" }, 403);
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() + REMINDER_LEAD_MS);

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, model_telegram_id, model_name, slots!inner(starts_at, master_id)")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gt("slots.starts_at", now.toISOString())
    .lte("slots.starts_at", cutoff.toISOString());
  if (error) return json({ error: error.message }, 500);
  if (!bookings || bookings.length === 0) return json({ ok: true, sent: 0 });

  const masterIds = [...new Set(bookings.map((b) => (b.slots as unknown as { master_id: number }).master_id))];
  const { data: masters } = await supabase.from("masters").select("telegram_id, name").in("telegram_id", masterIds);
  const masterNameById = new Map((masters ?? []).map((m) => [m.telegram_id, m.name as string | null]));

  let sent = 0;
  for (const booking of bookings) {
    const slot = booking.slots as unknown as { starts_at: string; master_id: number };
    const when = formatRuDateTime(slot.starts_at);
    const masterName = masterNameById.get(slot.master_id) ?? "";

    await callTelegramApi(BOT_TOKEN, "sendMessage", {
      chat_id: booking.model_telegram_id,
      text: `Напоминаем о сеансе у мастера ${masterName} на ${when}`,
    }).catch(() => {});

    await callTelegramApi(BOT_TOKEN, "sendMessage", {
      chat_id: slot.master_id,
      text: `Напоминаем о сеансе с моделью ${booking.model_name ?? ""} на ${when}`,
    }).catch(() => {});

    await supabase.from("bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", booking.id);
    sent++;
  }

  return json({ ok: true, sent });
});
