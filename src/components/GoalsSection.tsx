"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createGoal,
  updateGoal,
  toggleGoalCompleted,
  deleteGoal,
  type Goal,
} from "@/lib/goals";

export function GoalsSection({
  goals,
  isAdmin,
}: {
  goals: Goal[];
  isAdmin: boolean;
}) {
  if (goals.length === 0 && !isAdmin) return null;

  return (
    <section
      style={{
        border: "1px solid #000",
        padding: "12px 16px",
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 14, margin: "0 0 8px" }}>Goals</h2>

      {goals.length === 0 && (
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
          No goals yet.
        </div>
      )}

      <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
        {goals.map((g) => (
          <GoalRow key={g.id} goal={g} isAdmin={isAdmin} />
        ))}
      </ul>

      {isAdmin && <AddGoalForm />}
    </section>
  );
}

function GoalRow({ goal, isAdmin }: { goal: Goal; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [note, setNote] = useState(goal.note ?? "");
  const [targetDate, setTargetDate] = useState(goal.target_date ?? "");

  function onToggle() {
    startTransition(async () => {
      const res = await toggleGoalCompleted(goal.id);
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  }

  function onDelete() {
    if (!window.confirm(`Delete "${goal.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteGoal(goal.id);
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  }

  function onSave() {
    startTransition(async () => {
      const res = await updateGoal(goal.id, {
        title,
        note: note || null,
        target_date: targetDate || null,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  const done = !!goal.completed_at;

  if (editing) {
    return (
      <li
        style={{
          padding: "8px 0",
          borderBottom: "1px solid #eee",
        }}
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%", marginBottom: 6 }}
          maxLength={200}
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          style={{ width: "100%", marginBottom: 6 }}
          maxLength={1000}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            marginBottom: 6,
          }}
        >
          <span style={{ opacity: 0.7 }}>Target date</span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
          {targetDate && (
            <button
              type="button"
              onClick={() => setTargetDate("")}
              style={{ fontSize: 12, padding: "2px 6px" }}
            >
              Clear
            </button>
          )}
        </label>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={onSave} disabled={pending}>
            {pending ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTitle(goal.title);
              setNote(goal.note ?? "");
              setTargetDate(goal.target_date ?? "");
              setEditing(false);
            }}
            disabled={pending}
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 0",
        borderBottom: "1px solid #eee",
      }}
    >
      {isAdmin ? (
        <input
          type="checkbox"
          checked={done}
          onChange={onToggle}
          disabled={pending}
        />
      ) : (
        <span style={{ width: 18, textAlign: "center" }}>
          {done ? "✓" : "·"}
        </span>
      )}
      <div style={{ flex: 1, fontSize: 14 }}>
        <span style={{ textDecoration: done ? "line-through" : "none" }}>
          {goal.title}
        </span>
        {goal.note && (
          <span style={{ opacity: 0.7 }}> — {goal.note}</span>
        )}
        {goal.target_date && (
          <span style={{ opacity: 0.7 }}> · by {goal.target_date}</span>
        )}
      </div>
      {isAdmin && (
        <>
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{ fontSize: 12, padding: "2px 6px" }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            style={{ fontSize: 12, padding: "2px 6px" }}
          >
            ×
          </button>
        </>
      )}
    </li>
  );
}

function AddGoalForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length === 0) return;
    startTransition(async () => {
      const res = await createGoal({
        title,
        note: note.trim().length > 0 ? note : undefined,
        target_date: targetDate || null,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setTitle("");
      setNote("");
      setTargetDate("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New goal"
        maxLength={200}
        style={{ flex: "1 1 160px" }}
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note"
        maxLength={1000}
        style={{ flex: "1 1 160px" }}
      />
      <input
        type="date"
        value={targetDate}
        onChange={(e) => setTargetDate(e.target.value)}
        aria-label="Target date"
      />
      <button type="submit" disabled={pending || title.trim().length === 0}>
        {pending ? "…" : "Add"}
      </button>
    </form>
  );
}
