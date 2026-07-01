"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDiary } from "@/lib/challenges";

export function DiaryEditor({
  date,
  initial,
  disabled,
}: {
  date: string;
  initial: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when the date changes.
  useEffect(() => {
    setValue(initial);
    setStatus("idle");
    setError(null);
  }, [date, initial]);

  function scheduleSave(next: string) {
    if (disabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setStatus("saving");
      startTransition(async () => {
        const res = await saveDiary(date, next);
        if (!res.ok) {
          setError(res.error);
          setStatus("error");
          return;
        }
        setStatus("saved");
        setError(null);
        router.refresh();
      });
    }, 800);
  }

  if (disabled) {
    return (
      <div>
        <div style={{ marginBottom: 6, fontWeight: 700 }}>Diary</div>
        {initial.trim().length === 0 ? (
          <div style={{ opacity: 0.6 }}>(no entry)</div>
        ) : (
          <div style={{ whiteSpace: "pre-wrap" }}>{initial}</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 6, fontWeight: 700 }}>Diary</div>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          scheduleSave(e.target.value);
        }}
        rows={8}
        style={{ width: "100%", resize: "vertical" }}
        placeholder="What happened today."
        maxLength={20000}
      />
      <div style={{ minHeight: 20, marginTop: 4, fontSize: 12 }}>
        {status === "saving" || pending ? "Saving…" : null}
        {status === "saved" && !pending ? "Saved." : null}
        {status === "error" ? `Error: ${error}` : null}
      </div>
    </div>
  );
}
