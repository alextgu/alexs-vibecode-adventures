import Link from "next/link";
import { getChallengeHistory } from "@/lib/challenges";

export default async function ChallengesPage() {
  const history = await getChallengeHistory();

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/">← Back</Link>
      </div>
      <h1 style={{ marginTop: 0 }}>History</h1>

      {history.length === 0 && <p>No challenges yet.</p>}

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {history.map((c) => (
          <li
            key={c.id}
            style={{
              padding: "10px 0",
              borderBottom: "1px solid #000",
            }}
          >
            <Link href={`/challenges/${c.id}`}>
              <strong>{c.title}</strong>
            </Link>{" "}
            — started {c.start_date} —{" "}
            {c.status === "active" && "in progress"}
            {c.status === "completed" &&
              `completed ${c.target_days}/${c.target_days}`}
            {c.status === "failed" && `failed on Day ${c.outcome_day}`}
          </li>
        ))}
      </ul>
    </main>
  );
}
