"use client";

import { useEffect, useState, useTransition } from "react";
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
  const [savedValue, setSavedValue] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setValue(initial);
    setSavedValue(initial);
    setStatus("idle");
    setError(null);
  }, [date, initial]);

  function handleSave() {
    if (disabled || pending) return;
    setStatus("saving");
    startTransition(async () => {
      const res = await saveDiary(date, value);
      if (!res.ok) {
        setError(res.error);
        setStatus("error");
        return;
      }
      setSavedValue(value);
      setStatus("saved");
      setError(null);
      router.refresh();
    });
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

  const dirty = value !== savedValue;

  return (
    <div>
      <div style={{ marginBottom: 6, fontWeight: 700 }}>Diary</div>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (status === "saved") setStatus("idle");
        }}
        rows={8}
        style={{ width: "100%", resize: "vertical" }}
        placeholder="What happened today."
        maxLength={20000}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 4,
        }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !dirty}
        >
          Save
        </button>
        <div style={{ minHeight: 20, fontSize: 12 }}>
          {status === "saving" || pending ? "Saving…" : null}
          {status === "saved" && !pending && !dirty ? "Saved." : null}
          {status === "idle" && dirty ? "Unsaved changes." : null}
          {status === "error" ? `Error: ${error}` : null}
        </div>
      </div>
    </div>
  );
}
