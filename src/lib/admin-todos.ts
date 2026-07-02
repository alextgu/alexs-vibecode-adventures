"use server";

import {
  isAdminRequest,
  getServiceSupabase,
  getPublicSupabase,
} from "@/lib/supabase";
import { TIMEZONE } from "@/lib/config";
import { todayInTz } from "@/lib/dates";

export type AdminTodo = {
  id: string;
  title: string;
  note: string | null;
  target_date: string | null;
  completed_on: string | null;
  position: number;
};

export type Result = { ok: true } | { ok: false; error: string };

// Keep it tight — the list lives below the calendar and gets crowded fast.
const MAX_TITLE = 80;
const MAX_NOTE = 500;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(input: unknown): string | null | undefined {
  if (input === null) return null;
  if (typeof input !== "string") return undefined;
  const t = input.trim();
  if (t.length === 0) return null;
  if (!DATE_RE.test(t)) return undefined;
  return t;
}

async function requireAdmin(): Promise<Result | null> {
  if (!(await isAdminRequest())) {
    return { ok: false, error: "Locked. Enter the password to edit." };
  }
  return null;
}

export async function listAdminTodos(): Promise<AdminTodo[]> {
  const supabase = getPublicSupabase();
  const { data } = await supabase
    .from("admin_todos")
    .select("id, title, note, target_date, completed_on, position")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as AdminTodo[];
}

export async function createAdminTodo(input: {
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
    return { ok: false, error: "Date must be YYYY-MM-DD." };
  }

  const { data: last } = await svc
    .from("admin_todos")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { error } = await svc
    .from("admin_todos")
    .insert({ title, note, target_date, position });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateAdminTodo(
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
      return { ok: false, error: "Date must be YYYY-MM-DD." };
    }
    patch.target_date = d;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await svc.from("admin_todos").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function toggleAdminTodo(id: string): Promise<Result> {
  const gate = await requireAdmin();
  if (gate) return gate;
  const svc = getServiceSupabase();

  const { data: row } = await svc
    .from("admin_todos")
    .select("completed_on")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Todo not found." };

  const next = row.completed_on ? null : await todayInTz(TIMEZONE);
  const { error } = await svc
    .from("admin_todos")
    .update({ completed_on: next })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteAdminTodo(id: string): Promise<Result> {
  const gate = await requireAdmin();
  if (gate) return gate;
  const svc = getServiceSupabase();

  const { error } = await svc.from("admin_todos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
