"use server";

import { getAuthedSupabase } from "@/lib/supabase";
import { isValidTimezone } from "@/lib/dates";

export type Result = { ok: true } | { ok: false; error: string };

export async function getTimezone(): Promise<string> {
  const ctx = await getAuthedSupabase();
  if (!ctx) return "UTC";

  const { data } = await ctx.client
    .from("user_profiles")
    .select("timezone")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  return (data?.timezone as string) ?? "UTC";
}

export async function setTimezone(tz: string): Promise<Result> {
  const ctx = await getAuthedSupabase();
  if (!ctx) return { ok: false, error: "Not authenticated." };

  if (!isValidTimezone(tz)) {
    return { ok: false, error: "Invalid IANA timezone." };
  }

  const { error } = await ctx.client
    .from("user_profiles")
    .upsert(
      { user_id: ctx.userId, timezone: tz },
      { onConflict: "user_id" },
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
