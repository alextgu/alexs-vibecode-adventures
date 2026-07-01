"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlock } from "@/lib/challenges";

export function UnlockForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await unlock(password);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPassword("");
      router.push("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 360 }}>
      <div style={{ marginBottom: 8 }}>Password</div>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        style={{ width: "100%", marginBottom: 8 }}
      />
      <button type="submit" disabled={pending}>
        {pending ? "Unlocking…" : "Unlock"}
      </button>
      {error && (
        <div style={{ marginTop: 8, fontSize: 13 }}>{error}</div>
      )}
    </form>
  );
}
