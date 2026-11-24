/** RFC 5545 calendar feed. Pure: rows in, text out. All-day items use VALUE=DATE in their own zone. */
import { dateInZone } from "./time";

export interface IcsEvent {
  id: string; title: string; notes?: string | null; startsAt: Date; endsAt?: Date | null; allDay: boolean; timezone: string;
  confidence: "confirmed" | "estimated" | "unverified"; updatedAt: Date; url?: string;
}
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const day = (d: Date, tz: string) => dateInZone(d, tz).replace(/-/g, "");
const nextDay = (ymd: string) => { const t = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8) + 1)); return t.toISOString().slice(0, 10).replace(/-/g, ""); };

/** Lines longer than 75 octets are folded (RFC 5545 §3.1). */
function fold(line: string): string {
  const out: string[] = []; let cur = ""; let bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(calName: string, events: IcsEvent[], labels: { estimated: string; unverified: string }): string {
  const L: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kumo//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(calName)}`, "X-PUBLISHED-TTL:PT1H", "REFRESH-INTERVAL;VALUE=DURATION:PT1H"];
  for (const e of events) {
    const prefix = e.confidence === "estimated" ? `(${labels.estimated}) ` : e.confidence === "unverified" ? `(${labels.unverified}) ` : "";
    L.push("BEGIN:VEVENT", `UID:${e.id}@kumo`, `DTSTAMP:${utc(e.updatedAt)}`, `LAST-MODIFIED:${utc(e.updatedAt)}`);
    if (e.allDay) {
      const s = day(e.startsAt, e.timezone);
      L.push(`DTSTART;VALUE=DATE:${s}`, `DTEND;VALUE=DATE:${nextDay(e.endsAt ? day(e.endsAt, e.timezone) : s)}`);
    } else {
      L.push(`DTSTART:${utc(e.startsAt)}`, `DTEND:${utc(e.endsAt ?? new Date(e.startsAt.getTime() + 30 * 60000))}`);
    }
    L.push(`SUMMARY:${esc(prefix + e.title)}`);
    const desc = [e.notes, e.timezone !== "UTC" ? `TZ: ${e.timezone}` : null, e.url].filter(Boolean).join("\n");
    if (desc) L.push(`DESCRIPTION:${esc(desc)}`);
    if (e.url) L.push(`URL:${e.url}`);
    L.push(`STATUS:${e.confidence === "confirmed" ? "CONFIRMED" : "TENTATIVE"}`, "TRANSP:TRANSPARENT", "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}
