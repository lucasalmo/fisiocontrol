/**
 * Stateless session token: `<expiresAtMs>.<hmac-sha256 hex>`.
 * Uses Web Crypto only, so it runs in the proxy and in Server Components.
 */

export const SESSION_COOKIE = "fc_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`fisiocontrol:${message}`));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two strings. */
export function safeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  return `${expiresAt}.${await hmacHex(secret, String(expiresAt))}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || !/^\d+$/.test(expires)) return false;
  if (Number(expires) < now) return false;
  return safeEqual(signature, await hmacHex(secret, expires));
}

export type AuthMode =
  | { mode: "enabled"; password: string; secret: string }
  | { mode: "disabled-dev" }
  | { mode: "misconfigured" };

/**
 * Authentication is mandatory in production. In development, when APP_PASSWORD
 * is not set, access is allowed so the app can be used locally.
 */
export function authMode(): AuthMode {
  const password = process.env.APP_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (password && secret && secret.length >= 32) return { mode: "enabled", password, secret };
  if (!password && process.env.NODE_ENV !== "production") return { mode: "disabled-dev" };
  return { mode: "misconfigured" };
}
