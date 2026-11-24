/** Display helpers shared by server and client components. */
export function fmtDay(at: Date, tz: string, locale: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: tz }).format(at);
}
export function fmtTime(at: Date, tz: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: tz }).format(at);
}
/** "mié 25 nov · 01:00" in the user's zone, plus the original zone line when it differs. */
export function fmtWhen(e: { startsAt: Date; allDay: boolean; timezone: string }, userTz: string, locale: string) {
  if (e.allDay) return { main: fmtDay(e.startsAt, e.timezone, locale), original: null as string | null };
  const main = `${fmtDay(e.startsAt, userTz, locale)} · ${fmtTime(e.startsAt, userTz, locale)}`;
  const original = e.timezone !== userTz ? `${fmtTime(e.startsAt, e.timezone, locale)} ${e.timezone.split("/").pop()!.replace(/_/g, " ")}` : null;
  return { main, original };
}
export const zoneCity = (tz: string) => tz.split("/").pop()!.replace(/_/g, " ");
