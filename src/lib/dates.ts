/**
 * Returns today's ISO date (YYYY-MM-DD) in the given IANA timezone.
 * Uses the server clock directly — NTP-synced on Vercel / Node hosts.
 */
export async function todayInTz(timeZone: string): Promise<string> {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

/** Adds `days` (may be negative) to an ISO date string. Returns YYYY-MM-DD. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Signed number of days between two ISO dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const at = Date.UTC(ay, am - 1, ad);
  const bt = Date.UTC(by, bm - 1, bd);
  return Math.round((bt - at) / (1000 * 60 * 60 * 24));
}

/** Returns dates [start, start+1, ..., start + count - 1]. */
export function dateRange(start: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(addDays(start, i));
  return out;
}

/** "YYYY-MM" → the previous month's "YYYY-MM". */
export function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const nm = m === 1 ? 12 : m - 1;
  const ny = m === 1 ? y - 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** "YYYY-MM" → the next month's "YYYY-MM". */
export function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

const IANA_TZ = /^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+){0,2}$/;

/** Coarse IANA timezone validation. Also verifies Intl accepts it. */
export function isValidTimezone(tz: string): boolean {
  if (typeof tz !== "string" || !IANA_TZ.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
