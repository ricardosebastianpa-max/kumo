/** Calendar math on plain YYYY-MM-DD strings (weeks start Monday). Pure. */
const pad = (n: number) => String(n).padStart(2, "0");
const toUtc = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return new Date(Date.UTC(y, m - 1, dd)); };
const fromUtc = (t: Date) => `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
export const addDays = (d: string, n: number) => { const t = toUtc(d); t.setUTCDate(t.getUTCDate() + n); return fromUtc(t); };
export const addMonths = (d: string, n: number) => { const t = toUtc(d.slice(0, 8) + "01"); t.setUTCMonth(t.getUTCMonth() + n); return fromUtc(t); };
export const weekStart = (d: string) => { const dow = (toUtc(d).getUTCDay() + 6) % 7; return addDays(d, -dow); };
export const monthStart = (d: string) => d.slice(0, 8) + "01";
export function monthGrid(d: string): string[] {
  const first = weekStart(monthStart(d));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}
export const weekDays = (d: string) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(d), i));
export function rangeFor(view: "month" | "week" | "agenda" | "year", d: string): [string, string] {
  if (view === "month") { const g = monthGrid(d); return [g[0], g[41]]; }
  if (view === "week") { const w = weekDays(d); return [w[0], w[6]]; }
  if (view === "year") return [`${d.slice(0, 4)}-01-01`, `${d.slice(0, 4)}-12-31`];
  return [d, addDays(d, 90)];
}
export const isIsoDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtc(s).getTime());
