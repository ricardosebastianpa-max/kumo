/**
 * Deterministic weekly study planner. Spreads each subject's weekly hours across the days as
 * 50-minute blocks (+10 min break), only inside the day window, never overlapping busy times,
 * at most `maxPerDay` blocks a day, and never in the past. Same input → same plan.
 */
import { zonedToUtc } from "./time";
import { addDays } from "./calendar";

export interface Block { subject: string; label: string; start: Date; end: Date }
export function planWeek(o: {
  startDate: string; days: number; timezone: string; weeklyHours: Record<string, number>; busy: { start: Date; end: Date }[];
  now: Date; dayStartH?: number; dayEndH?: number; blockMin?: number; breakMin?: number; maxPerDay?: number;
}): Block[] {
  const { dayStartH = 7, dayEndH = 22, blockMin = 50, breakMin = 10, maxPerDay = 4 } = o;
  const remaining = Object.entries(o.weeklyHours).filter(([, h]) => h > 0).map(([k, h]) => ({ k, left: Math.round((h * 60) / blockMin) })).sort((a, b) => b.left - a.left || a.k.localeCompare(b.k));
  const busy = [...o.busy];
  const out: Block[] = [];
  const label = (k: string) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  for (let d = 0; d < o.days; d++) {
    const day = addDays(o.startDate, d);
    let placed = 0, rr = d; // rotate which subject starts each day
    for (let h = dayStartH * 60; h + blockMin <= dayEndH * 60 && placed < maxPerDay; h += blockMin + breakMin) {
      const start = zonedToUtc(day, `${String(Math.floor(h / 60)).padStart(2, "0")}:${String(h % 60).padStart(2, "0")}`, o.timezone);
      const end = new Date(start.getTime() + blockMin * 60000);
      if (start < o.now || busy.some((b) => b.start < end && b.end > start)) continue;
      const open = remaining.filter((r) => r.left > 0);
      if (!open.length) return out;
      const pick = open[rr++ % open.length];
      if (out.some((b) => b.subject === pick.k && b.start.toISOString().slice(0, 10) === start.toISOString().slice(0, 10)) && open.length > 1) { h -= blockMin + breakMin; if (++rr > open.length * 2) break; continue; }
      pick.left--; placed++;
      out.push({ subject: pick.k, label: label(pick.k), start, end });
      busy.push({ start, end });
    }
  }
  return out;
}
