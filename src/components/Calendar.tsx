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
  goalsByDate,
  todosByDate,
}: {
  ym: string;
  label: string;
  cells: MonthCell[];
  selectedDate: string;
  totalRules: number;
  goalsByDate: Record<string, string[]>;
  todosByDate: Record<string, string[]>;
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
        <Link href={`/?ym=${prev}`}>← {monthShort(prev)}</Link>
        <div style={{ fontWeight: 700 }}>{label}</div>
        <Link href={`/?ym=${next}`}>{monthShort(next)} →</Link>
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
            goalTitles={goalsByDate[c.date] ?? []}
            todoTitles={todosByDate[c.date] ?? []}
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
  goalTitles,
  todoTitles,
}: {
  cell: MonthCell;
  selectedDate: string;
  ym: string;
  totalRules: number;
  goalTitles: string[];
  todoTitles: string[];
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

  if (day.is_today && bg === "#fff") {
    bg = "#fff5b8";
  }

  if (isSelected) {
    borderColor = "#000";
    borderWidth = 3;
  } else if (day.is_today) {
    borderColor = "#000";
    borderWidth = 3;
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 4,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: day.is_today ? 700 : 400 }}>
          {day_of_month}
        </span>
        {day.is_today && (
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 0.5,
              padding: "1px 4px",
              border: `1px solid ${fg}`,
              borderRadius: 3,
              lineHeight: 1,
            }}
          >
            TODAY
          </span>
        )}
      </div>
      <div
        style={{
          textAlign: "center",
          fontSize: mark.length > 1 ? 14 : 20,
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
      {in_month && (goalTitles.length > 0 || todoTitles.length > 0) && (
        <div
          style={{
            position: "absolute",
            left: 4,
            right: 4,
            bottom: 3,
            fontSize: 9,
            lineHeight: 1.15,
            fontWeight: 600,
            overflow: "hidden",
            opacity: 0.85,
          }}
        >
          {goalTitles.length > 0 && (
            <div
              title={goalTitles.join("\n")}
              style={{
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              ★ {goalTitles[0]}
              {goalTitles.length > 1 ? ` +${goalTitles.length - 1}` : ""}
            </div>
          )}
          {todoTitles.length > 0 && (
            <div
              title={todoTitles.join("\n")}
              style={{
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              ✓ {todoTitles[0]}
              {todoTitles.length > 1 ? ` +${todoTitles.length - 1}` : ""}
            </div>
          )}
        </div>
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
