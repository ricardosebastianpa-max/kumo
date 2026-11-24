"use client";
import Link from "next/link";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, X } from "lucide-react";
import { copilotShortlist, copilotTurn, type CopilotAction } from "@/app/actions/copilot";
import { createEvent } from "@/app/actions/events";
import { KumoFace } from "@/components/kumo-face";
import { useToast } from "./toast";

type Msg = { role: "user" | "assistant"; content: string; actions?: CopilotAction[] };
const T = {
  es: { title: "Kumo", hi: "Hola, ¿en qué te ayudo? Puedo buscar, filtrar y llevarte a donde necesites.", ph: "Pregúntame o pídeme algo…", off: "Conecta tu clave de IA para hablar conmigo.", connect: "Conectar", error: "No pude responder ahora. Intenta otra vez.", went: "Te llevé a", confirm: "Hacerlo", done: "Listo", open: "Abrir Kumo", close: "Cerrar",
    chips: ["¿Qué hago ahora?", "Muéstrame las Safety más baratas", "Becas con plazo este mes", "Abre mi calendario en línea de tiempo"] },
  en: { title: "Kumo", hi: "Hi, how can I help? I can search, filter and take you wherever you need.", ph: "Ask me or tell me what to do…", off: "Connect your AI key to talk to me.", connect: "Connect", error: "I couldn’t answer right now. Try again.", went: "Took you to", confirm: "Do it", done: "Done", open: "Open Kumo", close: "Close",
    chips: ["What should I do now?", "Show me the cheapest Safety options", "Scholarships due this month", "Open my calendar timeline"] },
};

/** Floating happy cloud in the corner: chat that can navigate, filter and propose actions. */
export function CopilotBubble({ aiOn, timezone }: { aiOn: boolean; timezone: string }) {
  const locale = useLocale();
  const L = T[locale === "en" ? "en" : "es"];
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, pending]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);

  const send = (text: string) => {
    if (!text.trim() || pending) return;
    const history: Msg[] = [...msgs, { role: "user", content: text.trim() }];
    setMsgs(history); setQ("");
    start(async () => {
      const r = await copilotTurn(history.map(({ role, content }) => ({ role, content })), path);
      if (!r.ok) { setMsgs((m) => [...m, { role: "assistant", content: r.off ? L.off : `${L.error}${r.error ? `\n\n(${r.error})` : ""}` }]); return; }
      const nav = r.actions?.find((a) => a.type === "navigate") as Extract<CopilotAction, { type: "navigate" }> | undefined;
      setMsgs((m) => [...m, { role: "assistant", content: r.text ?? "", actions: r.actions?.filter((a) => a.type !== "navigate") }]);
      if (nav) { router.push(nav.path); toast({ text: `${L.went} ${nav.label ?? nav.path}` }); }
    });
  };
  const run = (a: CopilotAction, i: number, mi: number) => start(async () => {
    if (a.type === "shortlist") await copilotShortlist(a.kind, a.slug, a.stage);
    if (a.type === "task") await createEvent({ title: a.title, date: a.date, time: null, timezone, kind: "task" });
    setMsgs((m) => m.map((x, j) => (j === mi ? { ...x, actions: x.actions?.filter((_, k) => k !== i) } : x)));
    toast({ text: L.done }); router.refresh();
  });

  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? L.close : L.open}
        className="fixed bottom-20 right-4 z-50 grid size-16 place-items-center rounded-full bg-[var(--sky)] shadow-[0_5px_0_var(--sky-deep)] transition-transform active:translate-y-1 active:shadow-[0_1px_0_var(--sky-deep)] lg:bottom-6 lg:right-6" data-testid="copilot-bubble">
        <span className={open ? "" : "bob"}><KumoFace size={60} mood={pending ? "thinking" : "happy"} /></span>
      </button>
      {open && (
        <section role="dialog" aria-label={L.title} className="enter fixed inset-x-3 bottom-40 z-50 flex max-h-[70dvh] flex-col overflow-hidden rounded-3xl border-2 border-line bg-card shadow-[0_6px_0_var(--line-strong)] sm:inset-x-auto sm:right-6 sm:w-[400px] lg:bottom-28">
          <header className="flex items-center gap-3 border-b-2 border-line bg-[var(--sky-soft)] px-4 py-3">
            <KumoFace size={36} mood={pending ? "thinking" : "happy"} /><p className="flex-1 text-lg font-black">{L.title}</p>
            <button type="button" onClick={() => setOpen(false)} aria-label={L.close} className="grid size-10 place-items-center rounded-xl hover:bg-card"><X size={18} aria-hidden /></button>
          </header>
          <div className="grid flex-1 content-start gap-3 overflow-y-auto p-4" aria-live="polite">
            <p className="max-w-[90%] rounded-2xl rounded-tl-md bg-paper-2 px-4 py-3 font-semibold">{aiOn ? L.hi : L.off}</p>
            {!aiOn && <Link href="/app/copilot" onClick={() => setOpen(false)} className="btn3d justify-self-start rounded-2xl bg-[var(--sky)] px-4 py-2.5 font-extrabold text-white [--edge:var(--sky-deep)]">{L.connect}</Link>}
            {aiOn && msgs.length === 0 && <div className="flex flex-wrap gap-2">{L.chips.map((c) => <button key={c} type="button" onClick={() => send(c)} className="btn3d rounded-2xl border-2 border-line bg-card px-3 py-2 text-sm font-bold">{c}</button>)}</div>}
            {msgs.map((m, mi) => (
              <div key={mi} className={`grid max-w-[90%] gap-2 ${m.role === "user" ? "justify-self-end" : ""}`}>
                <p className={`whitespace-pre-wrap rounded-2xl px-4 py-3 font-semibold ${m.role === "user" ? "rounded-tr-md bg-[var(--sky)] text-white" : "rounded-tl-md bg-paper-2"}`}>{m.content}</p>
                {m.actions?.map((a, i) => (
                  <button key={i} type="button" disabled={pending} onClick={() => run(a, i, mi)} className="btn3d justify-self-start rounded-2xl bg-[var(--leaf)] px-4 py-2 text-sm font-extrabold text-white [--edge:var(--leaf-deep)]">
                    {L.confirm}: {a.label ?? (a.type === "task" ? `${a.title} · ${a.date}` : a.type === "shortlist" ? `${a.slug} → ${a.stage}` : "")}
                  </button>
                ))}
              </div>
            ))}
            {pending && <p className="w-16 rounded-2xl bg-paper-2 px-4 py-3 text-center font-black tracking-widest text-mute">···</p>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(q); }} className="flex gap-2 border-t-2 border-line p-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.ph} aria-label={L.ph} disabled={!aiOn} className="min-h-12 flex-1 rounded-2xl border-2 border-line bg-card px-4 font-semibold outline-none focus:border-[var(--sky)]" data-testid="copilot-input" />
            <button type="submit" disabled={!aiOn || pending || !q.trim()} aria-label="Enviar" className="btn3d grid size-12 place-items-center rounded-2xl bg-[var(--sky)] text-white [--edge:var(--sky-deep)] disabled:opacity-40"><ArrowUp size={20} strokeWidth={3} aria-hidden /></button>
          </form>
        </section>
      )}
    </>
  );
}
