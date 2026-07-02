import Link from "next/link";
import { getHomeData, getDiary } from "@/lib/challenges";
import { listGoals } from "@/lib/goals";
import { listDailyGoals } from "@/lib/daily-goals";
import { Calendar } from "@/components/Calendar";
import { ChecklistRow } from "@/components/ChecklistRow";
import { DiaryEditor } from "@/components/DiaryEditor";
import { LockButton } from "@/components/LockButton";
import { AbandonAttemptButton } from "@/components/AttemptControls";
import { ModalShell } from "@/components/ModalShell";
import { GoalsSection } from "@/components/GoalsSection";
import { DailyGoalsSection } from "@/components/DailyGoalsSection";
import { DailyGoalsInModal } from "@/components/DailyGoalsInModal";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string; d?: string }>;
}) {
  const sp = await searchParams;
  const [data, goals, dailyGoals] = await Promise.all([
    getHomeData({ ym: sp.ym, d: sp.d }),
    listGoals(),
    listDailyGoals(),
  ]);

  const isAdmin = data.is_admin;
  const modalOpen = typeof sp.d === "string" && sp.d.length > 0;
  const canEdit = isAdmin && data.selected.is_today;

  const selectedDiary =
    isAdmin && modalOpen ? await getDiary(data.selected.date) : "";

  // Daily-goals status for the selected day (only fetched when modal is open).
  const selectedDailyGoals = modalOpen
    ? await listDailyGoals(data.selected.date)
    : [];

  const closeHref = `/?ym=${data.month.ym}`;

  const goalsByDate: Record<string, string[]> = {};
  for (const g of goals) {
    if (g.target_date) {
      (goalsByDate[g.target_date] ??= []).push(g.title);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          marginBottom: 8,
          gap: 12,
        }}
      >
        <nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {isAdmin ? (
            <LockButton />
          ) : (
            <Link href="/unlock">Unlock</Link>
          )}
        </nav>
      </header>

      {!isAdmin && (
        <div
          style={{
            border: "1px solid #000",
            padding: "8px 10px",
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          View-only. <Link href="/unlock">Unlock</Link> to edit today.
        </div>
      )}

      <StreakBanner data={data} />

      <DailyGoalsSection goals={dailyGoals} isAdmin={isAdmin} />

      <GoalsSection goals={goals} isAdmin={isAdmin} />

      <Calendar
        ym={data.month.ym}
        label={data.month.label}
        cells={data.month.cells}
        selectedDate={modalOpen ? data.selected.date : ""}
        totalRules={data.rules.length}
        goalsByDate={goalsByDate}
      />

      {modalOpen && (
        <ModalShell closeHref={closeHref}>
          <SelectedDayPanel
            data={data}
            selectedDiary={selectedDiary}
            selectedDailyGoals={selectedDailyGoals}
            canEdit={canEdit}
          />
        </ModalShell>
      )}
    </main>
  );
}

function StreakBanner({
  data,
}: {
  data: Awaited<ReturnType<typeof getHomeData>>;
}) {
  const attempt = data.attempt;
  const isAdmin = data.is_admin;
  const longest = data.history.longest_streak;
  const total = data.rules.length;

  // Today's score = current-day check count (regardless of attempt status).
  const todayCell = data.month.cells.find((c) => c.day.is_today);
  const todayScore = todayCell ? todayCell.day.checked.length : 0;

  const bannerBase: React.CSSProperties = {
    border: "2px solid #000",
    padding: "16px 20px",
    marginBottom: 16,
  };

  if (attempt && attempt.status === "active") {
    return (
      <section
        style={{
          ...bannerBase,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 48, fontWeight: 700, lineHeight: 1 }}>
            {attempt.current_day ?? "?"}
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            day streak · of {attempt.target_days}
          </div>
          <div style={{ fontSize: 13, marginTop: 6, fontWeight: 700 }}>
            Today: {todayScore}/{total}
          </div>
          <MetaLines startedOn={attempt.start_date} longest={longest} />
        </div>
        {isAdmin && <AbandonAttemptButton />}
      </section>
    );
  }

  if (attempt && attempt.status === "completed") {
    return (
      <section style={bannerBase}>
        <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
          {attempt.target_days} / {attempt.target_days} ✓
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          Completed
          {attempt.completed_at ? ` on ${attempt.completed_at.slice(0, 10)}` : ""}.
        </div>
        <MetaLines startedOn={attempt.start_date} longest={longest} />
      </section>
    );
  }

  if (attempt && attempt.status === "failed") {
    const day = attempt.failed_on_date
      ? dayFromDates(attempt.start_date, attempt.failed_on_date)
      : "?";
    return (
      <section style={bannerBase}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>Failed on Day {day}</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          {isAdmin
            ? "Check today's first rule to start a new attempt."
            : "Waiting on the next attempt."}
        </div>
        <MetaLines startedOn={attempt.start_date} longest={longest} />
      </section>
    );
  }

  return (
    <section style={bannerBase}>
      <div style={{ fontSize: 24, fontWeight: 700 }}>No attempt yet</div>
      <div style={{ fontSize: 13, marginTop: 4 }}>
        {isAdmin
          ? "Check today's first rule to start."
          : "Waiting on the next attempt."}
      </div>
      <MetaLines startedOn={null} longest={longest} />
    </section>
  );
}

function MetaLines({
  startedOn,
  longest,
}: {
  startedOn: string | null;
  longest: number;
}) {
  return (
    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
      {startedOn && <div>Started {startedOn}</div>}
      <div>Longest streak: {longest} day{longest === 1 ? "" : "s"}</div>
    </div>
  );
}

function SelectedDayPanel({
  data,
  selectedDiary,
  selectedDailyGoals,
  canEdit,
}: {
  data: Awaited<ReturnType<typeof getHomeData>>;
  selectedDiary: string;
  selectedDailyGoals: Awaited<ReturnType<typeof listDailyGoals>>;
  canEdit: boolean;
}) {
  const s = data.selected;
  const attempt = data.attempt;
  const isAdmin = data.is_admin;
  const dayLabel = s.day_num ? `Day ${s.day_num} · ${s.date}` : s.date;

  return (
    <div>
      <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 4 }}>
        {dayLabel}
      </h2>
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
        Score: {s.checked.length}/{data.rules.length}
      </div>

      {!s.in_attempt && !s.is_today && (
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 10 }}>
          {attempt
            ? "Outside the current attempt."
            : "No active attempt on this date."}
        </div>
      )}

      {s.failed && (
        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          This is where the attempt failed.
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        {data.rules.map((r) => (
          <ChecklistRow
            key={r.id}
            ruleId={r.id}
            label={r.label}
            date={s.date}
            checked={s.checked.includes(r.id)}
            disabled={!canEdit}
            auto={r.auto === "diary"}
          />
        ))}
      </div>

      <DailyGoalsInModal goals={selectedDailyGoals} canEdit={canEdit} />

      {isAdmin && (
        <DiaryEditor
          date={s.date}
          initial={selectedDiary}
          disabled={!canEdit}
        />
      )}
    </div>
  );
}

function dayFromDates(start: string, target: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ty, tm, td] = target.split("-").map(Number);
  const diff = Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) /
      (1000 * 60 * 60 * 24),
  );
  return diff + 1;
}
