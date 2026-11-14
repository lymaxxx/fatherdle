import { createHash, createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "fatherdle_admin";
const SESSION_DAYS = 30;

// Fallback so the panel works out of the box. Set FATHERDLE_ADMIN_PASSWORD in Netlify to use
// your own password instead (it then takes precedence and this hash is ignored).
const DEFAULT_PASSWORD_HASH = "66032773a9f88ca749420b05ebd332f49186137636c3627ae2ec738011dd9766";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkAdminPassword(input: string): boolean {
  const envPassword = process.env.FATHERDLE_ADMIN_PASSWORD;
  if (envPassword) return safeEqual(sha256(input), sha256(envPassword));
  return safeEqual(sha256(`fatherdle-admin:${input}`), DEFAULT_PASSWORD_HASH);
}

function sessionSecret(): string {
  return (
    process.env.FATHERDLE_ADMIN_SECRET ||
    sha256(`session:${process.env.FATHERDLE_ADMIN_PASSWORD || DEFAULT_PASSWORD_HASH}`)
  );
}

const sign = (payload: string) => createHmac("sha256", sessionSecret()).update(payload).digest("hex");

export function createAdminToken(): { value: string; maxAgeSeconds: number } {
  const maxAgeSeconds = SESSION_DAYS * 24 * 60 * 60;
  const expires = Date.now() + maxAgeSeconds * 1000;
  return { value: `${expires}.${sign(String(expires))}`, maxAgeSeconds };
}

export function isValidAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature) return false;
  if (!safeEqual(signature, sign(expires))) return false;
  return Number(expires) > Date.now();
}
