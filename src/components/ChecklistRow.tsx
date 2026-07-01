"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkRule, uncheckRule } from "@/lib/challenges";

export function ChecklistRow({
  challengeId,
  ruleId,
  label,
  date,
  checked,
}: {
  challengeId: string;
  ruleId: string;
  label: string;
  date: string;
  checked: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const fn = checked ? uncheckRule : checkRule;
      await fn(challengeId, ruleId, date);
      router.refresh();
    });
  }

  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        cursor: pending ? "wait" : "pointer",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={toggle}
        disabled={pending}
      />
      <span
        style={{
          textDecoration: checked ? "line-through" : "none",
        }}
      >
        {label}
      </span>
    </label>
  );
}
