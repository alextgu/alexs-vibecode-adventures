import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
 * that grant SELECT to the `anon` role (e.g. `public_daily_logs`).
 */
export function getPublicSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
