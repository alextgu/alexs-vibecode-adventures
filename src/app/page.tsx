import Link from "next/link";
import { getHomeData, getDiary } from "@/lib/challenges";
import { Calendar } from "@/components/Calendar";
import { ChecklistRow } from "@/components/ChecklistRow";
import { DiaryEditor } from "@/components/DiaryEditor";
import { LockButton } from "@/components/LockButton";
import { AbandonAttemptButton } from "@/components/AttemptControls";
import { ModalShell } from "@/components/ModalShell";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string; d?: string }>;
}) {
  const sp = await searchParams;
  const data = await getHomeData({ ym: sp.ym, d: sp.d });

  const isAdmin = data.is_admin;
  const modalOpen = typeof sp.d === "string" && sp.d.length > 0;

  // Editable when admin is unlocked AND the selected day is today.
  const canEdit = isAdmin && data.selected.is_today;

  // Diary content is admin-only; getDiary returns "" for non-admin.
  const selectedDiary =
    isAdmin && modalOpen ? await getDiary(data.selected.date) : "";

  const closeHref = `/?ym=${data.month.ym}`;

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

      <Calendar
        ym={data.month.ym}
        label={data.month.label}
        cells={data.month.cells}
        selectedDate={modalOpen ? data.selected.date : ""}
        totalRules={data.rules.length}
      />

      {data.goals.length > 0 && (
        <>
          <hr />
          <section>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Goals</h2>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {data.goals.map((g) => (
                <li key={g.id}>
                  {g.title}
                  {g.note && <span style={{ opacity: 0.7 }}> — {g.note}</span>}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {modalOpen && (
        <ModalShell closeHref={closeHref}>
          <SelectedDayPanel
            data={data}
            selectedDiary={selectedDiary}
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

  // Active attempt → big streak number.
  if (attempt && attempt.status === "active") {
    return (
      <section
        style={{
          border: "2px solid #000",
          padding: "16px 20px",
          marginBottom: 16,
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
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
            since {attempt.start_date}
          </div>
        </div>
        {isAdmin && <AbandonAttemptButton />}
      </section>
    );
  }

  // Completed → trophy.
  if (attempt && attempt.status === "completed") {
    return (
      <section
        style={{
          border: "2px solid #000",
          padding: "16px 20px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
          {attempt.target_days} / {attempt.target_days} ✓
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          Completed
          {attempt.completed_at ? ` on ${attempt.completed_at.slice(0, 10)}` : ""}.
        </div>
      </section>
    );
  }

  // Failed → next attempt starts on first check.
  if (attempt && attempt.status === "failed") {
    const day = attempt.failed_on_date
      ? dayFromDates(attempt.start_date, attempt.failed_on_date)
      : "?";
    return (
      <section
        style={{
          border: "2px solid #000",
          padding: "16px 20px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 700 }}>Failed on Day {day}</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          {isAdmin
            ? "Check today's first rule to start a new attempt."
            : "Waiting on the next attempt."}
        </div>
      </section>
    );
  }

  // No attempt yet.
  return (
    <section
      style={{
        border: "2px solid #000",
        padding: "16px 20px",
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 700 }}>No attempt yet</div>
      {data.history.last_outcome && (
        <div style={{ fontSize: 13, marginTop: 4 }}>
          <LastOutcomeLine outcome={data.history.last_outcome} />
        </div>
      )}
      <div style={{ fontSize: 13, marginTop: 4 }}>
        {isAdmin
          ? "Check today's first rule to start."
          : "Waiting on the next attempt."}
      </div>
    </section>
  );
}

function LastOutcomeLine({
  outcome,
}: {
  outcome: NonNullable<
    Awaited<ReturnType<typeof getHomeData>>["history"]["last_outcome"]
  >;
}) {
  if (outcome.status === "completed") {
    return <>Last attempt completed on {outcome.date}.</>;
  }
  return (
    <>Last attempt failed on Day {outcome.day} ({outcome.date}).</>
  );
}

function SelectedDayPanel({
  data,
  selectedDiary,
  canEdit,
}: {
  data: Awaited<ReturnType<typeof getHomeData>>;
  selectedDiary: string;
  canEdit: boolean;
}) {
  const s = data.selected;
  const attempt = data.attempt;
  const isAdmin = data.is_admin;
  const dayLabel = s.day_num ? `Day ${s.day_num} · ${s.date}` : s.date;

  return (
    <div>
      <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 6 }}>
        {dayLabel}
      </h2>

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
