"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDailyGoal,
  updateDailyGoal,
  deleteDailyGoal,
  toggleDailyGoalToday,
  type DailyGoal,
} from "@/lib/daily-goals";

export function DailyGoalsSection({
  goals,
  isAdmin,
}: {
  goals: DailyGoal[];
  isAdmin: boolean;
}) {
  if (goals.length === 0 && !isAdmin) return null;

  const doneCount = goals.filter((g) => g.completed_today).length;

  return (
    <section
      style={{
        border: "1px solid #000",
        padding: "12px 16px",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <h2 style={{ fontSize: 14, margin: 0 }}>Daily goals — today</h2>
        {goals.length > 0 && (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {doneCount}/{goals.length}
          </div>
        )}
      </div>

      {goals.length === 0 && (
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
          No daily goals yet.
        </div>
      )}

      <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
        {goals.map((g) => (
          <DailyGoalRow key={g.id} goal={g} isAdmin={isAdmin} />
        ))}
      </ul>

      {isAdmin && <AddDailyGoalForm />}
    </section>
  );
}

function DailyGoalRow({
  goal,
  isAdmin,
}: {
  goal: DailyGoal;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [note, setNote] = useState(goal.note ?? "");

  const done = goal.completed_today;

  function onToggle() {
    if (!isAdmin) return;
    startTransition(async () => {
      const res = await toggleDailyGoalToday(goal.id);
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  }

  function onDelete() {
    if (!window.confirm(`Delete daily goal "${goal.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteDailyGoal(goal.id);
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  }

  function onSave() {
    startTransition(async () => {
      const res = await updateDailyGoal(goal.id, {
        title,
        note: note || null,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

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
          maxLength={500}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={onSave} disabled={pending}>
            {pending ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setTitle(goal.title);
              setNote(goal.note ?? "");
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

function AddDailyGoalForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length === 0) return;
    startTransition(async () => {
      const res = await createDailyGoal({
        title,
        note: note.trim().length > 0 ? note : undefined,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setTitle("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 8, display: "flex", gap: 6 }}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New daily goal"
        maxLength={200}
        style={{ flex: 1 }}
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note"
        maxLength={500}
        style={{ flex: 1 }}
      />
      <button type="submit" disabled={pending || title.trim().length === 0}>
        {pending ? "…" : "Add"}
      </button>
    </form>
  );
}
