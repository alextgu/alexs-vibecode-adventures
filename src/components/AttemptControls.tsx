"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { abandonAttempt } from "@/lib/challenges";

export function AbandonAttemptButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (
      !window.confirm(
        "Abandon the current attempt? You'll have to restart from Day 1.",
      )
    )
      return;
    startTransition(async () => {
      const res = await abandonAttempt();
      if (!res.ok) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={onClick} disabled={pending}>
      {pending ? "…" : "Abandon"}
    </button>
  );
}
