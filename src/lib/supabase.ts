import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_EMAIL } from "@/lib/config";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

/**
 * Server-side Supabase client bound to the current Clerk session.
 * RLS policies on the base table run against `auth.jwt() ->> 'sub'`,
 * which equals the Clerk user_id under the native integration.
 *
 * Returns `null` when no user is signed in.
 */
export async function getAuthedSupabase(): Promise<{
  client: SupabaseClient;
  userId: string;
} | null> {
  const { userId, getToken } = await auth();
  if (!userId) return null;

  const token = await getToken();
  if (!token) return null;

  const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { client, userId };
}

/**
 * Anonymous Supabase client for public reads. Use only against tables/views
 * that grant SELECT to the `anon` role.
 */
export function getPublicSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Returns an authed Supabase client ONLY if the caller is signed in as the
 * admin (email matches ADMIN_EMAIL). Otherwise returns a reason.
 * Server actions call this before any write.
 */
export type AdminContext =
  | { ok: true; client: SupabaseClient; userId: string }
  | { ok: false; reason: "signed-out" | "not-admin" };

export async function getAdminSupabase(): Promise<AdminContext> {
  const { userId, getToken } = await auth();
  if (!userId) return { ok: false, reason: "signed-out" };

  const user = await currentUser();
  const email = user?.emailAddresses?.find(
    (e) => e.id === user?.primaryEmailAddressId,
  )?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;

  if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return { ok: false, reason: "not-admin" };
  }

  const token = await getToken();
  if (!token) return { ok: false, reason: "signed-out" };

  const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { ok: true, client, userId };
}

/** Returns 'admin' | 'not-admin' | 'signed-out' for the current session. */
export async function getSessionMode(): Promise<
  "admin" | "not-admin" | "signed-out"
> {
  const { userId } = await auth();
  if (!userId) return "signed-out";
  const user = await currentUser();
  const email = user?.emailAddresses?.find(
    (e) => e.id === user?.primaryEmailAddressId,
  )?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return "not-admin";
  }
  return "admin";
}
