-- Habit Tracker — schema, RLS, and public view
-- Assumes the Clerk → Supabase native third-party auth integration is enabled
-- in the Supabase dashboard (Authentication → Third-party Auth → Clerk).
-- Under that setup, `auth.jwt() ->> 'sub'` equals the Clerk user_id (e.g. "user_2abc...").

create extension if not exists "pgcrypto";

create table if not exists public.daily_logs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            text not null,
  date               date not null,
  day_score          int  not null check (day_score between 1 and 10),
  calories           int  not null check (calories >= 0),
  protein_g          int  not null check (protein_g >= 0),
  journal_submitted  boolean not null default false,
  completed_habits   jsonb   not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists daily_logs_user_date_idx
  on public.daily_logs (user_id, date desc);

-- Keep updated_at fresh on UPDATE
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists daily_logs_set_updated_at on public.daily_logs;
create trigger daily_logs_set_updated_at
  before update on public.daily_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: owner-only writes/reads on the base table.
-- ---------------------------------------------------------------------------
alter table public.daily_logs enable row level security;
alter table public.daily_logs force row level security;

drop policy if exists "owner_select" on public.daily_logs;
create policy "owner_select"
  on public.daily_logs for select
  using (auth.jwt() ->> 'sub' = user_id);

drop policy if exists "owner_insert" on public.daily_logs;
create policy "owner_insert"
  on public.daily_logs for insert
  with check (auth.jwt() ->> 'sub' = user_id);

drop policy if exists "owner_update" on public.daily_logs;
create policy "owner_update"
  on public.daily_logs for update
  using      (auth.jwt() ->> 'sub' = user_id)
  with check (auth.jwt() ->> 'sub' = user_id);

drop policy if exists "owner_delete" on public.daily_logs;
create policy "owner_delete"
  on public.daily_logs for delete
  using (auth.jwt() ->> 'sub' = user_id);

-- Lock down direct anon/authenticated table grants — RLS alone is not enough
-- if base table grants are wide. The authenticated role still needs SELECT/INSERT/etc.
-- for RLS to even apply, so grant minimally to authenticated and nothing to anon.
revoke all on public.daily_logs from anon, authenticated;
grant select, insert, update, delete on public.daily_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Public view: exposes ONLY date, day_score, completed_habits (+ user_id for filtering).
-- Calories and protein_g never leave the database via this path.
--
-- The view runs with the view-owner's privileges (security_invoker = off), so RLS
-- on daily_logs does not block it. Access is gated by GRANT on the view itself.
-- ---------------------------------------------------------------------------
drop view if exists public.public_daily_logs;
create view public.public_daily_logs
  with (security_invoker = off) as
  select user_id, date, day_score, completed_habits
    from public.daily_logs;

grant select on public.public_daily_logs to anon, authenticated;

-- ===========================================================================
-- Hard 75 / Challenges  (single-tenant, public-read, password-gated writes)
-- ===========================================================================
-- Personal habit tracker. Anyone (anon) can SELECT — read-only calendar view.
-- All writes go through the app server using a Supabase service-role client,
-- which bypasses RLS. Access to that path is gated by ADMIN_PASSWORD (see
-- src/lib/supabase.ts). anon has SELECT only, so a leaked anon key still
-- can't write.
--
-- Clean up prior tables that are no longer used.
drop table if exists public.challenge_rules;
drop table if exists public.user_profiles;
-- Drop old writable variants if they exist so this migration is re-runnable.
drop table if exists public.challenge_checks;
drop table if exists public.diary_entries;
drop table if exists public.challenges;

create table public.challenges (
  id             uuid primary key default gen_random_uuid(),
  target_days    int  not null default 75 check (target_days > 0),
  start_date     date not null,
  status         text not null check (status in ('active','completed','failed')),
  failed_on_date date,
  completed_at   timestamptz,
  timezone       text not null,
  created_at     timestamptz not null default now()
);

-- At most one active attempt globally (single tenant).
create unique index challenges_one_active
  on public.challenges ((true)) where status = 'active';

create index challenges_created_idx
  on public.challenges (created_at desc);

alter table public.challenges enable row level security;

drop policy if exists "public_select" on public.challenges;
create policy "public_select" on public.challenges for select using (true);

revoke all on public.challenges from anon, authenticated;
grant select on public.challenges to anon, authenticated;

-- One row per rule-per-day when checked. Absence = unchecked.
-- rule_id matches an id from RULES in src/lib/config.ts.
create table public.challenge_checks (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  rule_id      text not null,
  date         date not null,
  created_at   timestamptz not null default now(),
  unique (challenge_id, rule_id, date)
);

create index challenge_checks_challenge_date_idx
  on public.challenge_checks (challenge_id, date);

alter table public.challenge_checks enable row level security;

drop policy if exists "public_select" on public.challenge_checks;
create policy "public_select" on public.challenge_checks for select using (true);

revoke all on public.challenge_checks from anon, authenticated;
grant select on public.challenge_checks to anon, authenticated;

-- One diary entry per date. Independent of attempts (survives restarts).
create table public.diary_entries (
  date       date primary key,
  content    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists diary_entries_set_updated_at on public.diary_entries;
create trigger diary_entries_set_updated_at
  before update on public.diary_entries
  for each row execute function public.set_updated_at();

create index diary_entries_date_idx on public.diary_entries (date);

alter table public.diary_entries enable row level security;

drop policy if exists "public_select" on public.diary_entries;
create policy "public_select" on public.diary_entries for select using (true);

revoke all on public.diary_entries from anon, authenticated;
grant select on public.diary_entries to anon, authenticated;

-- Long-term goals shown alongside the challenge. Independent of attempts
-- and independent of the daily-complete streak.
drop table if exists public.goals;
create table public.goals (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  note         text,
  target_date  date,
  completed_at timestamptz,
  position     int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

create index goals_position_idx on public.goals (position, created_at);

alter table public.goals enable row level security;

drop policy if exists "public_select" on public.goals;
create policy "public_select" on public.goals for select using (true);

revoke all on public.goals from anon, authenticated;
grant select on public.goals to anon, authenticated;

-- Recurring daily goals. Each row = one recurring habit you want to track.
-- Independent of the 75-day challenge — toggling these does not affect
-- the streak or the day score.
drop table if exists public.daily_goal_completions;
drop table if exists public.daily_goals;
create table public.daily_goals (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  note       text,
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists daily_goals_set_updated_at on public.daily_goals;
create trigger daily_goals_set_updated_at
  before update on public.daily_goals
  for each row execute function public.set_updated_at();

create index daily_goals_position_idx on public.daily_goals (position, created_at);

alter table public.daily_goals enable row level security;

drop policy if exists "public_select" on public.daily_goals;
create policy "public_select" on public.daily_goals for select using (true);

revoke all on public.daily_goals from anon, authenticated;
grant select on public.daily_goals to anon, authenticated;

-- One row per (daily_goal, date) when done that day.
create table public.daily_goal_completions (
  id            uuid primary key default gen_random_uuid(),
  daily_goal_id uuid not null references public.daily_goals(id) on delete cascade,
  date          date not null,
  created_at    timestamptz not null default now(),
  unique (daily_goal_id, date)
);

create index daily_goal_completions_date_idx
  on public.daily_goal_completions (date, daily_goal_id);

alter table public.daily_goal_completions enable row level security;

drop policy if exists "public_select" on public.daily_goal_completions;
create policy "public_select" on public.daily_goal_completions for select using (true);

revoke all on public.daily_goal_completions from anon, authenticated;
grant select on public.daily_goal_completions to anon, authenticated;

-- Admin todo list — a lightweight notepad/checklist for the admin.
-- Independent of everything else. Optional target_date. Once completed, the
-- title is shown on the calendar on `completed_on` (description stays private).
drop table if exists public.admin_todos;
create table public.admin_todos (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  note         text,
  target_date  date,
  completed_on date,
  position     int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists admin_todos_set_updated_at on public.admin_todos;
create trigger admin_todos_set_updated_at
  before update on public.admin_todos
  for each row execute function public.set_updated_at();

create index admin_todos_position_idx on public.admin_todos (position, created_at);
create index admin_todos_completed_on_idx on public.admin_todos (completed_on);

alter table public.admin_todos enable row level security;

drop policy if exists "public_select" on public.admin_todos;
create policy "public_select" on public.admin_todos for select using (true);

revoke all on public.admin_todos from anon, authenticated;
grant select on public.admin_todos to anon, authenticated;
