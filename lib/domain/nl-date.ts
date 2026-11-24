/**
 * Natural-language date/time parsing for quick capture, in Spanish and English.
 * Pure and deterministic: `now` and the user's zone are inputs. Returns the wall-clock date/time,
 * the zone it is expressed in (e.g. "hora de Pekín" → Asia/Shanghai) and the remaining title text.
 *
 * Supported: hoy/mañana/pasado mañana, today/tomorrow, weekdays ("viernes", "next friday"),
 * "en 2 semanas", "in 3 days", "28 feb", "14 de febrero", "feb 14", "2027-03-01", "3pm", "15:30",
 * "a las 8 am", "at 9", and zone hints ("hora de Pekín", "Beijing time", "hora de Managua", "UTC").
 */
import { dateInZone } from "./time";

export interface ParsedCapture {
  title: string;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:mm
  timezone: string; // zone the date/time are expressed in
  kind: "exam" | "deadline" | "registration" | "task" | "event";
  matched: string[]; // pieces of the input that were understood
}

const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1, feb: 2, febrero: 2, february: 2, mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4, may: 5, mayo: 5, jun: 6, junio: 6, june: 6, jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8, sep: 9, sept: 9, septiembre: 9, setiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10, nov: 11, noviembre: 11, november: 11, dic: 12, diciembre: 12, dec: 12, december: 12,
};
const WEEKDAYS: Record<string, number> = {
  domingo: 0, sunday: 0, sun: 0, lunes: 1, monday: 1, mon: 1, martes: 2, tuesday: 2, tue: 2,
  "miércoles": 3, miercoles: 3, wednesday: 3, wed: 3, jueves: 4, thursday: 4, thu: 4,
  viernes: 5, friday: 5, fri: 5, "sábado": 6, sabado: 6, saturday: 6, sat: 6,
};
const ZONES: [RegExp, string][] = [
  [/\b(?:hora\s+de\s+)?(?:pek[ií]n|beijing|china|shanghai)(?:\s+time)?\b/i, "Asia/Shanghai"],
  [/\b(?:hora\s+de\s+)?(?:hong\s*kong)(?:\s+time)?\b/i, "Asia/Hong_Kong"],
  [/\b(?:hora\s+de\s+)?(?:managua|nicaragua)(?:\s+time)?\b/i, "America/Managua"],
  [/\b(?:hora\s+de\s+)?(?:nueva\s+york|new\s+york|eastern|et)(?:\s+time)?\b/i, "America/New_York"],
  [/\b(?:hora\s+de\s+)?(?:londres|london|uk)(?:\s+time)?\b/i, "Europe/London"],
  [/\b(?:hora\s+de\s+)?(?:tokio|tokyo|jap[oó]n|japan)(?:\s+time)?\b/i, "Asia/Tokyo"],
  [/\b(?:hora\s+de\s+)?(?:se[uú]l|seoul|corea|korea)(?:\s+time)?\b/i, "Asia/Seoul"],
  [/\butc\b|\bgmt\b/i, "UTC"],
];
const KIND: [RegExp, ParsedCapture["kind"]][] = [
  [/\b(examen|exam|test|ielts|toefl|sat|csca|hsk|duolingo)\b/i, "exam"],
  [/\b(registro|registrarse|inscripci[oó]n|registration|register)\b/i, "registration"],
  [/\b(plazo|cierre|vence|deadline|due)\b/i, "deadline"],
  [/\b(pedir|enviar|escribir|subir|llamar|revisar|send|write|upload|call|ask|review)\b/i, "task"],
];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
const weekday = (date: string) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const valid = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();

export function parseCapture(input: string, opts: { now: Date; timezone: string }): ParsedCapture {
  let text = ` ${input.trim()} `;
  const matched: string[] = [];
  const take = (re: RegExp): RegExpMatchArray | null => {
    const m = text.match(re);
    if (m) { matched.push(m[0].trim()); text = text.replace(m[0], " "); }
    return m;
  };

  let timezone = opts.timezone;
  for (const [re, tz] of ZONES) if (take(re)) { timezone = tz; break; }
  const today = dateInZone(opts.now, timezone);
  const [ty] = today.split("-").map(Number);

  // Time: "a las 8 am", "at 3:30pm", "15:00", "3pm", "8 de la mañana", "8 de la noche"
  let time: string | null = null;
  const tm = take(/\s(?:a\s+las?\s+|at\s+|@\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.\s?m\.|p\.\s?m\.|de\s+la\s+(?:mañana|tarde|noche)|h)\s/i)
    ?? take(/\s(?:a\s+las?\s+|at\s+)?(\d{1,2}):(\d{2})()\s/i)
    ?? take(/\s(?:a\s+las?|at)\s+(\d{1,2})()()\s/i);
  if (tm) {
    let h = +tm[1];
    const min = tm[2] ? +tm[2] : 0;
    const suf = (tm[3] ?? "").toLowerCase().replace(/[\s.]/g, "");
    if ((suf === "pm" || /tarde|noche/.test(suf)) && h < 12) h += 12;
    if ((suf === "am" || /mañana/.test(suf)) && h === 12) h = 0;
    if (h <= 23 && min <= 59) time = `${pad(h)}:${pad(min)}`;
  }

  let date: string | null = null;
  let m: RegExpMatchArray | null;
  if ((m = take(/\s(\d{4})-(\d{2})-(\d{2})\s/)) && valid(+m[1], +m[2], +m[3])) date = iso(+m[1], +m[2], +m[3]);
  else if (take(/\s(pasado\s+mañana|day\s+after\s+tomorrow)\s/i)) date = addDays(today, 2);
  else if (take(/\s(mañana|tomorrow)\s/i)) date = addDays(today, 1);
  else if (take(/\s(hoy|today|tonight|esta\s+noche)\s/i)) date = today;
  else if ((m = take(/\s(?:en|in)\s+(\d{1,3}|una?|one|two|dos|tres|three)\s+(d[ií]as?|days?|semanas?|weeks?|mes(?:es)?|months?)\s/i))) {
    const words: Record<string, number> = { un: 1, una: 1, one: 1, two: 2, dos: 2, tres: 3, three: 3 };
    const n = words[m[1].toLowerCase()] ?? +m[1];
    const u = m[2].toLowerCase();
    if (/^d/.test(u)) date = addDays(today, n);
    else if (/^(sem|week)/.test(u)) date = addDays(today, 7 * n);
    else { const [y, mo, d] = today.split("-").map(Number); const t = new Date(Date.UTC(y, mo - 1 + n, d)); date = iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); }
  } else if ((m = take(/\s(\d{1,2})\s+(?:de\s+)?([a-záé]{3,10})\.?(?:\s+(?:de\s+)?(\d{4}))?\s/i)) && MONTHS[m[2].toLowerCase()]) {
    const mo = MONTHS[m[2].toLowerCase()]; let y = m[3] ? +m[3] : ty;
    if (!m[3] && iso(y, mo, +m[1]) < today) y += 1;
    if (valid(y, mo, +m[1])) date = iso(y, mo, +m[1]);
  } else if ((m = take(/\s([a-z]{3,10})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\s/i)) && MONTHS[m[1].toLowerCase()]) {
    const mo = MONTHS[m[1].toLowerCase()]; let y = m[3] ? +m[3] : ty;
    if (!m[3] && iso(y, mo, +m[2]) < today) y += 1;
    if (valid(y, mo, +m[2])) date = iso(y, mo, +m[2]);
  } else if ((m = take(/\s(?:el\s+|este\s+|next\s+|this\s+|pr[oó]ximo\s+)?(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s+(?:que\s+viene|pr[oó]ximo))?\s/i))) {
    const target = WEEKDAYS[m[1].toLowerCase()];
    let diff = (target - weekday(today) + 7) % 7;
    if (diff === 0) diff = 7;
    date = addDays(today, diff);
  }
  // A time with no date means today (or tomorrow if that time already passed).
  if (!date && time) {
    const nowTime = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(opts.now);
    date = time > nowTime ? today : addDays(today, 1);
  }

  const title = text.replace(/\s+(el|la|los|las|de|del|a|para|on|at|for)\s*$/i, " ").replace(/^\s*(el|la|on|at)\s+/i, " ").replace(/\s{2,}/g, " ").trim();
  const kind = KIND.find(([re]) => re.test(input))?.[1] ?? "event";
  return { title: title || input.trim(), date, time, timezone, kind, matched };
}
