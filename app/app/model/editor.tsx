"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { scoreInstitution } from "@/lib/domain/score-institution";
import type { ScoringParams } from "@/lib/domain/scoring";
import { saveModel } from "@/app/actions/plan";
import { Button, Card, CategoryChip, inputCls } from "@/components/ui";
import { useToast } from "@/components/client/toast";

type Inst = Parameters<typeof scoreInstitution>[0] & { slug: string; name: string };
const PARTS = ["prestige", "fit", "finance", "climate_city"] as const;

export function ModelEditor({ params, version, insts, canEdit }: { params: ScoringParams; version: number; insts: Inst[]; canEdit: boolean }) {
  const t = useTranslations("model");
  const tp = useTranslations("catalog");
  const tcat = useTranslations("categories");
  const toast = useToast();
  const [w, setW] = useState({ ...params.weights });
  const [budgets, setBudgets] = useState(params.finance.scenarios.map((x) => ({ ...x })));
  const [, start] = useTransition();
  /** Finance scenario points scale with the finance weight so the total stays coherent. */
  const next: ScoringParams = useMemo(() => {
    const sum = params.finance.scenarios.reduce((a, x) => a + x.points, 0) || 1;
    return { ...params, weights: w, finance: { ...params.finance, scenarios: budgets.map((b, i) => ({ ...b, points: (params.finance.scenarios[i].points / sum) * (w.finance ?? 0) })) } };
  }, [w, budgets, params]);
  const rank = (p: ScoringParams) => insts.map((i) => ({ i, r: scoreInstitution(i, p) })).sort((a, b) => b.r.total - a.r.total);
  const before = useMemo(() => new Map(rank(params).map((x, k) => [x.i.slug, k])), [params, insts]); // eslint-disable-line react-hooks/exhaustive-deps
  const after = useMemo(() => rank(next), [next, insts]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = PARTS.reduce((a, k) => a + (w[k] ?? 0), 0);
  return (
    <div className="grid max-w-4xl gap-6 pt-2">
      <div className="grid gap-2"><h1 className="text-4xl">{t("title")} <span className="font-sans text-base text-mute">v{version}</span></h1><p className="text-lg text-ink-2">{t("lead")}</p></div>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="grid content-start gap-4">
          <Card className="grid gap-3 p-5"><h2 className="text-xl">{t("weights")} <span className="font-sans text-sm text-mute">= {total}</span></h2>
            {PARTS.map((k) => (
              <label key={k} className="grid gap-1 text-sm font-medium">{tp(`parts.${k}`)} · {w[k] ?? 0}
                <input type="range" min={0} max={60} value={w[k] ?? 0} disabled={!canEdit} onChange={(e) => setW({ ...w, [k]: Number(e.target.value) })} className="accent-[var(--ink)]" />
              </label>
            ))}
          </Card>
          <Card className="grid gap-2 p-5"><h2 className="text-xl">{t("budgets")}</h2>
            {budgets.map((b, i) => <label key={b.key} className="flex items-center justify-between gap-2 text-sm font-medium">{tp("scenario", { key: b.key })}
              <input inputMode="numeric" value={b.amountPerYear} disabled={!canEdit} onChange={(e) => setBudgets(budgets.map((x, j) => (j === i ? { ...x, amountPerYear: Number(e.target.value) || 0 } : x)))} className={`${inputCls} min-h-10 w-32 text-right`} /></label>)}
          </Card>
          {canEdit && <Button onClick={() => start(async () => { const v = await saveModel(next as unknown as Record<string, unknown>); toast({ text: `${t("saved")} v${v}` }); })}>{t("save", { v: version + 1 })}</Button>}
        </div>
        <Card className="p-5"><h2 className="mb-3 text-xl">{t("preview")}</h2>
          <ol className="grid gap-1.5">{after.slice(0, 25).map(({ i, r }, k) => { const d = (before.get(i.slug) ?? k) - k; return (
            <li key={i.slug} className="grid grid-cols-[28px_1fr_auto_52px_44px] items-center gap-2 text-sm">
              <span className="tabular-nums text-mute">{k + 1}</span><Link href={`/app/universities/${i.slug}`} className="truncate font-medium hover:underline">{i.name}</Link>
              {r.category ? <CategoryChip category={r.category} label={tcat(r.category as "dream")} /> : <span />}
              <span className="text-right font-display tabular-nums">{r.total.toFixed(1)}</span>
              <span className={`text-right text-xs font-medium ${d > 0 ? "text-[var(--conf-confirmed)]" : d < 0 ? "text-[var(--lacquer)]" : "text-mute"}`}>{d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : "·"}</span>
            </li>); })}</ol>
        </Card>
      </div>
    </div>
  );
}
