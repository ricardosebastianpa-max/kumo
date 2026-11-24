"use client";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { runImport } from "@/app/actions";
import type { ImportResult } from "@/lib/seed/import";
import { Button, Card } from "@/components/ui";
import { Kumo } from "@/components/kumo";

export function ImportFlow() {
  const t = useTranslations("import");
  const tc = useTranslations("common");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Record<string, unknown> | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [phase, setPhase] = useState<"pick" | "reading" | "preview" | "importing" | "done">("pick");
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  async function read(list: FileList | null) {
    if (!list?.length) return;
    setPhase("reading"); setError(null);
    const out: Record<string, unknown> = {};
    try { for (const f of Array.from(list)) if (f.name.endsWith(".json")) out[f.name] = JSON.parse(await f.text()); }
    catch { setError(t("invalid")); setPhase("pick"); return; }
    const r = await runImport(out, true).catch(() => null);
    if (!r || !r.ok) { setError(r && !r.ok ? r.error : tc("errorGeneric")); setPhase("pick"); return; }
    setFiles(out); setPreview(r.result); setPhase("preview");
  }
  async function commit() {
    if (!files) return;
    setPhase("importing");
    const r = await runImport(files, false).catch(() => null);
    if (!r || !r.ok) { setError(tc("errorGeneric")); setPhase("preview"); return; }
    setPreview(r.result); setPhase("done"); router.refresh();
  }

  if (phase === "done") return (
    <Card className="grid justify-items-start gap-4 p-6 enter" role="status">
      <Kumo state="celebrating" size={96} className="text-ink" />
      <p className="text-xl font-semibold">{t("done")}</p>
      <a href="/app" className="font-semibold underline underline-offset-4">{tc("continue")}</a>
    </Card>
  );
  return (
    <div className="grid gap-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); read(e.dataTransfer.files); }}
        className={`grid justify-items-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed p-8 text-center transition-colors ${drag ? "border-[var(--lacquer)] bg-lacquer-soft" : "border-line bg-card"}`}
      >
        <input ref={input} type="file" accept=".json,application/json" multiple className="sr-only" id="pack" onChange={(e) => read(e.target.files)} data-testid="pack-input" />
        <Button type="button" onClick={() => input.current?.click()} disabled={phase === "reading" || phase === "importing"}>{phase === "reading" ? tc("loading") : t("pick")}</Button>
        <p className="text-sm text-mute">{t("dropHint")}</p>
        {files ? <p className="text-sm text-ink-2">{t("files", { n: Object.keys(files).length })}</p> : null}
      </div>
      {error ? <p role="alert" className="text-[var(--lacquer)]">{error}</p> : null}
      {preview && (phase === "preview" || phase === "importing") && (
        <Card className="grid gap-4 p-6 enter">
          <h2 className="text-2xl">{t("previewTitle")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="text-mute"><th className="py-2 font-semibold">{t("entity")}</th><th className="py-2 text-right font-semibold">{t("create")}</th><th className="py-2 text-right font-semibold">{t("update")}</th><th className="py-2 text-right font-semibold">{t("unchanged")}</th></tr></thead>
              <tbody>
                {Object.entries(preview.preview).map(([k, v]) => (
                  <tr key={k} className="border-t border-line"><td className="py-2">{t.has(`entities.${k}`) ? t(`entities.${k}`) : k}</td><td className="py-2 text-right tabular-nums">{v.create}</td><td className="py-2 text-right tabular-nums">{v.update}</td><td className="py-2 text-right tabular-nums text-mute">{v.unchanged}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.unresolved.length > 0 && <details><summary className="cursor-pointer font-semibold">{t("unresolved")} ({preview.unresolved.length})</summary><ul className="mt-2 text-sm text-mute">{preview.unresolved.map((u) => <li key={u}>{u}</li>)}</ul></details>}
          <Button type="button" size="lg" onClick={commit} disabled={phase === "importing"} className="justify-self-start">{phase === "importing" ? t("importing") : t("confirm")}</Button>
        </Card>
      )}
    </div>
  );
}
