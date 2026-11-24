/**
 * "What matters now": ranks upcoming items by urgency = priority weight × closeness of the date.
 * Returns at most 1 main + 2 secondary items, the rest of the day's agenda, and calm alerts.
 */
import { dateInZone, daysBetween } from "./time";

export type Priority = "critical" | "high" | "medium" | "low";
export interface TodayItem {
  id: string; title: string; kind: string; startsAt: Date; allDay: boolean; timezone: string;
  priority: Priority; confidence: "confirmed" | "estimated" | "unverified"; done?: boolean;
}
export interface Alert { type: "verify" | "overdue" | "cluster"; itemIds: string[]; days?: number }

const W: Record<Priority, number> = { critical: 8, high: 4, medium: 2, low: 1 };
/** Local calendar date of an item as the user sees it (all-day items keep their own zone's date). */
export const itemDate = (i: Pick<TodayItem, "startsAt" | "allDay" | "timezone">, userTz: string) => dateInZone(i.startsAt, i.allDay ? i.timezone : userTz);

export function daysUntil(i: TodayItem, now: Date, userTz: string) {
  return daysBetween(dateInZone(now, userTz), itemDate(i, userTz));
}

export function urgency(i: TodayItem, now: Date, userTz: string): number {
  const d = daysUntil(i, now, userTz);
  if (d < 0) return W[i.priority] * 2; // overdue but not done: still matters, gently
  return W[i.priority] / (1 + d / 3);
}

export function planToday(items: TodayItem[], now: Date, userTz: string, horizonDays = 30) {
  const open = items.filter((i) => !i.done);
  const upcoming = open.filter((i) => { const d = daysUntil(i, now, userTz); return d >= -7 && d <= horizonDays; });
  const ranked = [...upcoming].sort((a, b) => urgency(b, now, userTz) - urgency(a, now, userTz) || a.startsAt.getTime() - b.startsAt.getTime());
  const [main, ...rest] = ranked;
  const secondary = rest.slice(0, 2);
  const today = dateInZone(now, userTz);
  const agenda = open.filter((i) => itemDate(i, userTz) === today).sort((a, b) => Number(a.allDay) - Number(b.allDay) || a.startsAt.getTime() - b.startsAt.getTime());

  const alerts: Alert[] = [];
  const verify = upcoming.filter((i) => i.confidence !== "confirmed" && ["deadline", "registration", "window", "exam"].includes(i.kind) && daysUntil(i, now, userTz) >= 0 && daysUntil(i, now, userTz) <= 21);
  if (verify.length) alerts.push({ type: "verify", itemIds: verify.map((i) => i.id) });
  const overdue = open.filter((i) => i.kind === "task" && daysUntil(i, now, userTz) < 0 && daysUntil(i, now, userTz) >= -14);
  if (overdue.length) alerts.push({ type: "overdue", itemIds: overdue.map((i) => i.id) });
  // Overload signal: 3+ high/critical items inside any 3-day window in the next 2 weeks.
  const hot = upcoming.filter((i) => (i.priority === "critical" || i.priority === "high") && daysUntil(i, now, userTz) >= 0 && daysUntil(i, now, userTz) <= 14)
    .map((i) => ({ i, d: daysUntil(i, now, userTz) })).sort((a, b) => a.d - b.d);
  for (let k = 0; k < hot.length; k++) {
    const win = hot.filter((h) => h.d >= hot[k].d && h.d <= hot[k].d + 2);
    if (win.length >= 3) { alerts.push({ type: "cluster", itemIds: win.map((h) => h.i.id), days: hot[k].d }); break; }
  }
  return { main: main ?? null, secondary, agenda, alerts };
}
