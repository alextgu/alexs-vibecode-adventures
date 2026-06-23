"use server";

import { getAuthedSupabase, getPublicSupabase } from "@/lib/supabase";

export type DailyLogInput = {
  date: string;
  day_score: number;
  calories: number;
  protein_g: number;
  journal_submitted: boolean;
  completed_habits: string[];
};

export type PublicLog = {
  date: string;
  day_score: number;
  completed_habits: string[];
};

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseInput(raw: unknown): DailyLogInput | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Invalid payload." };
  const r = raw as Record<string, unknown>;

  const date = typeof r.date === "string" ? r.date.trim() : "";
  if (!ISO_DATE.test(date)) return { error: "date must be YYYY-MM-DD." };

  const day_score = Number(r.day_score);
  if (!Number.isInteger(day_score) || day_score < 1 || day_score > 10) {
    return { error: "day_score must be an integer 1–10." };
  }

  const calories = Number(r.calories);
  if (!Number.isInteger(calories) || calories < 0) {
    return { error: "calories must be a non-negative integer." };
  }

  const protein_g = Number(r.protein_g);
  if (!Number.isInteger(protein_g) || protein_g < 0) {
    return { error: "protein_g must be a non-negative integer." };
  }

  const journal_submitted = r.journal_submitted === true;

  const rawHabits = Array.isArray(r.completed_habits) ? r.completed_habits : [];
  const completed_habits = rawHabits
    .filter((h): h is string => typeof h === "string")
    .map((h) => h.trim())
    .filter((h) => h.length > 0 && h.length <= 200);

  return {
    date,
    day_score,
    calories,
    protein_g,
    journal_submitted,
    completed_habits,
  };
}

/**
 * Upserts a daily log for the current Clerk user.
 * Server-side only: gates on Clerk session, then writes through an
 * RLS-bound Supabase client so the database is the final source of truth.
 */
export async function saveDailyLog(raw: unknown): Promise<SaveResult> {
  const ctx = await getAuthedSupabase();
  if (!ctx) return { ok: false, error: "Not authenticated." };

  const parsed = parseInput(raw);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const { data, error } = await ctx.client
    .from("daily_logs")
    .upsert(
      { user_id: ctx.userId, ...parsed },
      { onConflict: "user_id,date" },
    )
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Upsert failed." };
  }
  return { ok: true, id: data.id as string };
}

/**
 * Public read of a user's log history. Reads from the `public_daily_logs`
 * view, which by design excludes calories and protein_g. The mapping below
 * is defense-in-depth: even if the view ever leaks extra columns, only the
 * whitelisted fields reach the client.
 */
export async function getPublicLogs(userId: string): Promise<PublicLog[]> {
  if (typeof userId !== "string" || userId.length === 0 || userId.length > 64) {
    return [];
  }

  const supabase = getPublicSupabase();
  const { data, error } = await supabase
    .from("public_daily_logs")
    .select("date, day_score, completed_habits")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(365);

  if (error || !data) return [];

  return data.map((row: Record<string, unknown>) => ({
    date: String(row.date),
    day_score: Number(row.day_score),
    completed_habits: Array.isArray(row.completed_habits)
      ? (row.completed_habits as unknown[]).filter(
          (h): h is string => typeof h === "string",
        )
      : [],
  }));
}
