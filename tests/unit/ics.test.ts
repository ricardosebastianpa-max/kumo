import { describe, expect, it } from "vitest";
import { buildIcs } from "@/lib/domain/ics";

const base = { updatedAt: new Date("2026-11-24T00:00:00Z"), confidence: "confirmed" as const };
describe("buildIcs", () => {
  const ics = buildIcs("Kumo · Ricardo", [
    { ...base, id: "a", title: "CSCA dic: abre el registro", startsAt: new Date("2026-11-25T07:00:00Z"), allDay: false, timezone: "Asia/Shanghai" },
    { ...base, id: "b", title: "Plazo; con, comas", startsAt: new Date("2026-11-29T16:00:00Z"), allDay: true, timezone: "Asia/Shanghai", confidence: "estimated" },
    { ...base, id: "c", title: "x".repeat(200), startsAt: new Date("2026-12-01T06:00:00Z"), allDay: true, timezone: "America/Managua" },
  ], { estimated: "estimado", unverified: "por verificar" });
  it("timed events in UTC", () => expect(ics).toContain("DTSTART:20261125T070000Z"));
  it("all-day uses the event's own zone (Shanghai midnight = previous UTC day)", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20261130");
    expect(ics).toContain("DTEND;VALUE=DATE:20261201");
  });
  it("escapes and marks estimated as tentative", () => {
    expect(ics).toContain("SUMMARY:(estimado) Plazo\; con\\, comas");
    expect(ics).toContain("STATUS:TENTATIVE");
  });
  it("uses CRLF and folds long lines", () => {
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });
});
