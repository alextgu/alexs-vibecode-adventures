"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkRule, uncheckRule } from "@/lib/challenges";

export function ChecklistRow({
  ruleId,
  label,
  date,
  checked,
  disabled,
  auto,
}: {
  ruleId: string;
  label: string;
  date: string;
  checked: boolean;
  disabled: boolean;
  auto?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inputDisabled = disabled || pending || auto === true;

  function toggle() {
    if (inputDisabled) return;
    startTransition(async () => {
      const fn = checked ? uncheckRule : checkRule;
      await fn(ruleId, date);
      router.refresh();
    });
  }

  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 0",
        cursor: inputDisabled ? "default" : "pointer",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={toggle}
        disabled={inputDisabled}
        aria-readonly={auto ? true : undefined}
      />
      <span style={{ textDecoration: checked ? "line-through" : "none" }}>
        {label}
        {auto && (
          <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.7 }}>
            (auto)
          </span>
        )}
      </span>
    </label>
  );
}
