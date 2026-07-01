import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, UserButton } from "@clerk/nextjs";
import {
  getActiveChallenge,
  getChallengeHistory,
  type ChallengeSummary,
} from "@/lib/challenges";
import { StartChallengeForm } from "@/components/StartChallengeForm";
import { ChecklistRow } from "@/components/ChecklistRow";
import { AbandonButton } from "@/components/AbandonButton";

export default async function Home() {
  const { userId } = await auth();

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22 }}>Hard 75</h1>
        <nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {userId ? (
            <>
              <Link href="/challenges">History</Link>
              <Link href="/settings">Settings</Link>
              <UserButton />
            </>
          ) : (
            <SignInButton mode="modal">
              <button type="button">Sign in</button>
            </SignInButton>
          )}
        </nav>
      </header>

      <hr />

      {!userId ? (
        <SignedOutHero />
      ) : (
        <SignedInHub />
      )}
    </main>
  );
}

function SignedOutHero() {
  return (
    <section>
      <h2 style={{ marginTop: 0 }}>75 days. Every rule. Every day.</h2>
      <p>
        Define your own daily rules. Check them all off every day for 75 days
        straight. Miss one and you restart.
      </p>
      <p>Sign in to start.</p>
    </section>
  );
}

async function SignedInHub() {
  const active = await getActiveChallenge();

  if (active) {
    const done = active.today_checks.length;
    const total = active.rules.length;
    const allDone = done === total;

    return (
      <section>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{active.title}</div>
          <div>
            Day {active.current_day} / {active.target_days} —{" "}
            {done}/{total} today
            {allDone ? " ✓" : ""}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          {active.rules.map((r) => (
            <ChecklistRow
              key={r.id}
              challengeId={active.id}
              ruleId={r.id}
              label={r.label}
              date={active.today}
              checked={active.today_checks.includes(r.id)}
            />
          ))}
        </div>

        {allDone && (
          <div style={{ margin: "12px 0", fontWeight: 700 }}>
            Day {active.current_day} complete.
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <AbandonButton challengeId={active.id} />
        </div>
      </section>
    );
  }

  const history = await getChallengeHistory();
  const mostRecent = history[0];

  return (
    <section>
      {mostRecent && (
        <div style={{ marginBottom: 24 }}>
          <PostStateBadge attempt={mostRecent} />
        </div>
      )}
      <StartChallengeForm />
    </section>
  );
}

function PostStateBadge({ attempt }: { attempt: ChallengeSummary }) {
  if (attempt.status === "completed") {
    return (
      <div>
        <div style={{ fontWeight: 700 }}>
          {attempt.title} · {attempt.target_days}/{attempt.target_days} ✓
        </div>
        <div>
          Completed
          {attempt.completed_at
            ? ` on ${attempt.completed_at.slice(0, 10)}`
            : ""}
          .
        </div>
      </div>
    );
  }
  if (attempt.status === "failed") {
    return (
      <div>
        <div style={{ fontWeight: 700 }}>
          {attempt.title} · failed on Day {attempt.outcome_day}
        </div>
        <div>Start over below.</div>
      </div>
    );
  }
  return null;
}
