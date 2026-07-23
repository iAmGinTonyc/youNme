// Receives updates from Telegram (set via setWebhook). For now it only
// answers /start with a button that opens the Mini App. Notifications
// triggered by bookings/cancellations are a separate concern — add them
// as their own function called from the master/client functions once
// the notification copy is decided, rather than growing this file.
import { handleOptions, json } from "../_shared/http.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
const MINI_APP_URL = Deno.env.get("MINI_APP_URL");

async function sendMessage(chatId: number, text: string) {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (MINI_APP_URL) {
    body.reply_markup = {
      inline_keyboard: [[{ text: "Открыть приложение", web_app: { url: MINI_APP_URL } }]],
    };
  }
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
  if (message?.text === "/start") {
    const greeting = MINI_APP_URL
      ? "Привет! Нажми на кнопку ниже, чтобы открыть приложение."
      : "Привет! Приложение скоро будет доступно.";
    await sendMessage(message.chat.id, greeting);
  }

  return json({ ok: true });
});
