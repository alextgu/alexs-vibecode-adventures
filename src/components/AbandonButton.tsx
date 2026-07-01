"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { abandonChallenge } from "@/lib/challenges";

export function AbandonButton({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const ok = window.confirm(
      "Abandon this challenge? It will be marked as failed today and you'll have to restart.",
    );
    if (!ok) return;
    startTransition(async () => {
      await abandonChallenge(challengeId);
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={onClick} disabled={pending}>
      {pending ? "Abandoning…" : "Abandon"}
    </button>
  );
}
