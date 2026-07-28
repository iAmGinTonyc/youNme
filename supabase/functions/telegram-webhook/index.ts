// Receives updates from Telegram (set via setWebhook): /start and /app.
//
// Stars-based payment handling (pre_checkout_query / successful_payment)
// used to live here — removed along with the rest of the Stars mechanic
// (see client/index.ts and master/index.ts) now that deposits are just
// recorded data pending a real payment provider (ЮKassa) integration.
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

interface SentMessage {
  message_id: number;
}

async function sendMessage(chatId: number, text: string, appUrl?: string): Promise<SentMessage | undefined> {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (appUrl) {
    body.reply_markup = {
      inline_keyboard: [[{ text: "Открыть приложение", web_app: { url: appUrl } }]],
    };
  }
  return await callTelegramApi<SentMessage>(BOT_TOKEN, "sendMessage", body).catch(() => undefined);
}

async function pinMessage(chatId: number, messageId: number) {
  await callTelegramApi(BOT_TOKEN, "pinChatMessage", {
    chat_id: chatId,
    message_id: messageId,
    disable_notification: true,
  }).catch(() => {});
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  if (WEBHOOK_SECRET) {
    const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (incomingSecret !== WEBHOOK_SECRET) return json({ error: "forbidden" }, 403);
  }

  const update = await req.json().catch(() => null);
  const message = update?.message;

  if (message?.text?.startsWith("/start")) {
    const param = message.text.slice("/start".length).trim();

    if (param.startsWith("slot_")) {
      // Deep link from a master's shared private-slot link
      // (t.me/<bot>?start=slot_<id>): only reachable this way, never
      // listed in the public feed. Look it up fresh rather than
      // trusting the id blindly — it may be gone by the time someone
      // taps the link.
      const slotId = param.slice("slot_".length);
      const { data: slot } = await supabase.from("slots").select("id, status").eq("id", slotId).maybeSingle();
      if (slot && slot.status === "open" && MINI_APP_URL) {
        await sendMessage(message.chat.id, "Вам предложили запись — откройте, чтобы посмотреть детали.", `${MINI_APP_URL}?slot=${slotId}`);
      } else {
        await sendMessage(message.chat.id, "Эта запись больше недоступна.");
      }
      return json({ ok: true });
    }

    const greeting = MINI_APP_URL
      ? "Привет! Нажми на кнопку ниже, чтобы открыть приложение."
      : "Привет! Приложение скоро будет доступно.";
    const sent = await sendMessage(message.chat.id, greeting, MINI_APP_URL);
    if (sent) await pinMessage(message.chat.id, sent.message_id);
    return json({ ok: true });
  }

  if (message?.text === "/app") {
    await sendMessage(message.chat.id, "Открыть приложение:", MINI_APP_URL);
  }

  return json({ ok: true });
});
