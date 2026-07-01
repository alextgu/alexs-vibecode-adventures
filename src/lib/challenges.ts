"use server";

import { getAdminSupabase, getPublicSupabase } from "@/lib/supabase";
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
  user_id: string;
  target_days: number;
  start_date: string;
  status: "active" | "completed" | "failed";
  failed_on_date: string | null;
  completed_at: string | null;
  timezone: string;
};

export type DayData = {
  date: string;
  day_num: number | null; // null if outside the attempt window
  in_attempt: boolean;
  is_today: boolean;
  is_past: boolean;
  is_future: boolean;
  checked: string[]; // rule ids
  all_checked: boolean;
  failed: boolean; // this specific day is the fail date
  has_diary: boolean;
};

export type MonthCell = {
  date: string; // YYYY-MM-DD
  day_of_month: number;
  in_month: boolean; // false = leading/trailing pad from adjacent month
  day: DayData;
};

export type HomeData = {
  mode: "admin" | "not-admin" | "signed-out";
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
    ym: string; // YYYY-MM
    label: string; // "March 2026"
    cells: MonthCell[]; // always length 42 (6 weeks) — sunday start
  };
  selected: DayData;
};

// ---------------------------------------------------------------------------
// Reads (public — anyone)
// ---------------------------------------------------------------------------

async function loadActive(): Promise<ChallengeRow | null> {
  const supabase = getPublicSupabase();
  const { data } = await supabase
    .from("challenges")
    .select(
      "id, user_id, target_days, start_date, status, failed_on_date, completed_at, timezone",
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

/**
 * Runs the lazy fail / complete evaluation for the active attempt.
 * This only writes to the DB if the caller is admin. For public reads we
 * still compute the "effective" status in memory so the calendar looks right.
 */
async function evaluateAttempt(
  attempt: ChallengeRow,
  checksByDate: Map<string, Set<string>>,
  ruleCount: number,
  today: string,
  canWrite: boolean,
): Promise<ChallengeRow> {
  const startDate = attempt.start_date;
  const lastRequired = addDays(startDate, attempt.target_days - 1);

  // Find first failed day in [start_date, min(today, lastRequired) - 1]
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
    const updated: ChallengeRow = {
      ...attempt,
      status: "failed",
      failed_on_date: failedOn,
    };
    if (canWrite) {
      const admin = await getAdminSupabase();
      if (admin.ok) {
        await admin.client
          .from("challenges")
          .update({ status: "failed", failed_on_date: failedOn })
          .eq("id", attempt.id)
          .eq("status", "active");
      }
    }
    return updated;
  }

  const todayCount = checksByDate.get(today)?.size ?? 0;
  const todayIsPast = daysBetween(startDate, today) >= attempt.target_days;
  const todayIsLastAndDone =
    daysBetween(startDate, today) === attempt.target_days - 1 &&
    todayCount === ruleCount;

  if (todayIsPast || todayIsLastAndDone) {
    const nowIso = new Date().toISOString();
    const updated: ChallengeRow = {
      ...attempt,
      status: "completed",
      completed_at: nowIso,
    };
    if (canWrite) {
      const admin = await getAdminSupabase();
      if (admin.ok) {
        await admin.client
          .from("challenges")
          .update({ status: "completed", completed_at: nowIso })
          .eq("id", attempt.id)
          .eq("status", "active");
      }
    }
    return updated;
  }

  // Discard lastRequired since it isn't returned in the result — this line
  // is here so the linter doesn't complain about an unused var above.
  void lastRequired;

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
  const month = Number(mStr); // 1..12

  const firstOfMonth = `${yStr}-${mStr}-01`;
  const firstDate = new Date(Date.UTC(year, month - 1, 1));
  const dow = firstDate.getUTCDay(); // 0 = Sun

  // Grid start: back up to the Sunday on or before the 1st.
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

/**
 * Everything the home page needs: mode, attempt, month grid, selected day.
 * `ym` = "YYYY-MM" (defaults to today's month). `d` = "YYYY-MM-DD" (defaults today).
 */
export async function getHomeData(input?: {
  ym?: string;
  d?: string;
}): Promise<HomeData> {
  const { getSessionMode } = await import("@/lib/supabase");
  const mode = await getSessionMode();
  const today = todayInTz(TIMEZONE);

  const rawAttempt = await loadActive();
  const checksByDate = rawAttempt
    ? await loadChecks(rawAttempt.id)
    : new Map<string, Set<string>>();
  const diaryDates = await loadDiaryDates();

  let attempt = rawAttempt;
  if (attempt) {
    attempt = await evaluateAttempt(
      attempt,
      checksByDate,
      RULES.length,
      today,
      mode === "admin",
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
    mode,
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
// Writes (admin-only)
// ---------------------------------------------------------------------------

export type Result = { ok: true } | { ok: false; error: string };

const RULE_IDS = new Set(RULES.map((r) => r.id));

export async function startAttempt(): Promise<Result> {
  const admin = await getAdminSupabase();
  if (!admin.ok) return { ok: false, error: reasonMsg(admin.reason) };

  const startDate = todayInTz(TIMEZONE);

  const { error } = await admin.client.from("challenges").insert({
    user_id: admin.userId,
    target_days: TARGET_DAYS,
    start_date: startDate,
    status: "active",
    timezone: TIMEZONE,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "You already have an active challenge." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function abandonAttempt(): Promise<Result> {
  const admin = await getAdminSupabase();
  if (!admin.ok) return { ok: false, error: reasonMsg(admin.reason) };

  const { data: row } = await admin.client
    .from("challenges")
    .select("id, timezone, status")
    .eq("status", "active")
    .maybeSingle();

  if (!row) return { ok: false, error: "No active challenge." };

  const today = todayInTz((row.timezone as string) || TIMEZONE);
  const { error } = await admin.client
    .from("challenges")
    .update({ status: "failed", failed_on_date: today })
    .eq("id", row.id)
    .eq("status", "active");

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function assertTodayForActive(
  admin: Extract<Awaited<ReturnType<typeof getAdminSupabase>>, { ok: true }>,
  date: string,
): Promise<{ challengeId: string } | { error: string }> {
  const { data } = await admin.client
    .from("challenges")
    .select("id, timezone, status")
    .eq("status", "active")
    .maybeSingle();
  if (!data) return { error: "No active challenge." };
  const tz = (data.timezone as string) || TIMEZONE;
  if (date !== todayInTz(tz)) {
    return { error: "You can only edit today." };
  }
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
      error: "The diary rule is checked automatically when you write in it.",
    };
  }

  const admin = await getAdminSupabase();
  if (!admin.ok) return { ok: false, error: reasonMsg(admin.reason) };

  const check = await assertTodayForActive(admin, date);
  if ("error" in check) return { ok: false, error: check.error };

  const { error } = await admin.client.from("challenge_checks").insert({
    challenge_id: check.challengeId,
    rule_id: ruleId,
    user_id: admin.userId,
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
    return {
      ok: false,
      error: "The diary rule is checked automatically when you write in it.",
    };
  }

  const admin = await getAdminSupabase();
  if (!admin.ok) return { ok: false, error: reasonMsg(admin.reason) };

  const check = await assertTodayForActive(admin, date);
  if ("error" in check) return { ok: false, error: check.error };

  const { error } = await admin.client
    .from("challenge_checks")
    .delete()
    .eq("challenge_id", check.challengeId)
    .eq("rule_id", ruleId)
    .eq("date", date);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getDiary(date: string): Promise<string> {
  const supabase = getPublicSupabase();
  const { data } = await supabase
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
  const admin = await getAdminSupabase();
  if (!admin.ok) return { ok: false, error: reasonMsg(admin.reason) };

  if (date !== todayInTz(TIMEZONE)) {
    return { ok: false, error: "You can only write today's diary." };
  }

  const clean = typeof content === "string" ? content.slice(0, 20000) : "";

  const { error } = await admin.client.from("diary_entries").upsert(
    {
      user_id: admin.userId,
      date,
      content: clean,
    },
    { onConflict: "user_id,date" },
  );

  if (error) return { ok: false, error: error.message };

  // Auto-sync the diary rule check with content presence, if there's an
  // active attempt and today falls inside it.
  const { data: active } = await admin.client
    .from("challenges")
    .select("id, start_date, target_days, timezone")
    .eq("status", "active")
    .maybeSingle();

  if (active) {
    const inAttempt =
      daysBetween(active.start_date as string, date) >= 0 &&
      daysBetween(active.start_date as string, date) <
        (active.target_days as number);
    if (inAttempt) {
      if (clean.trim().length > 0) {
        await admin.client
          .from("challenge_checks")
          .insert({
            challenge_id: active.id,
            rule_id: DIARY_RULE_ID,
            user_id: admin.userId,
            date,
          })
          .then(() => undefined, () => undefined);
      } else {
        await admin.client
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

function reasonMsg(reason: "signed-out" | "not-admin"): string {
  if (reason === "signed-out") return "Sign in required.";
  return "Not admin.";
}
