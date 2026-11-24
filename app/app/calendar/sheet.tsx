"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEvent, getEventDetail, restoreEvent, setEventDone, updateEvent, type EventDetail } from "@/app/actions/events";
import { Button, ConfidenceBadge, inputCls } from "@/components/ui";
import { useToast } from "@/components/client/toast";

const KINDS = ["deadline", "exam", "registration", "window", "task", "milestone", "interview", "study_block", "personal", "event"] as const;
const ZONES = ["America/Managua", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Tokyo", "Asia/Seoul", "Europe/London", "America/New_York", "UTC"];

/** Side sheet (bottom sheet on phones) for one event: view, edit, complete, delete with undo, sources and history. */
export function EventSheet({ id, onClose, userTz }: { id: string | null; onClose: () => void; userTz: string }) {
  const t = useTranslations("event");
  const tc = useTranslations("common");
  const tk = useTranslations("kinds");
  const tp = useTranslations("priority");
  const tt = useTranslations("today");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const ref = useRef<HTMLDialogElement>(null);
  const [d, setD] = useState<EventDetail | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!id) { ref.current?.close(); return; }
    setD(null);
    ref.current?.showModal();
    getEventDetail(id).then((r) => {
      setD(r);
      if (r) setForm({ title: r.event.title, date: r.event.date, time: r.event.time ?? "", timezone: r.event.timezone, kind: r.event.kind, priority: r.event.priority, confidence: r.event.confidence, notes: r.event.notes ?? "" });
    });
  }, [id]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = () => d && start(async () => {
    await updateEvent(d.event.id, { title: form.title, date: form.date, time: form.time || null, timezone: form.timezone, kind: form.kind as never, priority: form.priority as never, confidence: form.confidence as never, notes: form.notes || null });
    toast({ text: t("saved") }); router.refresh(); ref.current?.close();
  });
  const remove = () => d && start(async () => {
    const eid = d.event.id;
    await deleteEvent(eid); ref.current?.close(); router.refresh();
    toast({ text: t("deleted"), action: { label: tt("undo"), run: () => start(async () => { await restoreEvent(eid); router.refresh(); }) } });
  });
  const fmtAt = (at: Date | string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: userTz }).format(new Date(at));
  const lbl = "grid gap-1 text-sm font-bold text-ink-2";
  const ro = !d?.canEdit;

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="ev-title"
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-md border-l border-line bg-card p-0 text-ink shadow-[var(--shadow-2)] backdrop:bg-[rgba(14,20,34,.3)] max-sm:mt-auto max-sm:h-[88dvh] max-sm:max-w-none max-sm:rounded-t-[24px] max-sm:border-l-0 max-sm:border-t">
      <div className="grid gap-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="ev-title" className="text-2xl leading-tight">{d?.event.title ?? tc("loading")}</h2>
          <button type="button" onClick={() => ref.current?.close()} className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold text-ink-2 hover:bg-paper-2">{t("close")}</button>
        </div>
        {d && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <ConfidenceBadge level={d.event.confidence} label={tc(`confidence.${d.event.confidence}`)} />
              <span className="rounded-full bg-paper-2 px-2.5 py-1 text-xs font-bold">{tk(d.event.kind as never)}</span>
              {d.institution && <Link href={`/app/universities/${d.institution.slug}`} className="rounded-full bg-paper-2 px-2.5 py-1 text-xs font-bold underline-offset-2 hover:underline">{d.institution.name}</Link>}
              {ro && <span className="text-xs text-mute">{t("readOnly")}</span>}
            </div>
            {!d.event.allDay && d.event.timezone !== userTz && (
              <p className="rounded-xl bg-paper-2 p-3 text-sm">{t("inZone", { tz: d.event.timezone, time: d.event.time ?? "" })} · {t("yourTime", { time: fmtAt(d.event.startsAt) })}</p>
            )}
            <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-3">
              <fieldset disabled={ro || pending} className="grid gap-3">
                <label className={lbl}>{t("title")}<input value={form.title ?? ""} onChange={set("title")} required className={inputCls} /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={lbl}>{t("date")}<input type="date" value={form.date ?? ""} onChange={set("date")} required className={inputCls} data-testid="ev-date" /></label>
                  <label className={lbl}>{t("time")}<input type="time" value={form.time ?? ""} onChange={set("time")} className={inputCls} aria-describedby="ev-allday" /></label>
                </div>
                {!form.time && <p id="ev-allday" className="-mt-1 text-xs text-mute">{t("allDay")}</p>}
                <label className={lbl}>{t("timezone")}<select value={form.timezone ?? ""} onChange={set("timezone")} className={inputCls}>{[...new Set([form.timezone, userTz, ...ZONES])].filter(Boolean).map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}</select></label>
                <div className="grid grid-cols-3 gap-2">
                  <label className={lbl}>{t("kind")}<select value={form.kind ?? ""} onChange={set("kind")} className={`${inputCls} px-2`}>{KINDS.map((k) => <option key={k} value={k}>{tk(k)}</option>)}</select></label>
                  <label className={lbl}>{t("priority")}<select value={form.priority ?? ""} onChange={set("priority")} className={`${inputCls} px-2`}>{(["critical", "high", "medium", "low"] as const).map((k) => <option key={k} value={k}>{tp(k)}</option>)}</select></label>
                  <label className={lbl}>{t("confidence")}<select value={form.confidence ?? ""} onChange={set("confidence")} className={`${inputCls} px-2`}>{(["confirmed", "estimated", "unverified"] as const).map((k) => <option key={k} value={k}>{tc(`confidence.${k}`)}</option>)}</select></label>
                </div>
                <label className={lbl}>{t("notes")}<textarea value={form.notes ?? ""} onChange={set("notes")} rows={3} className={`${inputCls} py-3`} /></label>
              </fieldset>
              {!ro && (
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={pending}>{t("save")}</Button>
                  {(d.event.kind === "task" || d.event.kind === "milestone") && <Button type="button" variant="secondary" disabled={pending} onClick={() => start(async () => { await setEventDone(d.event.id, !d.event.completedAt); router.refresh(); ref.current?.close(); })}>{d.event.completedAt ? t("reopen") : t("markDone")}</Button>}
                  <Button type="button" variant="danger" disabled={pending} onClick={remove} className="ml-auto">{t("delete")}</Button>
                </div>
              )}
            </form>
            <section className="grid gap-2">
              <h3 className="font-sans text-sm font-bold text-mute">{t("source")}</h3>
              {d.sources.length ? d.sources.map((s, i) => (
                <p key={i} className="text-sm">{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2">{s.title}</a> : <span className="font-bold">{s.title}</span>} · {tc(`confidence.${s.confidence}`)}</p>
              )) : <p className="text-sm text-mute">{d.event.notes && /fuente|source/i.test(d.event.notes) ? d.event.notes : t("noSource")}</p>}
            </section>
            <section className="grid gap-2" data-testid="ev-history">
              <h3 className="font-sans text-sm font-bold text-mute">{t("history")}</h3>
              {d.history.length ? (
                <ol className="grid gap-1.5 text-sm">
                  {d.history.map((h, i) => <li key={i}><span className="font-bold">{h.who ?? "Kumo"}</span> {t.has(`actions.${h.action}`) ? t(`actions.${h.action}` as never) : h.action}{h.fields.length ? ` ${h.fields.map((f) => (f === "startsAt" ? t("date").toLowerCase() : f)).join(", ")}` : ""} · <span className="text-mute">{fmtAt(h.at)}</span></li>)}
                </ol>
              ) : <p className="text-sm text-mute">{t("historyEmpty")}</p>}
            </section>
          </>
        )}
      </div>
    </dialog>
  );
}
