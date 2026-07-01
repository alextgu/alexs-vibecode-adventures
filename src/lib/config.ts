// Personal config. Edit here, not in a UI.

export const ADMIN_EMAIL = "alexwin2099@gmail.com";
export const TITLE = "Hard 75 — Alex Version";
export const TARGET_DAYS = 75;
export const TIMEZONE = "America/Los_Angeles"; // IANA — edit to your zone

// The `diary` rule is special: it's auto-checked when today's diary has
// non-empty content. All other rules are manual checkboxes.
export const DIARY_RULE_ID = "diary";

export type Rule = { id: string; label: string; auto?: "diary" };

// Daily rules for the 75-day challenge.
export const RULES: Rule[] = [
  { id: "exercises", label: "2 exercises" },
  { id: "protein", label: "Hit protein goal" },
  { id: "learn", label: "Learn something new" },
  { id: "water", label: "Drink enough water" },
  { id: DIARY_RULE_ID, label: "Diary — happy + sad about today", auto: "diary" },
];

export type Goal = { id: string; title: string; note?: string };

// Long-term goals shown alongside the 75 challenge. Read-only display.
// Edit this list when your goals change.
export const GOALS: Goal[] = [
  // Add your goals here, e.g.:
  // { id: "shape", title: "Get in the best shape of my life" },
  // { id: "read10", title: "Read 10 books this year" },
];
