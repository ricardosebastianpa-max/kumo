"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Check, ChevronRight, ExternalLink, Play } from "lucide-react";
import type { CscaItem } from "@/lib/csca/data";
import { saveStudy, setStudyDone } from "@/app/actions/study";
import { useToast } from "@/components/client/toast";

type Prog = Record<string, { id: string; done: boolean; notes: string | null }>;
const RED = "#C8102E", RED_D = "#8E0B20", GOLD = "#E9B949", RICE = "#FFF8EC", INK = "#2B1B17";
const NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

/** 祥云: auspicious cloud motif, drawn once and reused as a pattern. */
function Xiangyun({ className, color = GOLD }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 120 60" className={className} aria-hidden fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
      <path d="M10 44 q0 -14 14 -14 q2 -12 16 -12 q14 0 16 12 q12 -2 14 10 q12 0 12 10" />
      <path d="M30 44 q0 -8 8 -8 q6 0 8 6" /><path d="M58 44 q2 -8 10 -6" />
      <path d="M84 30 q8 -10 20 -4 q6 4 4 10 q-2 6 -10 6" />
    </svg>
  );
}
/** 灯笼: a small lantern. */
function Lantern({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 70" className={className} aria-hidden>
      <path d="M20 0 v8" stroke={GOLD} strokeWidth="2" /><rect x="12" y="8" width="16" height="5" rx="2" fill={GOLD} />
      <ellipse cx="20" cy="32" rx="17" ry="20" fill={RED} stroke={RED_D} strokeWidth="2" />
      <path d="M20 12 v40 M10 16 q-6 16 0 32 M30 16 q6 16 0 32" stroke={RED_D} strokeWidth="1.5" fill="none" />
      <rect x="12" y="50" width="16" height="5" rx="2" fill={GOLD} /><path d="M16 55 v12 M20 55 v14 M24 55 v12" stroke={GOLD} strokeWidth="1.5" />
    </svg>
  );
}
/** 完成 seal stamp for finished steps. */
function Seal({ size = 40 }: { size?: number }) {
  return (
    <span className="grid shrink-0 rotate-[-8deg] place-items-center rounded-md border-2 font-black leading-none" style={{ width: size, height: size, color: RED, borderColor: RED, fontSize: size * 0.32, background: "rgba(200,16,46,.06)" }} aria-label="Completado">
      完<br />成
    </span>
  );
}

function Player({ item }: { item: CscaItem }) {
  const [on, setOn] = useState(false);
  const src = item.media === "video" ? `https://www.youtube-nocookie.com/embed/${item.ytId}?rel=0&autoplay=1` : item.media === "playlist" ? `https://www.youtube-nocookie.com/embed/videoseries?list=${item.ytId}&rel=0&autoplay=1` : null;
  if (!src) return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn3d grid aspect-video place-items-center gap-2 rounded-2xl border-2 p-6 text-center font-extrabold" style={{ background: RICE, borderColor: GOLD, color: INK, ["--edge" as string]: GOLD }}>
      <ExternalLink size={36} style={{ color: RED }} aria-hidden />{item.media === "channel" ? "Abrir el canal" : "Abrir el recurso"}<span className="text-sm font-bold opacity-70">{item.source ?? item.title}</span>
    </a>
  );
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border-4" style={{ borderColor: GOLD, background: INK }}>
      {on ? (
        <iframe key={src} src={src} title={item.title} className="absolute inset-0 size-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
      ) : (
        <button type="button" onClick={() => setOn(true)} className="group absolute inset-0 grid place-items-center" aria-label={`Reproducir: ${item.title}`}>
          {item.media === "video" ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`https://i.ytimg.com/vi/${item.ytId}/hqdefault.jpg`} alt="" className="absolute inset-0 size-full object-cover opacity-80" />
          ) : (
            <span className="absolute inset-0" style={{ background: `radial-gradient(circle at 30% 20%, ${RED} 0%, ${RED_D} 70%)` }}><Xiangyun className="absolute right-4 top-4 w-40 opacity-40" /><span className="absolute bottom-4 left-5 text-left text-sm font-black" style={{ color: GOLD }}>播放列表 · Playlist</span></span>
          )}
          <span className="relative grid size-20 place-items-center rounded-full shadow-[0_6px_0_#8E0B20] transition-transform group-active:translate-y-1" style={{ background: RED }}><Play size={36} fill={GOLD} color={GOLD} aria-hidden /></span>
        </button>
      )}
    </div>
  );
}

export function CscaView({ items, progress, canEdit, tab, initialKey }: { items: CscaItem[]; progress: Prog; canEdit: boolean; tab: "route" | "deep" | "channel"; initialKey: string | null }) {
  const toast = useToast();
  const [prog, setProg] = useState(progress);
  const [, start] = useTransition();
  const route = items.filter((i) => i.kind === "route");
  const nextRoute = route.find((r) => !prog[r.key]?.done) ?? route[0];
  const [sel, setSel] = useState<string>(initialKey ?? (tab === "route" ? nextRoute.key : items.find((i) => i.kind === tab)?.key ?? nextRoute.key));
  const cur = items.find((i) => i.key === sel) ?? nextRoute;
  const [notes, setNotes] = useState(prog[cur.key]?.notes ?? "");
  const [topic, setTopic] = useState("");
  const done = route.filter((r) => prog[r.key]?.done).length;
  const pct = Math.round((done / route.length) * 100);
  const phases = useMemo(() => { const m = new Map<string, CscaItem[]>(); for (const r of route) (m.get(r.phase ?? "") ?? m.set(r.phase ?? "", []).get(r.phase ?? "")!).push(r); return [...m.entries()]; }, [route]);
  const deep = items.filter((i) => i.kind === "deep" && (!topic || i.topic === topic));
  const topics = [...new Set(items.filter((i) => i.kind === "deep").map((i) => i.topic).filter(Boolean))] as string[];

  const choose = (k: string) => { setSel(k); setNotes(prog[k]?.notes ?? ""); if (typeof window !== "undefined" && window.innerWidth < 1024) document.getElementById("player")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const toggle = (it: CscaItem) => {
    const p = prog[it.key]; if (!p) return;
    const d = !p.done;
    setProg((x) => ({ ...x, [it.key]: { ...p, done: d } }));
    if (d) { try { navigator.vibrate?.(15); } catch {} toast({ text: "完成 · Un paso más en la ruta" }); }
    start(() => setStudyDone(p.id, d));
    if (d && it.kind === "route") { const nx = route.find((r) => r.n > it.n && !prog[r.key]?.done); if (nx) choose(nx.key); }
  };
  const TABS = [{ k: "route", zh: "路线", es: "Ruta 0 → 100" }, { k: "deep", zh: "深入", es: "Profundizar" }, { k: "channel", zh: "频道", es: "Canales y cursos" }] as const;

  return (
    <div className="grid gap-6" style={{ color: INK }}>
      {/* Banner */}
      <header className="relative overflow-hidden rounded-3xl border-4 p-6 sm:p-8" style={{ background: `linear-gradient(135deg, ${RED} 0%, ${RED_D} 100%)`, borderColor: GOLD, boxShadow: `0 6px 0 ${RED_D}` }}>
        <Xiangyun className="absolute -left-6 bottom-0 w-56 opacity-30" /><Xiangyun className="absolute right-24 top-2 w-40 opacity-25" />
        <Lantern className="absolute right-4 top-0 hidden w-10 sm:block" /><Lantern className="absolute right-16 -top-3 hidden w-8 sm:block" />
        <div className="relative grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="grid gap-1">
            <p className="text-sm font-black tracking-[.2em]" style={{ color: GOLD }}>中国大学入学考试</p>
            <h1 className="text-[clamp(2.2rem,5vw,3.4rem)] leading-none text-white">CSCA <span style={{ color: GOLD }}>备考之路</span></h1>
            <p className="font-bold text-white/90">Tu ruta de 0 a 100 en Matemáticas y Física: mira el video, haz 10 ejercicios a mano, sella el paso.</p>
          </div>
          <div className="grid size-32 place-items-center rounded-full border-4 text-center" style={{ borderColor: GOLD, background: "rgba(0,0,0,.18)" }} role="img" aria-label={`${done} de ${route.length} pasos`}>
            <span><span className="block text-4xl font-black text-white tabular-nums">{pct}%</span><span className="text-xs font-black" style={{ color: GOLD }}>{done}/{route.length} 步</span></span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div role="tablist" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.k} href={`/app/csca?tab=${t.k}`} role="tab" aria-selected={tab === t.k} className="btn3d rounded-2xl border-2 px-4 py-2 font-extrabold"
            style={tab === t.k ? { background: RED, color: "#fff", borderColor: RED_D, ["--edge" as string]: RED_D } : { background: RICE, color: INK, borderColor: "#EBD9B4", ["--edge" as string]: "#EBD9B4" }}>
            <span className="mr-1.5 font-black" style={{ color: tab === t.k ? GOLD : RED }}>{t.zh}</span>{t.es}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        {/* List */}
        <div className="grid content-start gap-4 lg:order-1">
          {tab === "route" && phases.map(([ph, list], pi) => {
            const d = list.filter((r) => prog[r.key]?.done).length;
            return (
              <details key={ph} open={list.includes(nextRoute) || list.some((r) => r.key === sel) || undefined} className="rounded-3xl border-2 p-3" style={{ background: RICE, borderColor: "#EBD9B4", boxShadow: "0 4px 0 #EBD9B4" }}>
                <summary className="flex min-h-12 cursor-pointer items-center gap-3 px-2">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl text-lg font-black text-white" style={{ background: RED }}>{NUM[pi] ?? pi + 1}</span>
                  <span className="flex-1"><span className="block text-xs font-black" style={{ color: RED }}>第{NUM[pi] ?? pi + 1}阶段</span><span className="font-extrabold">{ph.replace(/^\d+\s*·\s*/, "")}</span></span>
                  <span className="text-sm font-black tabular-nums" style={{ color: d === list.length ? "#2A9A51" : "#8A6D3B" }}>{d}/{list.length}</span>
                </summary>
                <ol className="mt-2 grid gap-1.5">
                  {list.map((r) => {
                    const isDone = !!prog[r.key]?.done, on = r.key === cur.key;
                    return (
                      <li key={r.key}>
                        <button type="button" onClick={() => choose(r.key)} aria-current={on ? "true" : undefined} className="flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition-colors"
                          style={{ borderColor: on ? RED : "transparent", background: on ? "#fff" : "transparent" }} data-testid="csca-step">
                          {isDone ? <Seal size={36} /> : <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 text-sm font-black tabular-nums" style={{ borderColor: GOLD, color: "#8A6D3B" }}>{r.n}</span>}
                          <span className="min-w-0 flex-1"><span className={`block font-extrabold leading-snug ${isDone ? "line-through opacity-60" : ""}`}>{r.topic}</span><span className="block truncate text-xs font-bold opacity-70">{r.title} · {r.source}</span></span>
                          {r.ytId ? <Play size={16} style={{ color: RED }} aria-hidden /> : <ChevronRight size={16} className="opacity-40" aria-hidden />}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </details>
            );
          })}

          {tab === "deep" && (
            <>
              <p className="font-bold opacity-80">Cuando un tema te enganche o se te atore: sube de nivel 1 (intuición) a 5 (reto).</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setTopic("")} className="rounded-full border-2 px-3 py-1.5 text-sm font-extrabold" style={!topic ? { background: RED, color: "#fff", borderColor: RED } : { borderColor: "#EBD9B4", background: RICE }}>Todos</button>
                {topics.map((t) => <button key={t} type="button" onClick={() => setTopic(t)} className="rounded-full border-2 px-3 py-1.5 text-sm font-extrabold" style={topic === t ? { background: RED, color: "#fff", borderColor: RED } : { borderColor: "#EBD9B4", background: RICE }}>{t}</button>)}
              </div>
              <ul className="grid gap-2">
                {deep.sort((a, b) => (a.level ?? "").localeCompare(b.level ?? "")).map((r) => (
                  <li key={r.key}><button type="button" onClick={() => choose(r.key)} className="flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left" style={{ background: r.key === cur.key ? "#fff" : RICE, borderColor: r.key === cur.key ? RED : "#EBD9B4" }}>
                    {prog[r.key]?.done ? <Seal size={34} /> : <span className="grid size-9 shrink-0 place-items-center rounded-xl text-sm font-black text-white" style={{ background: GOLD }}>{(r.level ?? "").slice(0, 1)}</span>}
                    <span className="min-w-0 flex-1"><span className="block font-extrabold leading-snug">{r.title}</span><span className="block truncate text-xs font-bold opacity-70">{[r.source, r.lang, r.level?.replace(/^\d\s*·\s*/, "")].filter(Boolean).join(" · ")}</span></span>
                    {r.ytId ? <Play size={16} style={{ color: RED }} aria-hidden /> : <ExternalLink size={16} className="opacity-50" aria-hidden />}
                  </button></li>
                ))}
              </ul>
            </>
          )}

          {tab === "channel" && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.filter((i) => i.kind === "channel").map((r) => (
                <li key={r.key}><a href={r.url} target="_blank" rel="noopener noreferrer" className="btn3d grid h-full gap-1 rounded-3xl border-2 p-4" style={{ background: RICE, borderColor: "#EBD9B4", ["--edge" as string]: "#EBD9B4" }}>
                  <span className="flex items-center justify-between gap-2 font-black">{r.title}<span className="rounded-full px-2 py-0.5 text-xs font-black text-white" style={{ background: RED }}>{r.lang}</span></span>
                  <span className="text-xs font-black" style={{ color: "#8A6D3B" }}>{r.topic}</span><span className="text-sm font-bold opacity-80">{r.focus}</span>
                </a></li>
              ))}
            </ul>
          )}
        </div>

        {/* Player */}
        {tab !== "channel" && (
          <aside id="player" className="order-first grid content-start gap-4 lg:order-2 lg:sticky lg:top-6 lg:self-start">
            <Player key={cur.key} item={cur} />
            <div className="grid gap-3 rounded-3xl border-2 p-5" style={{ background: RICE, borderColor: "#EBD9B4", boxShadow: "0 4px 0 #EBD9B4" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="grid gap-0.5">
                  {cur.kind === "route" && <span className="text-xs font-black" style={{ color: RED }}>第 {cur.n} 步 · Paso {cur.n} de {route.length}</span>}
                  <h2 className="text-2xl leading-tight">{cur.kind === "route" ? cur.topic : cur.title}</h2>
                  <p className="text-sm font-bold opacity-75">{cur.title !== cur.topic && cur.kind === "route" ? `${cur.title} · ` : ""}{cur.source}{cur.type ? ` · ${cur.type}` : ""}</p>
                </div>
                {prog[cur.key]?.done && <Seal size={52} />}
              </div>
              {cur.focus && <p className="rounded-2xl border-2 border-dashed px-4 py-3 font-bold" style={{ borderColor: GOLD }}>{cur.focus}</p>}
              {canEdit && prog[cur.key] && (
                <>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (prog[cur.key]?.notes ?? "") && start(async () => { await saveStudy(prog[cur.key].id, { notes: notes || null }); setProg((x) => ({ ...x, [cur.key]: { ...x[cur.key], notes } })); })}
                    rows={2} placeholder="Mis notas: qué entendí, qué me costó…" aria-label="Mis notas" className="rounded-2xl border-2 bg-white px-4 py-3 font-semibold outline-none" style={{ borderColor: "#EBD9B4" }} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => toggle(cur)} aria-pressed={!!prog[cur.key]?.done} className="btn3d inline-flex min-h-12 items-center gap-2 rounded-2xl px-5 font-black text-white" style={{ background: prog[cur.key]?.done ? "#2A9A51" : RED, ["--edge" as string]: prog[cur.key]?.done ? "#1E7A3E" : RED_D }} data-testid="csca-done">
                      <Check size={20} strokeWidth={3} aria-hidden />{prog[cur.key]?.done ? "完成 · Hecho" : "Sellar como hecho"}
                    </button>
                    <a href={cur.url} target="_blank" rel="noopener noreferrer" className="btn3d inline-flex min-h-12 items-center gap-2 rounded-2xl border-2 bg-white px-4 font-extrabold" style={{ borderColor: "#EBD9B4", ["--edge" as string]: "#EBD9B4" }}><ExternalLink size={18} aria-hidden />YouTube</a>
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
