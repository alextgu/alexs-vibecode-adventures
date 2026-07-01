"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleDailyGoalToday, type DailyGoal } from "@/lib/daily-goals";

/**
 * Renders the daily-goals list for a specific day inside the modal.
 * Editable only when `canEdit` is true (admin AND date === today).
 * On non-today, the checkboxes are read-only status.
 */
export function DailyGoalsInModal({
  goals,
  canEdit,
}: {
  goals: DailyGoal[];
  canEdit: boolean;
}) {
  if (goals.length === 0) return null;
  const doneCount = goals.filter((g) => g.completed).length;

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <div style={{ fontWeight: 700 }}>Daily goals</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {doneCount}/{goals.length}
        </div>
      </div>
      <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
        {goals.map((g) => (
          <Row key={g.id} goal={g} canEdit={canEdit} />
        ))}
      </ul>
    </div>
  );
}

function Row({ goal, canEdit }: { goal: DailyGoal; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onToggle() {
    if (!canEdit) return;
    startTransition(async () => {
      const res = await toggleDailyGoalToday(goal.id);
      if (!res.ok) alert(res.error);
      router.refresh();
    });
  }

  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 0",
      }}
    >
      <input
        type="checkbox"
        checked={goal.completed}
        onChange={onToggle}
        disabled={!canEdit || pending}
      />
      <span
        style={{
          fontSize: 14,
          textDecoration: goal.completed ? "line-through" : "none",
        }}
      >
        {goal.title}
      </span>
    </li>
  );
}
