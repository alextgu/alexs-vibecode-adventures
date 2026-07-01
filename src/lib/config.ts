// Personal config. Edit here, not in a UI.

export const TITLE = "Alex Calendar";
export const TARGET_DAYS = 75;
export const TIMEZONE = "America/Los_Angeles"; // IANA — edit to your zone

// The reminder shown in the day modal. Rewrite this whenever the standard
// changes — history stays valid because we only store "day complete" per day,
// not per-rule.
export const DESCRIPTION = [
  "Everything means all of the following, every day:",
  "• 2 exercises",
  "• Hit protein goal",
  "• Learn something new",
  "• Drink enough water",
  "• Write in the diary — happy + sad about today",
].join("\n");

export type Goal = { id: string; title: string; note?: string };

// Long-term goals shown alongside the challenge. Read-only display.
export const GOALS: Goal[] = [
  // { id: "shape", title: "Get in the best shape of my life" },
  // { id: "read10", title: "Read 10 books this year" },
];
