import Link from "next/link";
import { getHomeData, getDiary } from "@/lib/challenges";
import { Calendar } from "@/components/Calendar";
import { ChecklistRow } from "@/components/ChecklistRow";
import { DiaryEditor } from "@/components/DiaryEditor";
import { LockButton } from "@/components/LockButton";
import {
  StartAttemptButton,
  AbandonAttemptButton,
} from "@/components/AttemptControls";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string; d?: string }>;
}) {
  const sp = await searchParams;
  const data = await getHomeData({ ym: sp.ym, d: sp.d });

  const isAdmin = data.is_admin;
  const selectedIsToday = data.selected.is_today;
  const canEdit = isAdmin && selectedIsToday;

  // Diary content is admin-only; getDiary returns "" for non-admin.
  const selectedDiary = isAdmin ? await getDiary(data.selected.date) : "";

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

      <StatusLine data={data} />

      <hr />

      <Calendar
        ym={data.month.ym}
        label={data.month.label}
        cells={data.month.cells}
        selectedDate={data.selected.date}
        totalRules={data.rules.length}
      />

      <hr />

      <SelectedDayPanel
        data={data}
        selectedDiary={selectedDiary}
        canEdit={canEdit}
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
                  {g.note && (
                    <span style={{ opacity: 0.7 }}> — {g.note}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

    </main>
  );
}

function StatusLine({
  data,
}: {
  data: Awaited<ReturnType<typeof getHomeData>>;
}) {
  const attempt = data.attempt;
  const isAdmin = data.is_admin;

  if (!attempt) {
    return (
      <section style={{ margin: "12px 0" }}>
        <div style={{ fontWeight: 700 }}>No active attempt.</div>
        {data.history.last_outcome && (
          <LastOutcomeLine outcome={data.history.last_outcome} />
        )}
        {isAdmin && (
          <div style={{ marginTop: 8 }}>
            <StartAttemptButton />
          </div>
        )}
      </section>
    );
  }

  if (attempt.status === "active") {
    return (
      <section style={{ margin: "12px 0" }}>
        <div style={{ fontWeight: 700 }}>
          Day {attempt.current_day ?? "?"} / {attempt.target_days} — since{" "}
          {attempt.start_date}
        </div>
        {isAdmin && (
          <div style={{ marginTop: 8 }}>
            <AbandonAttemptButton />
          </div>
        )}
      </section>
    );
  }

  return (
    <section style={{ margin: "12px 0" }}>
      {attempt.status === "completed" && (
        <div style={{ fontWeight: 700 }}>
          Completed {attempt.target_days}/{attempt.target_days} ✓
        </div>
      )}
      {attempt.status === "failed" && (
        <div style={{ fontWeight: 700 }}>
          Failed on Day{" "}
          {attempt.failed_on_date
            ? // computed on the client since we already have start_date
              dayFromDates(attempt.start_date, attempt.failed_on_date)
            : "?"}
        </div>
      )}
      {isAdmin && (
        <div style={{ marginTop: 8 }}>
          <StartAttemptButton />
        </div>
      )}
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
    return (
      <div style={{ fontSize: 13 }}>
        Last attempt completed on {outcome.date}.
      </div>
    );
  }
  return (
    <div style={{ fontSize: 13 }}>
      Last attempt failed on Day {outcome.day} ({outcome.date}).
    </div>
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
  const dayLabel = s.day_num ? `Day ${s.day_num} · ${s.date}` : s.date;
  const isAdmin = data.is_admin;

  return (
    <section>
      <h2 style={{ fontSize: 16, marginTop: 0 }}>{dayLabel}</h2>

      {!s.in_attempt && (
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
            disabled={!canEdit || !s.in_attempt}
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
    </section>
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
