/** Time-zone helpers built on Intl only (no runtime deps). All storage is UTC + original IANA zone. */

/** Offset in minutes of `tz` at the given UTC instant (e.g. Asia/Shanghai → +480). */
export function tzOffsetMinutes(tz: string, at: Date): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Wall-clock date (YYYY-MM-DD) and time (HH:mm) in `tz` → UTC Date. */
export function zonedToUtc(date: string, time: string | null, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMinutes(tz, new Date(guess));
  const t = guess - off1 * 60000;
  const off2 = tzOffsetMinutes(tz, new Date(t)); // handles DST edges
  return new Date(guess - off2 * 60000);
}

/** YYYY-MM-DD of a UTC instant as seen in `tz`. */
export function dateInZone(at: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

const dayNum = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y, m - 1, dd) / 86400000; };
/** Whole days from `fromDate` to `toDate` (both YYYY-MM-DD). */
export function daysBetween(fromDate: string, toDate: string): number {
  return Math.round(dayNum(toDate) - dayNum(fromDate));
}

export function isValidTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
}
