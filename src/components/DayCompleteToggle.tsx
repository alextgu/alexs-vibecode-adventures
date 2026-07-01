"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markDayComplete, unmarkDayComplete } from "@/lib/challenges";

export function DayCompleteToggle({
  date,
  completed,
  disabled,
}: {
  date: string;
  completed: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (disabled) return;
    startTransition(async () => {
      const res = completed
        ? await unmarkDayComplete(date)
        : await markDayComplete(date);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  const bg = completed ? "#000" : "#fff";
  const fg = completed ? "#fff" : "#000";
  const label = completed ? "Day complete ✓" : "Mark day complete";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      style={{
        width: "100%",
        padding: "14px 16px",
        border: "2px solid #000",
        background: bg,
        color: fg,
        fontWeight: 700,
        fontSize: 16,
        cursor: disabled ? "default" : "pointer",
        opacity: pending ? 0.6 : disabled ? 0.5 : 1,
      }}
    >
      {pending ? "…" : label}
    </button>
  );
}
