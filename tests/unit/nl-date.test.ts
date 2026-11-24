import { describe, expect, it } from "vitest";
import { parseCapture } from "@/lib/domain/nl-date";

// Tuesday 2026-11-24, 10:00 in Managua (16:00 UTC)
const now = new Date("2026-11-24T16:00:00Z");
const p = (s: string, tz = "America/Managua") => parseCapture(s, { now, timezone: tz });

describe("parseCapture", () => {
  it("spec example: examen IELTS el 14 de feb a las 8 am", () => {
    const r = p("examen IELTS el 14 de feb a las 8 am");
    expect(r).toMatchObject({ date: "2027-02-14", time: "08:00", kind: "exam", timezone: "America/Managua" });
    expect(r.title).toBe("examen IELTS");
  });
  it("viernes 3pm → next Friday 15:00", () => {
    expect(p("Llamar a admisiones viernes 3pm")).toMatchObject({ date: "2026-11-27", time: "15:00", title: "Llamar a admisiones", kind: "task" });
  });
  it("en 2 semanas", () => expect(p("Pedir carta en 2 semanas").date).toBe("2026-12-08"));
  it("28 feb hora de Pekín keeps the foreign zone", () => {
    expect(p("Plazo beca 28 feb hora de Pekín")).toMatchObject({ date: "2027-02-28", timezone: "Asia/Shanghai", kind: "deadline", title: "Plazo beca" });
  });
  it("mañana / tomorrow / hoy", () => {
    expect(p("Repasar física mañana").date).toBe("2026-11-25");
    expect(p("Study tomorrow 9am")).toMatchObject({ date: "2026-11-25", time: "09:00" });
    expect(p("hoy revisar portal").date).toBe("2026-11-24");
  });
  it("English month-day and ISO", () => {
    expect(p("SAT registration Mar 5").date).toBe("2027-03-05");
    expect(p("Visa appointment 2027-06-01 15:30")).toMatchObject({ date: "2027-06-01", time: "15:30" });
  });
  it("past dates roll to next year; explicit year wins", () => {
    expect(p("Algo 3 de enero").date).toBe("2027-01-03");
    expect(p("Algo 3 de enero de 2026").date).toBe("2026-01-03");
  });
  it("time only: today if still ahead, else tomorrow", () => {
    expect(p("Bloque de estudio a las 18:00").date).toBe("2026-11-24");
    expect(p("Bloque a las 7 am").date).toBe("2026-11-25");
  });
  it("nonsense dates are ignored, text is kept", () => {
    const r = p("Idea 31 de febrero");
    expect(r.date).toBeNull();
    expect(r.title).toContain("Idea");
  });
  it("12am / 12pm edge", () => {
    expect(p("x mañana 12 pm").time).toBe("12:00");
    expect(p("x mañana 12 am").time).toBe("00:00");
  });
});
