import Link from "next/link";
import type { MonthCell } from "@/lib/challenges";
import { prevMonth, nextMonth } from "@/lib/dates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Calendar({
  ym,
  label,
  cells,
  selectedDate,
  totalRules,
}: {
  ym: string;
  label: string;
  cells: MonthCell[];
  selectedDate: string;
  totalRules: number;
}) {
  const prev = prevMonth(ym);
  const next = nextMonth(ym);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Link href={`/?ym=${prev}&d=${selectedDate}`}>← {monthShort(prev)}</Link>
        <div style={{ fontWeight: 700 }}>{label}</div>
        <Link href={`/?ym=${next}&d=${selectedDate}`}>{monthShort(next)} →</Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
        }}
      >
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            style={{ textAlign: "center", fontSize: 12, padding: "4px 0" }}
          >
            {w}
          </div>
        ))}

        {cells.map((c) => (
          <DayCell
            key={c.date}
            cell={c}
            selectedDate={selectedDate}
            ym={ym}
            totalRules={totalRules}
          />
        ))}
      </div>
    </div>
  );
}

function DayCell({
  cell,
  selectedDate,
  ym,
  totalRules,
}: {
  cell: MonthCell;
  selectedDate: string;
  ym: string;
  totalRules: number;
}) {
  const { day, day_of_month, in_month, date } = cell;
  const isSelected = date === selectedDate;

  let bg = "#fff";
  let fg = "#000";
  let mark = "";
  let borderColor = "#000";
  let borderWidth = 1;

  if (!in_month) {
    fg = "#bbb";
    borderColor = "#eee";
  } else if (day.failed) {
    bg = "#000";
    fg = "#fff";
    mark = "✗";
  } else if (day.in_attempt && day.all_checked) {
    bg = "#000";
    fg = "#fff";
    mark = "✓";
  } else if (day.in_attempt && !day.is_future) {
    mark = `${day.checked.length}/${totalRules}`;
  }

  if (isSelected) {
    borderColor = "#000";
    borderWidth = 3;
  } else if (day.is_today) {
    borderColor = "#000";
    borderWidth = 2;
  }

  return (
    <Link
      href={`/?ym=${ym}&d=${date}`}
      style={{
        display: "block",
        border: `${borderWidth}px solid ${borderColor}`,
        background: bg,
        color: fg,
        padding: "6px 4px",
        textDecoration: "none",
        minHeight: 56,
        position: "relative",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: day.is_today ? 700 : 400 }}>
        {day_of_month}
      </div>
      <div
        style={{
          textAlign: "center",
          fontSize: 14,
          marginTop: 6,
          fontWeight: 700,
        }}
      >
        {mark}
      </div>
      {day.has_diary && (
        <div
          title="Diary entry"
          style={{
            position: "absolute",
            right: 4,
            top: 4,
            width: 6,
            height: 6,
            borderRadius: 999,
            background: fg,
          }}
        />
      )}
    </Link>
  );
}

function monthShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}
