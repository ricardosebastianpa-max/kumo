/**
 * Adapter: study-library spreadsheets exported as CSV (Ruta 0–100 / Profundizar / Canales y cursos).
 * The sheet is recognised by its header row, never by file name. The sheets carry titles but no URLs,
 * so each resource gets a search link (YouTube for videos and channels, web search otherwise),
 * flagged `urlIsSearch` so the student can replace it with the exact link.
 */
export interface StudyResourceIn {
  key: string; kind: "route" | "deep" | "channel"; position: number; phase?: string; topic?: string; level?: string; lang?: string;
  title: string; source?: string; type?: string; focus?: string; url: string; urlIsSearch: boolean; done?: boolean;
}

/** RFC 4180 CSV → rows (quotes, escaped quotes, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && src[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const VIDEO = /video|playlist|canal|clase|intuici|reto/i;
const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
const web = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const slug = (s: string, n = 60) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, n);
const bool = (s: string | undefined) => /^(true|✓|x|sí|si|yes|1)$/i.test((s ?? "").trim());
const t = (s: string | undefined) => (s ?? "").trim() || undefined;

export function studyFromCsv(text: string): StudyResourceIn[] | null {
  const rows = parseCsv(text);
  const hi = rows.findIndex((r) => r.some((c) => c.trim() === "#") && r.some((c) => c.trim() === "Fase"));
  if (hi >= 0) { // Ruta 0–100
    const h = rows[hi].map((c) => c.trim());
    const col = (n: string) => h.indexOf(n);
    return rows.slice(hi + 1).filter((r) => /^\d+$/.test((r[col("#")] ?? "").trim()) && t(r[col("Link")])).map((r) => {
      const n = Number(r[col("#")]); const title = r[col("Link")].trim(); const source = t(r[col("Profe / canal")]); const type = t(r[col("Tipo")]);
      const isVideo = !type || /video|playlist/i.test(type);
      return { key: `route:${n}`, kind: "route" as const, position: n, phase: t(r[col("Fase")]), topic: t(r[col("Tema")]), title, source, type, focus: t(r[col("Qué hacer / foco CSCA")]),
        url: isVideo ? yt(`${title} ${source ?? ""}`) : web(`${title} ${source ?? ""}`), urlIsSearch: true, done: bool(r[col("✓")]) };
    });
  }
  const di = rows.findIndex((r) => r.some((c) => c.trim() === "Tema") && r.some((c) => c.trim() === "Nivel"));
  if (di >= 0) { // Profundizar
    const h = rows[di].map((c) => c.trim()); const col = (n: string) => h.indexOf(n);
    return rows.slice(di + 1).filter((r) => t(r[col("Recurso")])).map((r, i) => {
      const title = r[col("Recurso")].trim(); const source = t(r[col("Canal / fuente")]); const level = t(r[col("Nivel")]);
      const isVideo = VIDEO.test(level ?? "") && !/libro/i.test(level ?? "") && !/openstax|khan|geogebra|desmos|fisicalab|physics classroom|paul|aops/i.test(source ?? "");
      return { key: `deep:${slug(`${r[col("Tema")]}-${title}-${source ?? ""}`, 140)}`, kind: "deep" as const, position: i + 1, topic: t(r[col("Tema")]), level, lang: t(r[col("Idioma")]), title, source, focus: t(r[col("Para qué")]),
        url: isVideo ? yt(`${title} ${source ?? ""}`) : web(`${title} ${source ?? ""}`), urlIsSearch: true, done: bool(r[col("✓")]) };
    });
  }
  const ci = rows.findIndex((r) => r[0]?.trim() === "Canal / sitio");
  if (ci >= 0) { // Canales y cursos
    return rows.slice(ci + 1).filter((r) => t(r[0])).map((r, i) => {
      const title = r[0].trim(); const site = /web|sitio|libros|ejercicios|simulaciones|herramientas|curso/i.test(`${r[2]} ${r[4]}`);
      return { key: `channel:${slug(title)}`, kind: "channel" as const, position: i + 1, lang: t(r[1]), topic: t(r[2]), title, focus: t(r[3]), type: t(r[4]),
        url: site ? web(title) : yt(title), urlIsSearch: true };
    });
  }
  return null;
}
