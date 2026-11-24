/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- one-off data script */
/**
 * One-off resolver: turns the study sheets' titles into exact YouTube videos/playlists/channels.
 * Output is committed (seed/csca-library/resolved.json) so the app never searches at runtime.
 * Run: npx tsx scripts/resolve-videos.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { studyFromCsv, type StudyResourceIn } from "../lib/seed/adapters/study-csv";

type Hit = { kind: "video" | "playlist" | "channel"; id: string; title: string; channel: string };
const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function yt(query: string, filter?: "playlist" | "channel"): Hit[] {
  const sp = filter === "playlist" ? "&sp=EgIQAw%253D%253D" : filter === "channel" ? "&sp=EgIQAg%253D%253D" : "";
  let html = "";
  try { html = execFileSync("curl", ["-s", "-m", "25", "-A", "Mozilla/5.0", "-H", "Accept-Language: es", `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${sp}`], { maxBuffer: 20e6 }).toString(); } catch { return []; }
  const m = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
  if (!m) return [];
  const out: Hit[] = [];
  const text = (o: any): string => o?.simpleText ?? o?.runs?.map((r: any) => r.text).join("") ?? o?.content ?? "";
  const walk = (o: any) => {
    if (!o || typeof o !== "object") return;
    if (o.videoRenderer?.videoId) out.push({ kind: "video", id: o.videoRenderer.videoId, title: text(o.videoRenderer.title), channel: text(o.videoRenderer.ownerText) });
    if (o.playlistRenderer?.playlistId) out.push({ kind: "playlist", id: o.playlistRenderer.playlistId, title: text(o.playlistRenderer.title), channel: text(o.playlistRenderer.shortBylineText) });
    if (o.channelRenderer?.channelId) out.push({ kind: "channel", id: o.channelRenderer.channelId, title: text(o.channelRenderer.title), channel: text(o.channelRenderer.title) });
    if (o.lockupViewModel?.contentType === "LOCKUP_CONTENT_TYPE_PLAYLIST") {
      const md = o.lockupViewModel.metadata?.lockupMetadataViewModel;
      const ch = JSON.stringify(md?.metadata ?? "").match(/"content":"([^"]+)"/)?.[1] ?? "";
      out.push({ kind: "playlist", id: o.lockupViewModel.contentId, title: md?.title?.content ?? "", channel: ch });
    }
    for (const v of Object.values(o)) walk(v);
  };
  walk(JSON.parse(m[1]));
  return out;
}
function pick(hits: Hit[], source: string | undefined, kinds: Hit["kind"][]) {
  const cand = hits.filter((h) => kinds.includes(h.kind));
  const s = norm(source ?? "").split(" ").filter((w) => w.length > 3 && !["prof", "profe", "canal"].includes(w));
  const good = cand.find((h) => s.length && s.some((w) => norm(h.channel).includes(w)));
  return good ? { hit: good, matched: true } : cand[0] ? { hit: cand[0], matched: false } : null;
}
const WEB: [RegExp, string][] = [
  [/khan/i, "https://es.khanacademy.org/"], [/openstax/i, "https://openstax.org/subjects/espa%C3%B1ol"], [/phet/i, "https://phet.colorado.edu/es/"],
  [/desmos/i, "https://www.desmos.com/calculator?lang=es"], [/geogebra/i, "https://www.geogebra.org/3d?lang=es"], [/fisicalab/i, "https://www.fisicalab.com/"],
  [/paul/i, "https://tutorial.math.lamar.edu/"], [/physics classroom/i, "https://www.physicsclassroom.com/"], [/mit opencourseware|8\.01sc/i, "https://ocw.mit.edu/courses/8-01sc-classical-mechanics-fall-2016/"],
  [/aops|alcumus|art of problem/i, "https://artofproblemsolving.com/alcumus"], [/csc \(oficial\)|csca/i, "https://www.csca.cn/"], [/danipartal/i, "https://www.danipartal.net/"],
];
const isWeb = (r: StudyResourceIn) => !!WEB.find(([re]) => re.test(`${r.source ?? ""} ${r.title}`)) && !/video|playlist/i.test(r.type ?? "");

const all = ["ruta-0-100.csv", "profundizar.csv", "canales.csv"].flatMap((f) => studyFromCsv(readFileSync(`seed/csca-library/${f}`, "utf8")) ?? []);
const out: Record<string, { kind: string; id?: string; url: string; title?: string; channel?: string; matched: boolean }> = {};
let i = 0;
for (const r of all) {
  i++;
  const web = WEB.find(([re]) => re.test(`${r.source ?? ""} ${r.title}`));
  if (r.kind === "channel" && !web) {
    const p = pick(yt(r.title, "channel"), r.title, ["channel"]);
    if (p) out[r.key] = { kind: "channel", id: p.hit.id, url: `https://www.youtube.com/channel/${p.hit.id}`, title: p.hit.title, channel: p.hit.title, matched: p.matched };
  } else if (web && isWeb(r)) {
    out[r.key] = { kind: "web", url: web[1], matched: true };
  } else {
    const wantPlaylist = /playlist|curso|canal|clases|video playlist/i.test(`${r.type ?? ""} ${r.title}`);
    const q = `${r.title} ${r.source ?? ""}`;
    let p = wantPlaylist ? pick(yt(q, "playlist"), r.source, ["playlist"]) : null;
    if (!p || !p.matched) { const v = pick(yt(q), r.source, ["video", "playlist"]); if (v && (!p || v.matched)) p = v; }
    if (p) out[r.key] = { kind: p.hit.kind, id: p.hit.id, url: p.hit.kind === "video" ? `https://www.youtube.com/watch?v=${p.hit.id}` : `https://www.youtube.com/playlist?list=${p.hit.id}`, title: p.hit.title, channel: p.hit.channel, matched: p.matched };
  }
  if (i % 20 === 0) console.log(i, "/", all.length);
}
writeFileSync("seed/csca-library/resolved.json", JSON.stringify(out, null, 1));
const vals = Object.values(out);
console.log("resolved", vals.length, "of", all.length, "· matched channel", vals.filter((v) => v.matched).length, "· by kind", JSON.stringify(vals.reduce((a: Record<string, number>, v) => ((a[v.kind] = (a[v.kind] ?? 0) + 1), a), {})));
