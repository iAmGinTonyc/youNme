// Receives updates from Telegram (set via setWebhook): /start, and the
// two payment events for Stars checkout. This is the only place a paid
// booking actually gets confirmed — never on the client's say-so.
//
// pre_checkout_query: Telegram asks "is this still valid?" before it
// charges anyone. We answer within the 10s window based on current slot
// state — this is the real race-prevention gate, since it runs before
// money moves.
//
// successful_payment: the charge already happened. We atomically claim
// the slot as a last-resort safety net (in case two pre-checkouts both
// got approved in a tight race); if the claim fails here, the user was
// already charged, so we refund rather than just erroring out.
//
// DEPLOY NOTE: Telegram calls this URL directly and never sends a
// Supabase Authorization header, so it must be deployed with
// --no-verify-jwt or every update (including pre_checkout_query) gets
// rejected 401 at the platform gateway before this code ever runs —
// Telegram then shows the user "the bot did not respond in time".
//   supabase functions deploy telegram-webhook --no-verify-jwt --project-ref <ref>
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleOptions, json } from "../_shared/http.ts";
import { callTelegramApi } from "../_shared/telegram.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
const MINI_APP_URL = Deno.env.get("MINI_APP_URL");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function sendMessage(chatId: number, text: string) {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (MINI_APP_URL) {
    body.reply_markup = {
      inline_keyboard: [[{ text: "Открыть приложение", web_app: { url: MINI_APP_URL } }]],
    };
  }
  await callTelegramApi(BOT_TOKEN, "sendMessage", body).catch(() => {});
}

function parseSlotId(invoicePayload: string | undefined): string | null {
  if (!invoicePayload?.startsWith("book:")) return null;
  return invoicePayload.slice("book:".length);
}

async function logEvent(
  fields: { slot_id?: string; booking_id?: string; actor_telegram_id: number; action: string; details?: unknown },
) {
  await supabase.from("events").insert({ ...fields, actor_role: "model" });
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (WEBHOOK_SECRET) {
    const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (incomingSecret !== WEBHOOK_SECRET) return json({ error: "forbidden" }, 403);
  }

  const update = await req.json().catch(() => null);

  const preCheckout = update?.pre_checkout_query;
  if (preCheckout) {
    const slotId = parseSlotId(preCheckout.invoice_payload);
    const { data: slot } = slotId
      ? await supabase.from("slots").select("status, is_paid, price_stars").eq("id", slotId).maybeSingle()
      : { data: null };

    const valid = Boolean(slot && slot.is_paid && slot.status === "open" && slot.price_stars === preCheckout.total_amount);
    await callTelegramApi(BOT_TOKEN, "answerPreCheckoutQuery", valid
      ? { pre_checkout_query_id: preCheckout.id, ok: true }
      : { pre_checkout_query_id: preCheckout.id, ok: false, error_message: "Этот слот больше недоступен." });
    return json({ ok: true });
  }

  const message = update?.message;
  const payment = message?.successful_payment;
  if (payment) {
    const slotId = parseSlotId(payment.invoice_payload);
    const payer = message.from;
    const chargeId = payment.telegram_payment_charge_id as string;

    const claimed = slotId
      ? await supabase.from("slots").update({ status: "booked" }).eq("id", slotId).eq("status", "open").select().maybeSingle()
      : { data: null };

    if (!claimed.data) {
      await callTelegramApi(BOT_TOKEN, "refundStarPayment", {
        user_id: payer.id,
        telegram_payment_charge_id: chargeId,
      }).catch(() => {});
      await sendMessage(message.chat.id, "Слот только что забронировали — звёзды возвращены.");
      await logEvent({ slot_id: slotId ?? undefined, actor_telegram_id: payer.id, action: "payment_refunded_race" });
      return json({ ok: true });
    }

    const { data: booking } = await supabase
      .from("bookings")
      .insert({
        slot_id: slotId,
        model_telegram_id: payer.id,
        model_name: [payer.first_name, payer.last_name].filter(Boolean).join(" ") || payer.username,
        telegram_payment_charge_id: chargeId,
      })
      .select()
      .single();

    await logEvent({
      slot_id: slotId ?? undefined,
      booking_id: booking?.id,
      actor_telegram_id: payer.id,
      action: "booking_paid",
      details: { amount: payment.total_amount },
    });
    await sendMessage(message.chat.id, "Оплата прошла, бронь подтверждена ✅");
    return json({ ok: true });
  }

  if (message?.text === "/start") {
    const greeting = MINI_APP_URL
      ? "Привет! Нажми на кнопку ниже, чтобы открыть приложение."
      : "Привет! Приложение скоро будет доступно.";
    await sendMessage(message.chat.id, greeting);
  }

  return json({ ok: true });
});
