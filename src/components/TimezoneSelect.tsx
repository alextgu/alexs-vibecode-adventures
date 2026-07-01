"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTimezone } from "@/lib/profile";

const COMMON_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Athens",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function TimezoneSelect({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const options = COMMON_TIMEZONES.includes(initial)
    ? COMMON_TIMEZONES
    : [initial, ...COMMON_TIMEZONES];

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await setTimezone(value);
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      setMsg("Saved.");
      router.refresh();
    });
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>Timezone (IANA)</div>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ marginRight: 8 }}
      >
        {options.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>
      <button type="button" onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
      {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
      <p style={{ marginTop: 12, fontSize: 13 }}>
        This determines when a day rolls over. Changing your timezone applies to
        future challenges only — active challenges keep their original setting.
      </p>
    </div>
  );
}
