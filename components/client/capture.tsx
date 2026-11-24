"use client";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { parseCapture } from "@/lib/domain/nl-date";
import { createEvent } from "@/app/actions/events";
import { Button, inputCls } from "@/components/ui";
import { useToast } from "./toast";

const KINDS = ["event", "deadline", "exam", "registration", "task", "interview", "personal"] as const;

/** Quick capture: natural language in, structured event out. Opens with ⌘K, Ctrl+K or "/". */
export function Capture({ timezone }: { timezone: string }) {
  const t = useTranslations("capture");
  const tk = useTranslations("kinds");
  const te = useTranslations("event");
  const locale = useLocale();
  const toast = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [override, setOverride] = useState<{ date?: string; time?: string | null; kind?: string }>({});
  const [pending, start] = useTransition();
  const parsed = useMemo(() => parseCapture(text, { now: new Date(), timezone }), [text, timezone]);
  const date = override.date ?? parsed.date ?? "";
  const time = override.time !== undefined ? override.time : parsed.time;
  const kind = override.kind ?? parsed.kind;

  const open = () => { setText(""); setOverride({}); dialog.current?.showModal(); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); open(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const save = () => {
    if (!parsed.title || !date) return;
    start(async () => {
      await createEvent({ title: parsed.title, date, time: time ?? null, timezone: parsed.timezone, kind: kind as (typeof KINDS)[number] });
      dialog.current?.close();
      toast({ text: t("saved", { title: parsed.title }) });
    });
  };
  const fmt = date ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)) : null;

  return (
    <>
      <button type="button" onClick={open} aria-label={t("open")} aria-keyshortcuts="Meta+K Control+K /"
        className="btn3d fixed bottom-40 right-6 z-40 grid size-12 place-items-center rounded-2xl bg-brand text-brand-ink [--edge:var(--brand-deep)] lg:bottom-28 lg:right-8">
        <Plus size={26} aria-hidden />
      </button>
      <dialog ref={dialog} aria-labelledby="cap-title" className="m-auto w-[min(560px,calc(100%-32px))] rounded-[var(--radius-card)] border border-line bg-card p-0 text-ink shadow-[var(--shadow-2)] backdrop:bg-[rgba(14,20,34,.35)] backdrop:backdrop-blur-[2px]">
        <form method="dialog" onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><h2 id="cap-title" className="text-2xl">{t("title")}</h2><p className="text-sm text-mute">{t("shortcut")}</p></div>
            <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 rounded-xl px-3 text-sm font-bold text-ink-2 hover:bg-paper-2">{te("close")}</button>
          </div>
          <input autoFocus value={text} onChange={(e) => { setText(e.target.value); setOverride({}); }} placeholder={t("placeholder")} aria-label={t("title")} aria-describedby="cap-hint" className={`${inputCls} text-lg`} data-testid="capture-input" />
          <p id="cap-hint" className="text-sm text-mute">{t("hint")}</p>
          {text.trim() && (
            <div className="grid gap-3 rounded-2xl bg-paper-2 p-4" aria-live="polite">
              <p className="text-sm font-bold text-mute">{t("understood")}</p>
              <p className="text-lg font-bold">{parsed.title}</p>
              <p className="text-ink-2">{fmt ? `${fmt}${time ? ` · ${time}` : ""}${parsed.timezone !== timezone ? ` (${parsed.timezone.split("/")[1]?.replace("_", " ")})` : ""}` : t("noDate")}</p>
              <div className="grid grid-cols-3 gap-2">
                <label className="grid gap-1 text-xs font-bold text-mute">{te("date")}<input type="date" value={date} onChange={(e) => setOverride((o) => ({ ...o, date: e.target.value }))} className={`${inputCls} min-h-11 px-2 text-sm`} /></label>
                <label className="grid gap-1 text-xs font-bold text-mute">{te("time")}<input type="time" value={time ?? ""} onChange={(e) => setOverride((o) => ({ ...o, time: e.target.value || null }))} className={`${inputCls} min-h-11 px-2 text-sm`} /></label>
                <label className="grid gap-1 text-xs font-bold text-mute">{te("kind")}<select value={kind} onChange={(e) => setOverride((o) => ({ ...o, kind: e.target.value }))} className={`${inputCls} min-h-11 px-2 text-sm`}>{KINDS.map((k) => <option key={k} value={k}>{tk(k)}</option>)}</select></label>
              </div>
            </div>
          )}
          <Button type="submit" size="lg" disabled={pending || !text.trim() || !date}>{t("save")}</Button>
        </form>
      </dialog>
    </>
  );
}
