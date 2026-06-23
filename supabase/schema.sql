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
