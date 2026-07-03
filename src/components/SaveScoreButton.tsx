"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkRule, uncheckRule } from "@/lib/challenges";

export function SaveScoreButton({
  date,
  rules,
}: {
  date: string;
  rules: { id: string; checked: boolean }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (pending || rules.length === 0) return;
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      const results = await Promise.all(
        rules.map((r) =>
          r.checked ? checkRule(r.id, date) : uncheckRule(r.id, date),
        ),
      );
      const failed = results.find((r) => !r.ok);
      if (failed && !failed.ok) {
        setError(failed.error);
        setStatus("error");
        return;
      }
      setStatus("saved");
      router.refresh();
    });
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 16,
      }}
    >
      <button type="button" onClick={onClick} disabled={pending}>
        {pending ? "Saving…" : "Save score"}
      </button>
      <div style={{ fontSize: 12, minHeight: 20 }}>
        {status === "saved" && !pending ? "Saved." : null}
        {status === "error" ? `Error: ${error}` : null}
      </div>
    </div>
  );
}
