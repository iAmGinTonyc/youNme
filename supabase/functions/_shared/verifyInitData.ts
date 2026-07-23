// Validates Telegram Mini App initData per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// This is the only source of trusted identity in the whole app: anything
// the client claims about who it is must come out of this check, never
// out of a request body field.

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

async function hmacSha256(key: BufferSource, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyInitData(
  initData: string,
  botToken: string,
): Promise<TelegramUser | null> {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const authDate = params.get("auth_date");
  if (!authDate) return null;
  const age = Date.now() / 1000 - Number(authDate);
  if (!Number.isFinite(age) || age > MAX_AUTH_AGE_SECONDS || age < -60) return null;

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = await hmacSha256(new TextEncoder().encode("WebAppData"), botToken);
  const computedHash = toHex(await hmacSha256(secretKey, dataCheckString));

  if (computedHash !== hash) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;

  try {
    return JSON.parse(userRaw) as TelegramUser;
  } catch {
    return null;
  }
}
