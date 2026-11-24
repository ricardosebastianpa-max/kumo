import { describe, expect, it } from "vitest";
import { planToday, type TodayItem } from "@/lib/domain/today";

const now = new Date("2026-11-24T16:00:00Z"); // 10:00 Managua
const tz = "America/Managua";
const mk = (id: string, iso: string, priority: TodayItem["priority"], extra: Partial<TodayItem> = {}): TodayItem =>
  ({ id, title: id, kind: "deadline", startsAt: new Date(iso), allDay: true, timezone: tz, priority, confidence: "confirmed", ...extra });

describe("planToday", () => {
  const items = [
    mk("far-critical", "2026-12-20T06:00:00Z", "critical"),
    mk("soon-critical", "2026-11-25T06:00:00Z", "critical"),
    mk("soon-medium", "2026-11-25T06:00:00Z", "medium"),
    mk("today-task", "2026-11-24T06:00:00Z", "medium", { kind: "task" }),
    mk("done", "2026-11-24T06:00:00Z", "critical", { done: true }),
    mk("est", "2026-11-30T06:00:00Z", "high", { confidence: "estimated" }),
  ];
  const r = planToday(items, now, tz);
  it("main is the most urgent open item", () => expect(r.main?.id).toBe("soon-critical"));
  it("at most 2 secondary", () => expect(r.secondary).toHaveLength(2));
  it("done items never appear", () => expect([r.main, ...r.secondary, ...r.agenda].some((i) => i?.id === "done")).toBe(false));
  it("agenda holds today's items", () => expect(r.agenda.map((i) => i.id)).toEqual(["today-task"]));
  it("flags estimated deadlines to verify", () => expect(r.alerts.find((a) => a.type === "verify")?.itemIds).toEqual(["est"]));
  it("detects a crowded 3-day window", () => {
    const crowd = planToday([mk("a", "2026-11-26T06:00:00Z", "high"), mk("b", "2026-11-27T06:00:00Z", "critical"), mk("c", "2026-11-28T06:00:00Z", "high")], now, tz);
    expect(crowd.alerts.find((a) => a.type === "cluster")?.itemIds).toEqual(["a", "b", "c"]);
  });
  it("all-day items keep their own zone's date (Shanghai midnight)", () => {
    const sh = mk("sh", "2026-11-24T16:00:00Z", "high", { timezone: "Asia/Shanghai" }); // 25 Nov 00:00 Beijing
    expect(planToday([sh], now, tz).agenda).toHaveLength(0);
  });
  it("empty input is calm", () => expect(planToday([], now, tz)).toMatchObject({ main: null, secondary: [], alerts: [] }));
});
