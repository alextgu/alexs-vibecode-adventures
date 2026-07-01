import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

export const ADMIN_COOKIE = "hard75_admin";
const TOKEN_VERSION = "v1";

export function getPublicSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getServiceSupabase(): SupabaseClient {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * The cookie stores a token, not the password. Token is:
 *   HMAC-SHA256(secret=ADMIN_PASSWORD, msg=`${version}:${salt}`)
 * concatenated as `${version}.${salt}.${hmacHex}`. The salt lets us
 * invalidate old sessions later by bumping TOKEN_VERSION or the salt
 * without changing the password. Verifying only needs the password.
 */
export function signAdminToken(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD not set");
  const salt = "static"; // stable per version; regenerable later
  const msg = `${TOKEN_VERSION}:${salt}`;
  const mac = createHmac("sha256", password).update(msg).digest("hex");
  return `${TOKEN_VERSION}.${salt}.${mac}`;
}

function verifyAdminToken(token: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, salt, providedMac] = parts;
  if (version !== TOKEN_VERSION) return false;
  const expected = createHmac("sha256", password)
    .update(`${version}:${salt}`)
    .digest("hex");
  const a = Buffer.from(providedMac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return nodeTimingSafeEqual(a, b);
}

export async function isAdminRequest(): Promise<boolean> {
  const jar = await cookies();
  const val = jar.get(ADMIN_COOKIE)?.value;
  if (!val) return false;
  return verifyAdminToken(val);
}

// ---------------------------------------------------------------------------
// Rate limiting for /unlock — per-IP, in-memory. Resets on cold start; fine
// for our scale. Prevents dumb brute-force from a single IP.
// ---------------------------------------------------------------------------

const UNLOCK_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const UNLOCK_MAX_ATTEMPTS = 5;
const unlockAttempts = new Map<string, { count: number; resetAt: number }>();

async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function checkUnlockRate(): Promise<
  { ok: true; remaining: number } | { ok: false; retryAfterMs: number }
> {
  const ip = await getClientIp();
  const now = Date.now();
  const entry = unlockAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    unlockAttempts.set(ip, { count: 0, resetAt: now + UNLOCK_WINDOW_MS });
    return { ok: true, remaining: UNLOCK_MAX_ATTEMPTS };
  }
  if (entry.count >= UNLOCK_MAX_ATTEMPTS) {
    return { ok: false, retryAfterMs: entry.resetAt - now };
  }
  return { ok: true, remaining: UNLOCK_MAX_ATTEMPTS - entry.count };
}

export async function noteUnlockFailure(): Promise<void> {
  const ip = await getClientIp();
  const now = Date.now();
  const entry = unlockAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    unlockAttempts.set(ip, { count: 1, resetAt: now + UNLOCK_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export async function clearUnlockAttempts(): Promise<void> {
  const ip = await getClientIp();
  unlockAttempts.delete(ip);
}
