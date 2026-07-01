import Link from "next/link";
import { notFound } from "next/navigation";
import { getChallenge } from "@/lib/challenges";
import { addDays } from "@/lib/dates";

export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const challenge = await getChallenge(id);
  if (!challenge) notFound();

  const ruleCount = challenge.rules.length;
  const outcomeLimit =
    challenge.status === "failed" && challenge.failed_on_date
      ? Math.min(
          challenge.target_days,
          // days from start to failed_on_date inclusive
          (function () {
            const [sy, sm, sd] = challenge.start_date.split("-").map(Number);
            const [fy, fm, fd] = challenge.failed_on_date!.split("-").map(Number);
            return (
              Math.round(
                (Date.UTC(fy, fm - 1, fd) - Date.UTC(sy, sm - 1, sd)) /
                  (1000 * 60 * 60 * 24),
              ) + 1
            );
          })(),
        )
      : challenge.target_days;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/challenges">← History</Link>
      </div>

      <h1 style={{ marginTop: 0 }}>{challenge.title}</h1>
      <div style={{ marginBottom: 8 }}>
        Started {challenge.start_date} · {challenge.target_days} days ·{" "}
        {challenge.timezone}
      </div>
      <div style={{ marginBottom: 24, fontWeight: 700 }}>
        {challenge.status === "active" && "Active"}
        {challenge.status === "completed" &&
          `Completed on ${challenge.completed_at?.slice(0, 10) ?? ""}`}
        {challenge.status === "failed" &&
          `Failed on Day ${challenge.outcome_day} (${challenge.failed_on_date})`}
      </div>

      <h2 style={{ fontSize: 16 }}>Rules</h2>
      <ol style={{ paddingLeft: 20, marginTop: 4 }}>
        {challenge.rules.map((r) => (
          <li key={r.id}>{r.label}</li>
        ))}
      </ol>

      <h2 style={{ fontSize: 16 }}>Days</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
          gap: 4,
          marginTop: 8,
        }}
      >
        {Array.from({ length: outcomeLimit }, (_, i) => {
          const date = addDays(challenge.start_date, i);
          const checked = challenge.checks[date]?.length ?? 0;
          const passed = checked >= ruleCount && ruleCount > 0;
          const isFailDay =
            challenge.status === "failed" &&
            date === challenge.failed_on_date;
          return (
            <div
              key={date}
              title={`${date} — ${checked}/${ruleCount}`}
              style={{
                border: "1px solid #000",
                padding: "6px 4px",
                textAlign: "center",
                background: passed ? "#000" : "#fff",
                color: passed ? "#fff" : "#000",
                fontWeight: isFailDay ? 700 : 400,
              }}
            >
              <div style={{ fontSize: 11 }}>Day {i + 1}</div>
              <div style={{ fontSize: 11 }}>
                {passed ? "✓" : isFailDay ? "✗" : `${checked}/${ruleCount}`}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
