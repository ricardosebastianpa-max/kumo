"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInstitution } from "@/app/actions/catalog";
import { Button, Card, inputCls } from "@/components/ui";
import { useToast } from "@/components/client/toast";

type Init = { tuitionYear: number | null; livingMonth: number | null; admissionLow: number | null; admissionHigh: number | null; confidence: "confirmed" | "estimated" | "unverified"; notes: string };
export function InstitutionEditor({ slug, currency, initial }: { slug: string; currency: string; initial: Init }) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const te = useTranslations("event");
  const toast = useToast();
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [pending, start] = useTransition();
  const n = (v: string) => (v === "" ? null : Number(v));
  const lbl = "grid gap-1 text-sm font-medium text-ink-2";
  return (
    <Card className="p-6">
      <details>
        <summary className="min-h-11 cursor-pointer content-center text-xl font-display">{t("edit")}</summary>
        <form className="mt-4 grid gap-3" onSubmit={(e) => { e.preventDefault(); start(async () => { await updateInstitution(slug, f); toast({ text: te("saved") }); router.refresh(); }); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}>{t("tuitionYear", { cur: currency })}<input inputMode="numeric" value={f.tuitionYear ?? ""} onChange={(e) => setF({ ...f, tuitionYear: n(e.target.value) })} className={inputCls} data-testid="tuition" /></label>
            <label className={lbl}>{t("living", { cur: currency })}<input inputMode="numeric" value={f.livingMonth ?? ""} onChange={(e) => setF({ ...f, livingMonth: n(e.target.value) })} className={inputCls} /></label>
            <label className={lbl}>{t("admission")} (min %)<input inputMode="numeric" value={f.admissionLow ?? ""} onChange={(e) => setF({ ...f, admissionLow: n(e.target.value) })} className={inputCls} /></label>
            <label className={lbl}>{t("admission")} (max %)<input inputMode="numeric" value={f.admissionHigh ?? ""} onChange={(e) => setF({ ...f, admissionHigh: n(e.target.value) })} className={inputCls} /></label>
          </div>
          <label className={lbl}>{t("confidence")}<select value={f.confidence} onChange={(e) => setF({ ...f, confidence: e.target.value as Init["confidence"] })} className={inputCls}>{(["confirmed", "estimated", "unverified"] as const).map((k) => <option key={k} value={k}>{tc(`confidence.${k}`)}</option>)}</select></label>
          <label className={lbl}>{t("notes")}<textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={`${inputCls} py-3`} /></label>
          <Button type="submit" disabled={pending} className="justify-self-start">{t("save")}</Button>
        </form>
      </details>
    </Card>
  );
}
