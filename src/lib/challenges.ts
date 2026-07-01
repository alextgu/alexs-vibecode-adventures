"use server";

import { cookies } from "next/headers";
import {
  isAdminRequest,
  getServiceSupabase,
  getPublicSupabase,
  ADMIN_COOKIE,
} from "@/lib/supabase";
import {
  RULES,
  TARGET_DAYS,
  TIMEZONE,
  DIARY_RULE_ID,
  GOALS,
  type Rule,
  type Goal,
} from "@/lib/config";
import { todayInTz, addDays, daysBetween } from "@/lib/dates";

export type ChallengeRow = {
  id: string;
  target_days: number;
  start_date: string;
  status: "active" | "completed" | "failed";
  failed_on_date: string | null;
  completed_at: string | null;
  timezone: string;
};

export type DayData = {
  date: string;
  day_num: number | null;
  in_attempt: boolean;
  is_today: boolean;
  is_past: boolean;
  is_future: boolean;
  checked: string[];
  all_checked: boolean;
  failed: boolean;
  has_diary: boolean;
};

export type MonthCell = {
  date: string;
  day_of_month: number;
  in_month: boolean;
  day: DayData;
};

export type HomeData = {
  is_admin: boolean;
  today: string;
  timezone: string;
  target_days: number;
  rules: Rule[];
  goals: Goal[];
  attempt: (ChallengeRow & { current_day: number | null }) | null;
  history: {
    total: number;
    completed: number;
    failed: number;
    last_outcome:
      | null
      | { status: "completed"; date: string; target_days: number }
      | { status: "failed"; date: string; day: number };
  };
  month: {
    ym: string;
    label: string;
    cells: MonthCell[];
  };
  selected: DayData;
};

// ---------------------------------------------------------------------------
// Reads (public — anon)
// ---------------------------------------------------------------------------

async function loadActive(): Promise<ChallengeRow | null> {
  const supabase = getPublicSupabase();
  const { data } = await supabase
    .from("challenges")
    .select(
      "id, target_days, start_date, status, failed_on_date, completed_at, timezone",
    )
    .eq("status", "active")
    .maybeSingle();
  return (data as ChallengeRow | null) ?? null;
}

async function loadChecks(
  challengeId: string,
): Promise<Map<string, Set<string>>> {
  const supabase = getPublicSupabase();
  const { data } = await supabase
    .from("challenge_checks")
    .select("rule_id, date")
    .eq("challenge_id", challengeId);

  const map = new Map<string, Set<string>>();
  for (const c of (data ?? []) as { rule_id: string; date: string }[]) {
    let s = map.get(c.date);
    if (!s) {
      s = new Set();
      map.set(c.date, s);
    }
    s.add(c.rule_id);
  }
  return map;
}

async function loadDiaryDates(): Promise<Set<string>> {
  const supabase = getPublicSupabase();
  const { data } = await supabase
    .from("diary_entries")
    .select("date, content");
  const set = new Set<string>();
  for (const r of (data ?? []) as { date: string; content: string }[]) {
    if (r.content && r.content.trim().length > 0) set.add(r.date);
  }
  return set;
}

async function loadHistorySummary(): Promise<HomeData["history"]> {
  const supabase = getPublicSupabase();
  const { data } = await supabase
    .from("challenges")
    .select("status, target_days, start_date, failed_on_date, completed_at")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Array<{
    status: "active" | "completed" | "failed";
    target_days: number;
    start_date: string;
    failed_on_date: string | null;
    completed_at: string | null;
  }>;

  let completed = 0;
  let failed = 0;
  let last: HomeData["history"]["last_outcome"] = null;

  for (const r of rows) {
    if (r.status === "completed") {
      completed++;
      if (!last) {
        last = {
          status: "completed",
          date: (r.completed_at ?? "").slice(0, 10),
          target_days: r.target_days,
        };
      }
    } else if (r.status === "failed") {
      failed++;
      if (!last && r.failed_on_date) {
        last = {
          status: "failed",
          date: r.failed_on_date,
          day: daysBetween(r.start_date, r.failed_on_date) + 1,
        };
      }
    }
  }

  return { total: rows.length, completed, failed, last_outcome: last };
}

async function evaluateAttempt(
  attempt: ChallengeRow,
  checksByDate: Map<string, Set<string>>,
  ruleCount: number,
  today: string,
  canWrite: boolean,
): Promise<ChallengeRow> {
  const startDate = attempt.start_date;

  const walkEnd = Math.min(
    daysBetween(startDate, today) - 1,
    attempt.target_days - 2,
  );
  let failedOn: string | null = null;
  for (let i = 0; i <= walkEnd; i++) {
    const d = addDays(startDate, i);
    const count = checksByDate.get(d)?.size ?? 0;
    if (count < ruleCount) {
      failedOn = d;
      break;
    }
  }

  if (failedOn) {
    if (canWrite) {
      const svc = getServiceSupabase();
      await svc
        .from("challenges")
        .update({ status: "failed", failed_on_date: failedOn })
        .eq("id", attempt.id)
        .eq("status", "active");
    }
    return { ...attempt, status: "failed", failed_on_date: failedOn };
  }

  const todayCount = checksByDate.get(today)?.size ?? 0;
  const todayIsPast = daysBetween(startDate, today) >= attempt.target_days;
  const todayIsLastAndDone =
    daysBetween(startDate, today) === attempt.target_days - 1 &&
    todayCount === ruleCount;

  if (todayIsPast || todayIsLastAndDone) {
    const nowIso = new Date().toISOString();
    if (canWrite) {
      const svc = getServiceSupabase();
      await svc
        .from("challenges")
        .update({ status: "completed", completed_at: nowIso })
        .eq("id", attempt.id)
        .eq("status", "active");
    }
    return { ...attempt, status: "completed", completed_at: nowIso };
  }

  return attempt;
}

function buildDayData(
  date: string,
  attempt: ChallengeRow | null,
  checksByDate: Map<string, Set<string>>,
  diaryDates: Set<string>,
  today: string,
): DayData {
  const inAttempt =
    !!attempt &&
    daysBetween(attempt.start_date, date) >= 0 &&
    daysBetween(attempt.start_date, date) < attempt.target_days;

  const dayNum = inAttempt
    ? daysBetween(attempt!.start_date, date) + 1
    : null;

  const checked = Array.from(checksByDate.get(date) ?? []);
  const allChecked = inAttempt && checked.length === RULES.length;

  const failed =
    !!attempt &&
    attempt.status === "failed" &&
    attempt.failed_on_date === date;

  return {
    date,
    day_num: dayNum,
    in_attempt: inAttempt,
    is_today: date === today,
    is_past: date < today,
    is_future: date > today,
    checked,
    all_checked: allChecked,
    failed,
    has_diary: diaryDates.has(date),
  };
}

function buildMonthCells(
  ym: string,
  attempt: ChallengeRow | null,
  checksByDate: Map<string, Set<string>>,
  diaryDates: Set<string>,
  today: string,
): { cells: MonthCell[]; label: string } {
  const [yStr, mStr] = ym.split("-");
  const year = Number(yStr);
  const month = Number(mStr);

  const firstOfMonth = `${yStr}-${mStr}-01`;
  const firstDate = new Date(Date.UTC(year, month - 1, 1));
  const dow = firstDate.getUTCDay();

  const gridStart = addDays(firstOfMonth, -dow);
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    const [cy, cm, cd] = date.split("-").map(Number);
    const inMonth = cy === year && cm === month;
    cells.push({
      date,
      day_of_month: cd,
      in_month: inMonth,
      day: buildDayData(date, attempt, checksByDate, diaryDates, today),
    });
  }

  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  return { cells, label };
}

export async function getHomeData(input?: {
  ym?: string;
  d?: string;
}): Promise<HomeData> {
  const isAdmin = await isAdminRequest();
  const today = todayInTz(TIMEZONE);

  const rawAttempt = await loadActive();
  const checksByDate = rawAttempt
    ? await loadChecks(rawAttempt.id)
    : new Map<string, Set<string>>();
  // Only admin sees which days have diary entries. Non-admin gets an empty set,
  // which suppresses the calendar's diary dot.
  const diaryDates = isAdmin ? await loadDiaryDates() : new Set<string>();

  let attempt = rawAttempt;
  if (attempt) {
    attempt = await evaluateAttempt(
      attempt,
      checksByDate,
      RULES.length,
      today,
      isAdmin,
    );
  }

  const currentDay =
    attempt && attempt.status === "active"
      ? daysBetween(attempt.start_date, today) + 1
      : null;

  const history = await loadHistorySummary();

  const ym = input?.ym ?? today.slice(0, 7);
  const { cells, label } = buildMonthCells(
    ym,
    attempt,
    checksByDate,
    diaryDates,
    today,
  );

  const selectedDate = input?.d ?? today;
  const selected = buildDayData(
    selectedDate,
    attempt,
    checksByDate,
    diaryDates,
    today,
  );

  return {
    is_admin: isAdmin,
    today,
    timezone: TIMEZONE,
    target_days: TARGET_DAYS,
    rules: RULES,
    goals: GOALS,
    attempt: attempt
      ? {
          ...attempt,
          current_day:
            attempt.status === "active" && currentDay ? currentDay : null,
        }
      : null,
    history,
    month: { ym, label, cells },
    selected,
  };
}

// ---------------------------------------------------------------------------
// Writes (admin cookie required)
// ---------------------------------------------------------------------------

export type Result = { ok: true } | { ok: false; error: string };

const RULE_IDS = new Set(RULES.map((r) => r.id));

async function requireAdmin(): Promise<Result | null> {
  if (!(await isAdminRequest())) {
    return { ok: false, error: "Locked. Enter the password to edit." };
  }
  return null;
}

export async function startAttempt(): Promise<Result> {
  const gate = await requireAdmin();
  if (gate) return gate;
  const svc = getServiceSupabase();

  const startDate = todayInTz(TIMEZONE);
  const { error } = await svc.from("challenges").insert({
    target_days: TARGET_DAYS,
    start_date: startDate,
    status: "active",
    timezone: TIMEZONE,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "There's already an active attempt." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function abandonAttempt(): Promise<Result> {
  const gate = await requireAdmin();
  if (gate) return gate;
  const svc = getServiceSupabase();

  const { data: row } = await svc
    .from("challenges")
    .select("id, timezone, status")
    .eq("status", "active")
    .maybeSingle();

  if (!row) return { ok: false, error: "No active attempt." };

  const today = todayInTz((row.timezone as string) || TIMEZONE);
  const { error } = await svc
    .from("challenges")
    .update({ status: "failed", failed_on_date: today })
    .eq("id", row.id)
    .eq("status", "active");

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function getActiveForToday(
  date: string,
): Promise<{ challengeId: string } | { error: string }> {
  const svc = getServiceSupabase();
  const { data } = await svc
    .from("challenges")
    .select("id, timezone, status")
    .eq("status", "active")
    .maybeSingle();
  if (!data) return { error: "No active attempt." };
  const tz = (data.timezone as string) || TIMEZONE;
  if (date !== todayInTz(tz)) return { error: "You can only edit today." };
  return { challengeId: data.id as string };
}

export async function checkRule(
  ruleId: string,
  date: string,
): Promise<Result> {
  if (!RULE_IDS.has(ruleId)) return { ok: false, error: "Unknown rule." };
  if (ruleId === DIARY_RULE_ID) {
    return {
      ok: false,
      error: "The diary rule checks automatically once you write in it.",
    };
  }

  const gate = await requireAdmin();
  if (gate) return gate;
  const svc = getServiceSupabase();

  const check = await getActiveForToday(date);
  if ("error" in check) return { ok: false, error: check.error };

  const { error } = await svc.from("challenge_checks").insert({
    challenge_id: check.challengeId,
    rule_id: ruleId,
    date,
  });

  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function uncheckRule(
  ruleId: string,
  date: string,
): Promise<Result> {
  if (!RULE_IDS.has(ruleId)) return { ok: false, error: "Unknown rule." };
  if (ruleId === DIARY_RULE_ID) {
    return { ok: false, error: "Clear the diary text to uncheck." };
  }

  const gate = await requireAdmin();
  if (gate) return gate;
  const svc = getServiceSupabase();

  const check = await getActiveForToday(date);
  if ("error" in check) return { ok: false, error: check.error };

  const { error } = await svc
    .from("challenge_checks")
    .delete()
    .eq("challenge_id", check.challengeId)
    .eq("rule_id", ruleId)
    .eq("date", date);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getDiary(date: string): Promise<string> {
  // Diary content is admin-only. Non-admin callers get an empty string.
  if (!(await isAdminRequest())) return "";
  const svc = getServiceSupabase();
  const { data } = await svc
    .from("diary_entries")
    .select("content")
    .eq("date", date)
    .maybeSingle();
  return (data?.content as string) ?? "";
}

export async function saveDiary(
  date: string,
  content: string,
): Promise<Result> {
  const gate = await requireAdmin();
  if (gate) return gate;
  const svc = getServiceSupabase();

  if (date !== todayInTz(TIMEZONE)) {
    return { ok: false, error: "You can only write today's diary." };
  }

  const clean = typeof content === "string" ? content.slice(0, 20000) : "";

  const { error } = await svc
    .from("diary_entries")
    .upsert({ date, content: clean }, { onConflict: "date" });

  if (error) return { ok: false, error: error.message };

  // Auto-sync the diary rule check with content presence, if there's an
  // active attempt and today falls inside it.
  const { data: active } = await svc
    .from("challenges")
    .select("id, start_date, target_days")
    .eq("status", "active")
    .maybeSingle();

  if (active) {
    const inAttempt =
      daysBetween(active.start_date as string, date) >= 0 &&
      daysBetween(active.start_date as string, date) <
        (active.target_days as number);
    if (inAttempt) {
      if (clean.trim().length > 0) {
        await svc
          .from("challenge_checks")
          .insert({
            challenge_id: active.id,
            rule_id: DIARY_RULE_ID,
            date,
          })
          .then(() => undefined, () => undefined);
      } else {
        await svc
          .from("challenge_checks")
          .delete()
          .eq("challenge_id", active.id)
          .eq("rule_id", DIARY_RULE_ID)
          .eq("date", date);
      }
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Unlock / lock
// ---------------------------------------------------------------------------

export async function unlock(password: string): Promise<Result> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return { ok: false, error: "ADMIN_PASSWORD is not set on the server." };
  }
  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, error: "Enter a password." };
  }
  // Constant-time compare
  if (password.length !== expected.length) {
    return { ok: false, error: "Wrong password." };
  }
  let diff = 0;
  for (let i = 0; i < password.length; i++) {
    diff |= password.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) return { ok: false, error: "Wrong password." };

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // 30 days
    maxAge: 60 * 60 * 24 * 30,
  });
  return { ok: true };
}

export async function lock(): Promise<Result> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  return { ok: true };
}
