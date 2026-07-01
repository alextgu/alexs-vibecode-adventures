"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthedSupabase } from "@/lib/supabase";
import { getTimezone } from "@/lib/profile";
import { todayInTz, addDays, daysBetween } from "@/lib/dates";

export type Rule = { id: string; label: string; position: number };

export type ActiveChallenge = {
  id: string;
  title: string;
  target_days: number;
  start_date: string;
  timezone: string;
  current_day: number;
  today: string;
  rules: Rule[];
  today_checks: string[];
  days_passed: number;
};

export type ChallengeSummary = {
  id: string;
  title: string;
  target_days: number;
  start_date: string;
  status: "active" | "completed" | "failed";
  failed_on_date: string | null;
  completed_at: string | null;
  outcome_day: number | null;
};

export type ChallengeDetail = ChallengeSummary & {
  timezone: string;
  rules: Rule[];
  checks: Record<string, string[]>;
};

export type Ok = { ok: true };
export type Err = { ok: false; error: string };
export type Result = Ok | Err;
export type ResultWith<T> = ({ ok: true } & T) | Err;

const MAX_LABEL_LEN = 120;
const MAX_TITLE_LEN = 80;
const MAX_RULES = 30;
const MAX_TARGET_DAYS = 365;

type ChallengeRow = {
  id: string;
  user_id: string;
  title: string;
  target_days: number;
  start_date: string;
  status: "active" | "completed" | "failed";
  failed_on_date: string | null;
  completed_at: string | null;
  timezone: string;
};

async function loadRules(
  client: SupabaseClient,
  challengeId: string,
): Promise<Rule[]> {
  const { data } = await client
    .from("challenge_rules")
    .select("id, label, position")
    .eq("challenge_id", challengeId)
    .order("position", { ascending: true });
  return (data ?? []) as Rule[];
}

/**
 * Load the active challenge for the user; run lazy fail/complete evaluation;
 * return the resolved active-challenge snapshot, or null if none is active.
 */
export async function getActiveChallenge(): Promise<ActiveChallenge | null> {
  const ctx = await getAuthedSupabase();
  if (!ctx) return null;

  const { data: row } = await ctx.client
    .from("challenges")
    .select(
      "id, user_id, title, target_days, start_date, status, failed_on_date, completed_at, timezone",
    )
    .eq("user_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();

  if (!row) return null;
  const challenge = row as ChallengeRow;

  const rules = await loadRules(ctx.client, challenge.id);
  if (rules.length === 0) {
    // Shouldn't happen (startChallenge requires >=1), but treat as fail-safe.
    return null;
  }

  const today = todayInTz(challenge.timezone);
  const lastRequired = addDays(challenge.start_date, challenge.target_days - 1);

  // Load all checks for this attempt up to and including today.
  const { data: checkRows } = await ctx.client
    .from("challenge_checks")
    .select("rule_id, date")
    .eq("challenge_id", challenge.id)
    .lte("date", today);

  const checksByDate = new Map<string, Set<string>>();
  for (const c of (checkRows ?? []) as { rule_id: string; date: string }[]) {
    let s = checksByDate.get(c.date);
    if (!s) {
      s = new Set();
      checksByDate.set(c.date, s);
    }
    s.add(c.rule_id);
  }

  // Walk past days to find the first failed one.
  const walkEnd = daysBetween(challenge.start_date, today) - 1; // inclusive index into past days
  const stopAt = Math.min(walkEnd, challenge.target_days - 2); // don't walk past last_required-1 either
  let daysPassed = 0;
  let failedOn: string | null = null;
  for (let i = 0; i <= stopAt; i++) {
    const d = addDays(challenge.start_date, i);
    const count = checksByDate.get(d)?.size ?? 0;
    if (count < rules.length) {
      failedOn = d;
      break;
    }
    daysPassed++;
  }

  if (failedOn) {
    await ctx.client
      .from("challenges")
      .update({ status: "failed", failed_on_date: failedOn })
      .eq("id", challenge.id)
      .eq("status", "active");
    return null;
  }

  const todayCount = checksByDate.get(today)?.size ?? 0;

  // Completion:
  // - today > last_required: all target_days are behind, nothing missed → complete
  // - today == last_required AND all rules checked today → complete
  const todayIsPast = daysBetween(challenge.start_date, today) >= challenge.target_days;
  const todayIsLastAndDone =
    daysBetween(challenge.start_date, today) === challenge.target_days - 1 &&
    todayCount === rules.length;

  if (todayIsPast || todayIsLastAndDone) {
    await ctx.client
      .from("challenges")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", challenge.id)
      .eq("status", "active");
    return null;
  }

  const currentDay = daysBetween(challenge.start_date, today) + 1;
  const todayChecks = Array.from(checksByDate.get(today) ?? []);

  return {
    id: challenge.id,
    title: challenge.title,
    target_days: challenge.target_days,
    start_date: challenge.start_date,
    timezone: challenge.timezone,
    current_day: currentDay,
    today,
    rules,
    today_checks: todayChecks,
    days_passed: daysPassed,
  };
}

/** All past + current attempts, most recent first. */
export async function getChallengeHistory(): Promise<ChallengeSummary[]> {
  const ctx = await getAuthedSupabase();
  if (!ctx) return [];

  const { data } = await ctx.client
    .from("challenges")
    .select(
      "id, title, target_days, start_date, status, failed_on_date, completed_at",
    )
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as Array<Omit<ChallengeSummary, "outcome_day">>).map(
    (r) => summarize(r),
  );
}

function summarize(r: Omit<ChallengeSummary, "outcome_day">): ChallengeSummary {
  let outcomeDay: number | null = null;
  if (r.status === "failed" && r.failed_on_date) {
    outcomeDay = daysBetween(r.start_date, r.failed_on_date) + 1;
  } else if (r.status === "completed") {
    outcomeDay = r.target_days;
  }
  return { ...r, outcome_day: outcomeDay };
}

/** Read-only detail for a given attempt (any status). */
export async function getChallenge(id: string): Promise<ChallengeDetail | null> {
  const ctx = await getAuthedSupabase();
  if (!ctx) return null;

  const { data: row } = await ctx.client
    .from("challenges")
    .select(
      "id, user_id, title, target_days, start_date, status, failed_on_date, completed_at, timezone",
    )
    .eq("id", id)
    .maybeSingle();

  if (!row) return null;
  const challenge = row as ChallengeRow;

  const rules = await loadRules(ctx.client, challenge.id);

  const { data: checkRows } = await ctx.client
    .from("challenge_checks")
    .select("rule_id, date")
    .eq("challenge_id", challenge.id);

  const checks: Record<string, string[]> = {};
  for (const c of (checkRows ?? []) as { rule_id: string; date: string }[]) {
    (checks[c.date] ??= []).push(c.rule_id);
  }

  const summary = summarize({
    id: challenge.id,
    title: challenge.title,
    target_days: challenge.target_days,
    start_date: challenge.start_date,
    status: challenge.status,
    failed_on_date: challenge.failed_on_date,
    completed_at: challenge.completed_at,
  });

  return {
    ...summary,
    timezone: challenge.timezone,
    rules,
    checks,
  };
}

export async function startChallenge(input: {
  title?: string;
  target_days?: number;
  rules: string[];
}): Promise<ResultWith<{ id: string }>> {
  const ctx = await getAuthedSupabase();
  if (!ctx) return { ok: false, error: "Not authenticated." };

  const title = (input.title ?? "Hard 75").trim().slice(0, MAX_TITLE_LEN) || "Hard 75";
  const targetDays = Number.isInteger(input.target_days) ? Number(input.target_days) : 75;
  if (targetDays < 1 || targetDays > MAX_TARGET_DAYS) {
    return { ok: false, error: `target_days must be 1–${MAX_TARGET_DAYS}.` };
  }

  const rules = (input.rules ?? [])
    .filter((r): r is string => typeof r === "string")
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
    .map((r) => r.slice(0, MAX_LABEL_LEN));

  if (rules.length === 0) return { ok: false, error: "Add at least one rule." };
  if (rules.length > MAX_RULES) return { ok: false, error: `Max ${MAX_RULES} rules.` };

  const tz = await getTimezone();
  const startDate = todayInTz(tz);

  const { data: challengeInsert, error: cErr } = await ctx.client
    .from("challenges")
    .insert({
      user_id: ctx.userId,
      title,
      target_days: targetDays,
      start_date: startDate,
      status: "active",
      timezone: tz,
    })
    .select("id")
    .single();

  if (cErr || !challengeInsert) {
    if (cErr?.code === "23505") {
      return { ok: false, error: "You already have an active challenge." };
    }
    return { ok: false, error: cErr?.message ?? "Failed to start challenge." };
  }

  const challengeId = challengeInsert.id as string;

  const rulesPayload = rules.map((label, i) => ({
    challenge_id: challengeId,
    user_id: ctx.userId,
    label,
    position: i,
  }));

  const { error: rErr } = await ctx.client
    .from("challenge_rules")
    .insert(rulesPayload);

  if (rErr) {
    // Roll back the challenge row so the state isn't half-created.
    await ctx.client.from("challenges").delete().eq("id", challengeId);
    return { ok: false, error: rErr.message };
  }

  return { ok: true, id: challengeId };
}

async function assertActive(
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthedSupabase>>>,
  challengeId: string,
): Promise<{ tz: string } | { error: string }> {
  const { data } = await ctx.client
    .from("challenges")
    .select("status, timezone")
    .eq("id", challengeId)
    .maybeSingle();
  if (!data) return { error: "Challenge not found." };
  if (data.status !== "active") return { error: "Challenge is not active." };
  return { tz: data.timezone as string };
}

export async function checkRule(
  challengeId: string,
  ruleId: string,
  date: string,
): Promise<Result> {
  const ctx = await getAuthedSupabase();
  if (!ctx) return { ok: false, error: "Not authenticated." };

  const check = await assertActive(ctx, challengeId);
  if ("error" in check) return { ok: false, error: check.error };

  if (date !== todayInTz(check.tz)) {
    return { ok: false, error: "You can only check rules for today." };
  }

  const { error } = await ctx.client.from("challenge_checks").insert({
    challenge_id: challengeId,
    rule_id: ruleId,
    user_id: ctx.userId,
    date,
  });

  // 23505 = unique violation: already checked, idempotent success.
  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function uncheckRule(
  challengeId: string,
  ruleId: string,
  date: string,
): Promise<Result> {
  const ctx = await getAuthedSupabase();
  if (!ctx) return { ok: false, error: "Not authenticated." };

  const check = await assertActive(ctx, challengeId);
  if ("error" in check) return { ok: false, error: check.error };

  if (date !== todayInTz(check.tz)) {
    return { ok: false, error: "You can only uncheck rules for today." };
  }

  const { error } = await ctx.client
    .from("challenge_checks")
    .delete()
    .eq("rule_id", ruleId)
    .eq("date", date);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function abandonChallenge(id: string): Promise<Result> {
  const ctx = await getAuthedSupabase();
  if (!ctx) return { ok: false, error: "Not authenticated." };

  const { data } = await ctx.client
    .from("challenges")
    .select("timezone, status")
    .eq("id", id)
    .maybeSingle();

  if (!data) return { ok: false, error: "Challenge not found." };
  if (data.status !== "active") {
    return { ok: false, error: "Challenge is not active." };
  }

  const today = todayInTz(data.timezone as string);
  const { error } = await ctx.client
    .from("challenges")
    .update({ status: "failed", failed_on_date: today })
    .eq("id", id)
    .eq("status", "active");

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
