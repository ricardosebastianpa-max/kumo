import { expect, it } from "vitest";
import { planWeek } from "@/lib/domain/scheduler";
it("plans blocks without overlaps, inside the day window, deterministically", () => {
  const busy = [{ start: new Date("2026-11-25T14:00:00Z"), end: new Date("2026-11-25T18:00:00Z") }];
  const o = { startDate: "2026-11-25", days: 7, timezone: "America/Managua", weeklyHours: { csca_math: 8, csca_physics: 5, english_test: 4 }, busy, now: new Date("2026-11-25T06:00:00Z") };
  const a = planWeek(o), b = planWeek(o);
  expect(a).toEqual(b);
  expect(a.length).toBeGreaterThan(10);
  for (const x of a) expect(busy.some((z) => z.start < x.end && z.end > x.start)).toBe(false);
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) expect(a[i].start < a[j].end && a[j].start < a[i].end).toBe(false);
});
