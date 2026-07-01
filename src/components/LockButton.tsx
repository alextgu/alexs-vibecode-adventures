"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { lock } from "@/lib/challenges";

export function LockButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await lock();
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={onClick} disabled={pending}>
      {pending ? "…" : "Lock"}
    </button>
  );
}
