// Personal config. Edit here, not in a UI.

export const TITLE = "Alex Calendar";
export const TARGET_DAYS = 75;
export const TIMEZONE = "America/Los_Angeles"; // IANA — edit to your zone

// The `diary` rule is auto-checked when the diary has non-empty content.
export const DIARY_RULE_ID = "diary";

export type Rule = { id: string; label: string; auto?: "diary" };

// Daily rules. A day counts toward the streak only when ALL are checked.
// The score shown on each calendar cell = count checked / total.
// Changing this list works, but past days keep whatever checks they had —
// the streak logic uses the current RULES list, so removing a rule can
// retroactively "complete" older days.
export const RULES: Rule[] = [
  { id: "exercises", label: "2 exercises" },
  { id: "protein", label: "Hit protein goal" },
  { id: "learn", label: "Learn something new" },
  { id: "water", label: "Drink enough water" },
  { id: DIARY_RULE_ID, label: "Diary — happy + sad about today", auto: "diary" },
];
