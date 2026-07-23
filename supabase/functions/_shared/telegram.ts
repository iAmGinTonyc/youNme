// Thin wrapper around the Telegram Bot API for calls made from edge
// functions (as opposed to _shared/verifyInitData.ts, which only
// validates Mini App initData). Throws on any non-ok response so
// callers don't have to remember to check `.ok` themselves.
export async function callTelegramApi<T = unknown>(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`telegram_api_error:${method}:${data.description ?? res.status}`);
  }
  return data.result as T;
}
