"use client";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Plus, Star, Trash2, X } from "lucide-react";
import { createLinkedTask, deletePhoto, ponder, restorePhoto, saveFacts, setCover, uploadPhoto } from "@/app/actions/list";
import { Button, Card, inputCls } from "@/components/ui";
import { Gut } from "./gut";
import { useToast } from "./toast";
import { DoneButton } from "./done-button";
import { parseCapture } from "@/lib/domain/nl-date";

type Kind = "institution" | "scholarship";

function ListEditor({ items, set, field, ph, sign, onSave }: { items: string[]; set: (v: string[]) => void; field: "pros" | "cons"; ph: string; sign: string; onSave: (p: { pros?: string[]; cons?: string[] }) => void }) {
  const t = useTranslations("list");
  const [draft, setDraft] = useState("");
  const save = onSave;
    const add = () => { const v = draft.trim(); if (!v) return; const next = [...items, v]; set(next); setDraft(""); save({ [field]: next }); };
  return (
    <div className="grid content-start gap-2">
      <h3 className="font-sans text-sm font-medium text-ink-2">{t(field)}</h3>
      <ul className="grid gap-1.5">
        {items.map((p, i) => (
          <li key={`${p}-${i}`} className="flex items-start gap-2 rounded-xl bg-paper-2 px-3 py-2 text-sm">
            <span aria-hidden className="font-medium">{sign}</span><span className="flex-1">{p}</span>
            <button type="button" aria-label={`${t("remove")}: ${p}`} onClick={() => { const next = items.filter((_, j) => j !== i); set(next); save({ [field]: next }); }} className="-m-1 grid size-8 place-items-center rounded-lg text-mute hover:bg-card"><X size={14} aria-hidden /></button>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={ph} aria-label={ph} className={`${inputCls} min-h-11 text-sm`} />
        <button type="submit" aria-label={ph} className="grid size-11 shrink-0 place-items-center rounded-xl border border-line hover:bg-paper-2"><Plus size={18} aria-hidden /></button>
      </form>
    </div>
  );
}

/* ── Reflection: gut, pros/cons, notes (autosaves) ──────────────────── */
export function Ponder({ kind, refId, initial }: { kind: Kind; refId: string; initial: { gut: number | null; pros: string[]; cons: string[]; notes: string | null } }) {
  const t = useTranslations("list");
  const toast = useToast();
  const [gut, setGut] = useState(initial.gut);
  const [pros, setPros] = useState(initial.pros);
  const [cons, setCons] = useState(initial.cons);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [, start] = useTransition();
  const save = (patch: Parameters<typeof ponder>[2]) => start(async () => { await ponder(kind, refId, patch); toast({ text: t("saved") }); });
  return (
    <Card className="grid gap-5 p-6">
      <h2 className="text-2xl">{t("ponderTitle")}</h2>
      <div className="grid gap-1"><p className="text-sm font-medium text-ink-2">{t("gut")}</p><Gut value={gut} onChange={(v) => { setGut(v); save({ gut: v }); }} /></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <ListEditor items={pros} set={setPros} field="pros" ph={t("addPro")} sign="+" onSave={save} />
        <ListEditor items={cons} set={setCons} field="cons" ph={t("addCon")} sign="−" onSave={save} />
      </div>
      <label className="grid gap-1 text-sm font-medium text-ink-2">{t("notes")}
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (initial.notes ?? "") && save({ notes: notes || null })} placeholder={t("notesPh")} className={`${inputCls} py-3 font-normal`} />
      </label>
    </Card>
  );
}

/* ── Photos: client-side WebP compression, gallery, cover ───────────── */
async function compress(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  const bmp = await createImageBitmap(file);
  let max = 1600, q = 0.82, out: Blob | null = null, w = 0, h = 0;
  for (let i = 0; i < 6; i++) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    w = Math.round(bmp.width * k); h = Math.round(bmp.height * k);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    out = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", q));
    if (out && out.size <= 440 * 1024) break;
    max = Math.round(max * 0.8); q = Math.max(0.6, q - 0.06);
  }
  return { blob: out!, w, h };
}
export function Photos({ kind, refId, photos, canEdit }: { kind: Kind; refId: string; photos: { id: string; isCover: boolean; caption: string | null }[]; canEdit: boolean }) {
  const t = useTranslations("media");
  const tt = useTranslations("today");
  const toast = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr(null);
    for (const f of Array.from(files).slice(0, 8)) {
      if (!f.type.startsWith("image/")) { setErr(t("errType")); continue; }
      try {
        const { blob, w, h } = await compress(f);
        const fd = new FormData();
        fd.set("kind", kind); fd.set("refId", refId); fd.set("w", String(w)); fd.set("h", String(h)); fd.set("file", blob, "photo.webp");
        const r = await uploadPhoto(fd);
        if (!r.ok) setErr(r.error === "size" ? t("errSize") : t("errType"));
      } catch { setErr(t("errType")); }
    }
    setBusy(false); router.refresh();
  };
  return (
    <Card className="grid gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl">{t("title")}</h2>
        {canEdit && <>
          <input ref={input} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} data-testid="photo-input" aria-label={t("add")} />
          <Button type="button" variant="secondary" onClick={() => input.current?.click()} disabled={busy}><ImagePlus size={18} aria-hidden />{busy ? t("uploading") : t("add")}</Button>
        </>}
      </div>
      {err && <p role="alert" className="text-sm text-[var(--lacquer)]">{err}</p>}
      {photos.length === 0 ? <p className="text-ink-2">{t("empty")}</p> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <li key={p.id} className="group relative overflow-hidden rounded-2xl bg-paper-2" data-testid="photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/media/${p.id}`} alt={p.caption ?? ""} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              {p.isCover && <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-xs font-medium backdrop-blur">{t("cover")}</span>}
              {canEdit && (
                <div className="absolute bottom-2 right-2 flex gap-1">
                  {!p.isCover && <button type="button" onClick={() => start(async () => { await setCover(p.id); router.refresh(); })} aria-label={t("makeCover")} title={t("makeCover")} className="grid size-10 place-items-center rounded-xl bg-card/90 backdrop-blur hover:bg-card"><Star size={16} aria-hidden /></button>}
                  <button type="button" onClick={() => start(async () => { await deletePhoto(p.id); router.refresh(); toast({ text: t("deleted"), action: { label: tt("undo"), run: () => start(async () => { await restorePhoto(p.id); router.refresh(); }) } }); })} aria-label={t("delete")} title={t("delete")} className="grid size-10 place-items-center rounded-xl bg-card/90 backdrop-blur hover:bg-card"><Trash2 size={16} aria-hidden /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && <p className="text-sm text-mute">{t("hint")}</p>}
    </Card>
  );
}

/* ── Your own facts & links ─────────────────────────────────────────── */
export function Facts({ kind, refId, initial, canEdit }: { kind: Kind; refId: string; initial: { custom: { label: string; value: string }[]; links: { label: string; url: string }[] }; canEdit: boolean }) {
  const t = useTranslations("facts");
  const te = useTranslations("event");
  const toast = useToast();
  const [custom, setCustom] = useState(initial.custom);
  const [links, setLinks] = useState(initial.links);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => {
    const l = links.filter((x) => x.label.trim() || x.url.trim());
    if (l.some((x) => !/^https?:\/\/\S+\.\S+/.test(x.url.trim()))) { setErr(t("invalidUrl")); return; }
    setErr(null);
    start(async () => { await saveFacts(kind, refId, { custom: custom.filter((x) => x.label.trim() && x.value.trim()), links: l.map((x) => ({ label: x.label.trim() || x.url, url: x.url.trim() })) }); toast({ text: te("saved") }); });
  };
  if (!canEdit) return (
    <Card className="grid gap-3 p-6"><h2 className="text-2xl">{t("title")}</h2>
      {custom.length + links.length === 0 ? <p className="text-ink-2">{t("empty")}</p> : <>
        <dl className="grid gap-2">{custom.map((c, i) => <div key={i} className="grid grid-cols-[minmax(0,1fr)_2fr] gap-3"><dt className="text-sm text-mute">{c.label}</dt><dd>{c.value}</dd></div>)}</dl>
        <ul className="grid gap-1">{links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">{l.label}</a></li>)}</ul>
      </>}
    </Card>
  );
  return (
    <Card className="grid gap-4 p-6">
      <div className="grid gap-1"><h2 className="text-2xl">{t("title")}</h2><p className="text-sm text-mute">{t("lead")}</p></div>
      <div className="grid gap-2">
        {custom.map((c, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2">
            <input value={c.label} onChange={(e) => setCustom(custom.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder={t("label")} aria-label={t("label")} className={`${inputCls} min-h-11 text-sm`} />
            <input value={c.value} onChange={(e) => setCustom(custom.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder={t("value")} aria-label={t("value")} className={`${inputCls} min-h-11 text-sm`} />
            <button type="button" onClick={() => setCustom(custom.filter((_, j) => j !== i))} aria-label={te("delete")} className="grid size-11 place-items-center rounded-xl text-mute hover:bg-paper-2"><X size={16} aria-hidden /></button>
          </div>
        ))}
        <button type="button" onClick={() => setCustom([...custom, { label: "", value: "" }])} className="inline-flex min-h-11 items-center gap-2 justify-self-start rounded-xl px-3 text-sm font-medium hover:bg-paper-2"><Plus size={16} aria-hidden />{t("add")}</button>
      </div>
      <div className="grid gap-2">
        <h3 className="font-sans text-sm font-medium text-ink-2">{t("links")}</h3>
        {links.map((l, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2">
            <input value={l.label} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder={t("linkLabel")} aria-label={t("linkLabel")} className={`${inputCls} min-h-11 text-sm`} />
            <input value={l.url} inputMode="url" onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder={t("linkUrl")} aria-label="URL" className={`${inputCls} min-h-11 text-sm`} />
            <button type="button" onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label={te("delete")} className="grid size-11 place-items-center rounded-xl text-mute hover:bg-paper-2"><X size={16} aria-hidden /></button>
          </div>
        ))}
        <button type="button" onClick={() => setLinks([...links, { label: "", url: "" }])} className="inline-flex min-h-11 items-center gap-2 justify-self-start rounded-xl px-3 text-sm font-medium hover:bg-paper-2"><Plus size={16} aria-hidden />{t("addLink")}</button>
      </div>
      {err && <p role="alert" className="text-sm text-[var(--lacquer)]">{err}</p>}
      <Button type="button" onClick={save} disabled={pending} className="justify-self-start">{t("save")}</Button>
    </Card>
  );
}

/* ── Tasks tied to this option ──────────────────────────────────────── */
export function LinkedTasks({ kind, refId, tasks, timezone, canEdit }: { kind: Kind; refId: string; tasks: { id: string; title: string; when: string; done: boolean }[]; timezone: string; canEdit: boolean }) {
  const t = useTranslations("tasks");
  const tc = useTranslations("capture");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [pending, start] = useTransition();
  const parsed = text.trim() ? parseCapture(text, { now: new Date(), timezone }) : null;
  const d = date || parsed?.date || "";
  const submit = () => {
    if (!parsed || !d) return;
    start(async () => { await createLinkedTask({ kind, refId, title: parsed.title, date: d, time: parsed.time, timezone: parsed.timezone }); setText(""); setDate(""); toast({ text: t("added") }); router.refresh(); });
  };
  return (
    <Card className="grid gap-4 p-6">
      <div className="grid gap-1"><h2 className="text-2xl">{t("title")}</h2><p className="text-sm text-mute">{t("lead")}</p></div>
      {tasks.length === 0 ? <p className="text-ink-2">{t("empty")}</p> : (
        <ul className="grid gap-2">{tasks.map((x) => (
          <li key={x.id} className="flex items-center gap-3">{canEdit && <DoneButton id={x.id} done={x.done} />}<span className="grid"><span className={`font-medium ${x.done ? "line-through opacity-60" : ""}`}>{x.title}</span><span className="text-sm text-mute">{x.when}</span></span></li>
        ))}</ul>
      )}
      {canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("placeholder")} aria-label={t("add")} className={inputCls} data-testid="task-input" />
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={d} onChange={(e) => setDate(e.target.value)} aria-label={tc("save")} className={`${inputCls} w-auto min-h-11`} />
            {parsed && !d && <span className="text-sm text-mute">{tc("noDate")}</span>}
            {parsed?.date && !date && <span className="text-sm text-mute">{new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${parsed.date}T00:00:00Z`))}{parsed.time ? ` · ${parsed.time}` : ""}</span>}
            <Button type="submit" disabled={pending || !parsed || !d} className="ml-auto">{t("add")}</Button>
          </div>
        </form>
      )}
    </Card>
  );
}
