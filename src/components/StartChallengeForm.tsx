"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startChallenge } from "@/lib/challenges";

export function StartChallengeForm() {
  const router = useRouter();
  const [title, setTitle] = useState("Hard 75");
  const [targetDays, setTargetDays] = useState(75);
  const [rules, setRules] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateRule(i: number, value: string) {
    setRules((r) => r.map((v, idx) => (idx === i ? value : v)));
  }
  function addRule() {
    setRules((r) => [...r, ""]);
  }
  function removeRule(i: number) {
    setRules((r) => (r.length === 1 ? r : r.filter((_, idx) => idx !== i)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await startChallenge({
        title,
        target_days: targetDays,
        rules: rules.map((r) => r.trim()).filter((r) => r.length > 0),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 520 }}>
      <h2 style={{ margin: "0 0 16px" }}>Start a challenge</h2>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 4 }}>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%" }}
          maxLength={80}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 4 }}>Days</label>
        <input
          type="number"
          value={targetDays}
          onChange={(e) => setTargetDays(Number(e.target.value))}
          min={1}
          max={365}
          style={{ width: 100 }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 4 }}>Rules (all must be checked every day)</div>
        {rules.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <input
              type="text"
              value={r}
              onChange={(e) => updateRule(i, e.target.value)}
              placeholder={`Rule ${i + 1}`}
              style={{ flex: 1 }}
              maxLength={120}
            />
            <button
              type="button"
              onClick={() => removeRule(i)}
              disabled={rules.length === 1}
              aria-label="Remove rule"
            >
              −
            </button>
          </div>
        ))}
        <button type="button" onClick={addRule}>
          + Add rule
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 12, color: "#000", fontWeight: 700 }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={pending}>
        {pending ? "Starting…" : "Start"}
      </button>
    </form>
  );
}
