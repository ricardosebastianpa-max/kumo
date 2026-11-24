import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { convertCentro, type CentroFiles } from "./adapters/centro-v0";

/** Reads a Centro v0 data/ folder from disk (server-side scripts and tests only). */
export function readCentroFolder(dir: string): CentroFiles {
  const r = (f: string) => (existsSync(join(dir, f)) ? JSON.parse(readFileSync(join(dir, f), "utf8")) : undefined);
  return {
    profile: r("profile.json"), universities: r("universities_china.json"), scholarshipsGlobal: r("scholarships_global.json"),
    localScholarships: r("china_local_scholarships.json"), cscaSessions: r("csca_sessions.json"), events: r("events.json"),
    chineseRoute: r("china_chinese_taught_route.json"), studyPlan: r("study_plan.json"), checklist: r("application_checklist_template.json"), model: r("model.json"),
  };
}
export const loadCentroPack = (dir: string, meta = { slug: "centro-v0", version: "1", title: "Centro de Control" }) => convertCentro(readCentroFolder(dir), meta);
