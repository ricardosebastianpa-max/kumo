import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { institutionsScored } from "@/lib/server/catalog";
import { UniTable, type UniRow } from "./table";

export async function generateMetadata() { return { title: (await getTranslations("catalog"))("uniTitle") }; }
export default async function Universities() {
  const ctx = await requireWorkspace();
  if (!can(ctx.actor, "view", { workspaceId: ctx.workspace.id, module: "catalog" })) redirect("/app");
  const t = await getTranslations("catalog");
  const list = await institutionsScored(ctx.workspace.id);
  const rows: UniRow[] = list.map(({ i, score }, idx) => ({
    slug: i.slug, name: i.name, alt: (i.names as Record<string, string> | null)?.zh ?? (i.names as Record<string, string> | null)?.es ?? null,
    city: i.city, tiers: i.tiers, score: score?.total ?? null, rank: idx + 1, category: score?.category ?? null,
    tuition: (i.finance as { tuitionYear?: number } | null)?.tuitionYear ?? null, currency: (i.finance as { currency?: string } | null)?.currency ?? "",
    tuitionEstimated: !!(i.finance as { tuitionEstimated?: boolean } | null)?.tuitionEstimated, confidence: i.confidence,
  }));
  return (
    <div className="grid gap-6 pt-2">
      <div className="grid gap-2"><h1 className="text-4xl">{t("uniTitle")}</h1><p className="max-w-[60ch] text-lg text-ink-2">{t("uniLead", { n: rows.length })}</p></div>
      <UniTable rows={rows} />
    </div>
  );
}
