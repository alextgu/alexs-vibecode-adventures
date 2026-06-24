# Habit Tracker — Design

**Date:** 2026-06-24
**Status:** Approved, ready for implementation plan

A personal daily habit tracker with a calendar frontend whose visual theme is randomly rolled per browser session. Four weird-but-functional themes ship in v1; the architecture lets new themes drop in without touching dashboard code.

## Scope

In:
- Single-user dashboard at `/dashboard` (Clerk-gated)
- Calendar month grid showing per-day score + habit completion density
- Habit definitions with cadences (daily / every-N-days / weekly / monthly)
- Habit completion tracking per day
- Long-term goals with optional target dates
- Four visual themes (Y2K, Terminal, Notebook, Scientific) rolled randomly per session

Out (for v1):
- Public profile / sharing — `public_daily_logs` view is removed
- Calories, protein, and the standalone `journal_submitted` flag (journal becomes a normal habit with `every_n_days = 2`)
- Optimistic UI
- Notifications, reminders, exports
- Multi-user, teams, social features
- A "lock theme" or "reroll theme" control — randomness is the point

## Data model

### `daily_logs` (existing, slimmed)
Drop `calories`, `protein_g`, `journal_submitted`, `completed_habits`. Keep:
- `id uuid pk`
- `user_id text`
- `date date`
- `day_score int check (between 1 and 10)`
- `created_at`, `updated_at`
- Unique `(user_id, date)`

### `habits` (new)
- `id uuid pk`
- `user_id text`
- `name text`
- `cadence_type text check (in 'daily','every_n_days','weekly','monthly')`
- `cadence_interval int default 1` — used by `every_n_days` (e.g. 2 = every other day); ignored otherwise
- `emoji text nullable`
- `color text nullable` — hex string; themes may or may not honor it
- `archived_at timestamptz nullable` — soft-delete; archived habits stop appearing in current views but their historical completions still render
- `created_at timestamptz`

### `habit_completions` (new)
- `id uuid pk`
- `user_id text`
- `habit_id uuid references habits(id) on delete cascade`
- `date date`
- `created_at timestamptz`
- Unique `(habit_id, date)` — one completion per habit per day

### `goals` (new)
- `id uuid pk`
- `user_id text`
- `title text`
- `target_date date nullable`
- `completed_at timestamptz nullable`
- `created_at timestamptz`

### RLS
All four tables use the existing pattern:
- `auth.jwt() ->> 'sub' = user_id` for select / insert / update / delete
- `revoke all from anon, authenticated`
- `grant select, insert, update, delete to authenticated`

The `public_daily_logs` view and any `grant select ... to anon` are dropped.

## Server actions

`src/lib/daily-log.ts` is replaced by topic-split files under `src/lib/`:

- `src/lib/days.ts`
  - `setDayScore(date: string, score: number)` — upsert into `daily_logs`
- `src/lib/habits.ts`
  - `createHabit(input)` / `updateHabit(id, input)` / `archiveHabit(id)`
  - `toggleHabitCompletion(habitId: string, date: string)` — insert if missing, delete if present
- `src/lib/goals.ts`
  - `createGoal(input)` / `updateGoal(id, input)` / `completeGoal(id)` / `deleteGoal(id)`
- `src/lib/month-data.ts`
  - `getMonthData(yearMonth: string): Promise<MonthData>` — one round trip returning everything the dashboard needs for one month view:
    ```ts
    type MonthData = {
      daysScored: Record<string, number>;           // ISO date -> 1..10
      completions: Record<string, string[]>;        // habitId -> ISO dates this month
      habits: Habit[];                              // not archived, or archived after month start
      goals: Goal[];                                // all active + completed-this-month
    }
    ```

All actions return the existing shape: `{ ok: true, ... } | { ok: false, error: string }`.

Streak and "overdue" computation happens in TypeScript on the server using the returned data; not in SQL.

## Theme system

### Selection
- `middleware.ts` matches `/dashboard*`, checks for a `theme` cookie:
  - If present and valid → pass through
  - If missing or invalid → pick a random theme ID from the registered set, set a **session cookie** (no `Max-Age`/`Expires`, so it dies on tab close), continue
- Dashboard server components read the cookie via `cookies()` from `next/headers` and resolve the active `Theme` object.
- No client-side roll — server renders the right theme on the first byte; zero flash, no hydration mismatch.

### Theme contract
`src/themes/types.ts`:
```ts
type Theme = {
  id: 'y2k' | 'terminal' | 'notebook' | 'scientific';
  Shell:        FC<{ children: ReactNode; monthLabel: string; prevMonthHref: string; nextMonthHref: string }>;
  Calendar:     FC<CalendarProps>;
  DayCell:      FC<DayCellProps>;
  HabitsList:   FC<HabitsListProps>;
  GoalsList:    FC<GoalsListProps>;
  DayLogModal:  FC<DayLogModalProps>;
  HabitForm:    FC<HabitFormProps>;
  GoalForm:     FC<GoalFormProps>;
  copy: {
    appTitle: string;
    todayLabel: string;
    streakLabel: (n: number) => string;
    overdueLabel: string;
    addHabitCta: string;
    addGoalCta: string;
    saveCta: string;
    cancelCta: string;
    emptyHabitsState: string;
    emptyGoalsState: string;
  };
  rootClass: string;  // applied to <html> for theme-scoped Tailwind / CSS
};
```

### Theme registry
`src/themes/index.ts`:
```ts
export const themes = { y2k, terminal, notebook, scientific } as const;
export type ThemeId = keyof typeof themes;
```
Adding a new theme = one folder under `src/themes/<id>/` exporting a `Theme` and one line added to `themes`. Nothing in `dashboard/page.tsx` ever branches on theme ID.

### v1 themes
1. **`y2k`** — Y2K Maximalist. Sparkles, chrome gradients, hot pink + cyan, kaomoji, ❤/★ glyphs, marquee header.
2. **`terminal`** — Brutalist DOS. Monospace, ASCII box-drawn grid, no rounded corners, `[ log today ]` button style.
3. **`notebook`** — Handwritten paper journal. Lined background, drawn checkboxes, ★ for today, deliberately wobbly alignment.
4. **`scientific`** — Lab observation notes. Sparklines for `day_score`, deadpan footnoted prose, `> log_today.run()` button style.

Data semantics are identical across themes — only presentation and microcopy change.

## Routes & components

### Routes
- `/` — sign-out: Clerk sign-in card. Signed-in: redirect to `/dashboard`.
- `/dashboard` — the app. Optional `?ym=YYYY-MM` query for the month being viewed (defaults to current).
- `middleware.ts` — Clerk auth gate + theme cookie roll.

### Layout structure (theme-agnostic)
`dashboard/page.tsx` is a Server Component:
1. Reads `theme` cookie → resolves `Theme` object
2. Calls `getMonthData(ym)`
3. Renders `<theme.Shell>` wrapping `<theme.Calendar>`, `<theme.HabitsList>`, `<theme.GoalsList>`

### Interactions
- Click day → opens `theme.DayLogModal` for that date: `day_score` 1–10 input + checkbox per habit (filtered to habits that existed on/before that date and not archived before that date).
- Click habit row → opens `theme.HabitForm` in edit mode.
- Click "new habit" CTA → opens `theme.HabitForm` in create mode.
- Click goal checkbox → calls `completeGoal`.
- Click "new goal" CTA → opens `theme.GoalForm`.
- Month nav → updates `?ym=` query; server refetches.

Server / client split:
- Page + Shell + list containers: server components.
- Modals, score sliders, checkboxes, forms: client components inside each theme folder. They invoke server actions and call `router.refresh()` on success.

## Error handling

- Server actions return `{ ok, error? }`; modals surface `error` as inline text. No toast system.
- Client forms validate type/range; RLS is the final gate.
- Missing/invalid theme cookie is recovered transparently by middleware.

## Testing

V1: manual verification only. Each theme renders the same fixture data; eyeballing the calendar and habit panel is sufficient at this scale. When behavior stabilizes (likely after the first new theme is added), revisit and add integration tests around the server actions and `getMonthData`.

## Open questions

None as of approval. Future considerations explicitly out of scope for v1:
- Re-introducing public sharing (separate spec when wanted)
- Optimistic UI
- Reminders / notifications
- Heatmap "year in pixels" alternate view
