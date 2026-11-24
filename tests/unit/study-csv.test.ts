import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseCsv, studyFromCsv } from "@/lib/seed/adapters/study-csv";

const read = (f: string) => readFileSync(`seed/csca-library/${f}`, "utf8");
describe("study CSV adapter", () => {
  it("parses quoted cells with commas", () => expect(parseCsv('a,"b, c","d ""e"""\n')[0]).toEqual(["a", "b, c", 'd "e"']));
  it("Ruta 0–100: 85 ordered steps with phase and focus", () => {
    const r = studyFromCsv(read("ruta-0-100.csv"))!;
    expect(r).toHaveLength(85);
    expect(r[0]).toMatchObject({ key: "route:1", kind: "route", position: 1, phase: "0 · Cimientos (sem 1–2)", source: "Profe Alex", urlIsSearch: true });
    expect(r[84].title).toContain("48 preguntas");
    expect(r[0].url).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=/);
  });
  it("Profundizar: every resource with topic and level; books get web search", () => {
    const r = studyFromCsv(read("profundizar.csv"))!;
    expect(r.length).toBe(107);
    const book = r.find((x) => x.source?.includes("OpenStax"))!;
    expect(book.url).toMatch(/google\.com\/search/);
    expect(new Set(r.map((x) => x.key)).size).toBe(r.length);
  });
  it("Canales y cursos", () => expect(studyFromCsv(read("canales.csv"))!).toHaveLength(34));
  it("unknown CSV → null", () => expect(studyFromCsv("x,y\n1,2\n")).toBeNull());
});
