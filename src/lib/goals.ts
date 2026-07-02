"use server";

import {
  isAdminRequest,
  getServiceSupabase,
  getPublicSupabase,
} from "@/lib/supabase";

export type Goal = {
  id: string;
  title: string;
  note: string | null;
  target_date: string | null;
  completed_at: string | null;
  position: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(input: unknown): string | null | undefined {
  if (input === null) return null;
  if (typeof input !== "string") return undefined;
  const t = input.trim();
  if (t.length === 0) return null;
  if (!DATE_RE.test(t)) return undefined;
  return t;
}

export type Result = { ok: true } | { ok: false; error: string };

const MAX_TITLE = 200;
const MAX_NOTE = 1000;

async function requireAdmin(): Promise<Result | null> {
  if (!(await isAdminRequest())) {
    return { ok: false, error: "Locked. Enter the password to edit." };
  }
  return null;
}

export async function listGoals(): Promise<Goal[]> {
  const supabase = getPublicSupabase();
  const { data } = await supabase
    .from("goals")
    .select("id, title, note, target_date, completed_at, position")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as Goal[];
}

export async function createGoal(input: {
  title: string;
  note?: string;
  target_date?: string | null;
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
  const target_date = normalizeDate(input.target_date ?? null);
  if (target_date === undefined) {
    return { ok: false, error: "Target date must be YYYY-MM-DD." };
  }

  // Place at end.
  const { data: last } = await svc
    .from("goals")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { error } = await svc
    .from("goals")
    .insert({ title, note, target_date, position });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateGoal(
  id: string,
  input: {
    title?: string;
    note?: string | null;
    target_date?: string | null;
  },
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
  if (input.target_date !== undefined) {
    const d = normalizeDate(input.target_date);
    if (d === undefined) {
      return { ok: false, error: "Target date must be YYYY-MM-DD." };
    }
    patch.target_date = d;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await svc.from("goals").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function toggleGoalCompleted(id: string): Promise<Result> {
  const gate = await requireAdmin();
  if (gate) return gate;
  const svc = getServiceSupabase();

  const { data: row } = await svc
    .from("goals")
    .select("completed_at")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Goal not found." };

  const next = row.completed_at ? null : new Date().toISOString();
  const { error } = await svc
    .from("goals")
    .update({ completed_at: next })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteGoal(id: string): Promise<Result> {
  const gate = await requireAdmin();
  if (gate) return gate;
  const svc = getServiceSupabase();

  const { error } = await svc.from("goals").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
