"use server";

import {
  isAdminRequest,
  getServiceSupabase,
  getPublicSupabase,
} from "@/lib/supabase";
import { TIMEZONE } from "@/lib/config";
import { todayInTz } from "@/lib/dates";

export type DailyGoal = {
  id: string;
  title: string;
  note: string | null;
  position: number;
  /** Whether this goal was completed on the date we asked about. */
  completed: boolean;
};

export type Result = { ok: true } | { ok: false; error: string };

const MAX_TITLE = 200;
const MAX_NOTE = 500;

async function requireAdmin(): Promise<Result | null> {
  if (!(await isAdminRequest())) {
    return { ok: false, error: "Locked. Enter the password to edit." };
  }
  return null;
}

/**
 * List daily goals with a flag for whether they've been done on `date`.
 * Defaults to today. Pass an ISO date to look up any other day.
 */
export async function listDailyGoals(date?: string): Promise<DailyGoal[]> {
  const targetDate = date ?? todayInTz(TIMEZONE);
  const supabase = getPublicSupabase();
  const [{ data: goals }, { data: completions }] = await Promise.all([
    supabase
      .from("daily_goals")
      .select("id, title, note, position")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("daily_goal_completions")
      .select("daily_goal_id")
      .eq("date", targetDate),
  ]);

  const done = new Set<string>();
  for (const c of (completions ?? []) as { daily_goal_id: string }[]) {
    done.add(c.daily_goal_id);
  }

  return ((goals ?? []) as Omit<DailyGoal, "completed">[]).map((g) => ({
    ...g,
    completed: done.has(g.id),
  }));
}

export async function createDailyGoal(input: {
  title: string;
  note?: string;
}): Promise<Result> {
  const gate = await requireAdmin();
  if (gate) return gate;
  const svc = getServiceSupabase();

  const title = (input.title ?? "").trim().slice(0, MAX_TITLE);
  if (title.length === 0) return { ok: false, error: "Title required." };
  const note =
    typeof input.note === "string" && input.note.trim().length > 0
      ? input.note.trim().slice(0, MAX_NOTE)
      : null;

  const { data: last } = await svc
    .from("daily_goals")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { error } = await svc
    .from("daily_goals")
    .insert({ title, note, position });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateDailyGoal(
  id: string,
  input: { title?: string; note?: string | null },
): Promise<Result> {
  const gate = await requireAdmin();
  if (gate) return gate;
  const svc = getServiceSupabase();

  const patch: Record<string, unknown> = {};
  if (typeof input.title === "string") {
    const t = input.title.trim().slice(0, MAX_TITLE);
    if (t.length === 0) return { ok: false, error: "Title required." };
    patch.title = t;
  }
  if (input.note === null) {
    patch.note = null;
  } else if (typeof input.note === "string") {
    const n = input.note.trim();
    patch.note = n.length === 0 ? null : n.slice(0, MAX_NOTE);
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await svc.from("daily_goals").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteDailyGoal(id: string): Promise<Result> {
  const gate = await requireAdmin();
  if (gate) return gate;
  const svc = getServiceSupabase();

  const { error } = await svc.from("daily_goals").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Check or uncheck a daily goal for TODAY. Past days are read-only. */
export async function toggleDailyGoalToday(id: string): Promise<Result> {
  const gate = await requireAdmin();
  if (gate) return gate;
  const svc = getServiceSupabase();

  const date = todayInTz(TIMEZONE);
  const { data: existing } = await svc
    .from("daily_goal_completions")
    .select("id")
    .eq("daily_goal_id", id)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    const { error } = await svc
      .from("daily_goal_completions")
      .delete()
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await svc
    .from("daily_goal_completions")
    .insert({ daily_goal_id: id, date });
  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
