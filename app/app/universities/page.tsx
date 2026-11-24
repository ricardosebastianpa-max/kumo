import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { institutionsScored } from "@/lib/server/catalog";
import { UniTable, type UniRow } from "./table";
import { ExploreTabs } from "@/components/explore-tabs";
import { stagesFor } from "@/lib/server/list";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export async function generateMetadata() { return { title: (await getTranslations("catalog"))("uniTitle") }; }
export default async function Universities() {
  const ctx = await requireWorkspace();
  if (!can(ctx.actor, "view", { workspaceId: ctx.workspace.id, module: "catalog" })) redirect("/app");
  const t = await getTranslations("catalog");
  const ws = ctx.workspace.id;
  const list = await institutionsScored(ws);
  const [stages, covers] = await Promise.all([
    stagesFor(ws, list.map((x) => x.i.id)),
    db.select({ id: s.media.id, rid: s.media.resourceId }).from(s.media).where(and(eq(s.media.workspaceId, ws), eq(s.media.isCover, true), isNull(s.media.deletedAt))),
  ]);
  const coverOf = new Map(covers.map((c) => [c.rid, `/api/media/${c.id}`]));
  const rows: UniRow[] = list.map(({ i, score }, idx) => ({
    id: i.id, cover: coverOf.get(i.id) ?? null, stage: stages.get(i.id) ?? "exploring",
    slug: i.slug, name: i.name, alt: (i.names as Record<string, string> | null)?.zh ?? (i.names as Record<string, string> | null)?.es ?? null,
    city: i.city, tiers: i.tiers, score: score?.total ?? null, rank: idx + 1, category: score?.category ?? null,
    tuition: (i.finance as { tuitionYear?: number } | null)?.tuitionYear ?? null, currency: (i.finance as { currency?: string } | null)?.currency ?? "",
    tuitionEstimated: !!(i.finance as { tuitionEstimated?: boolean } | null)?.tuitionEstimated, confidence: i.confidence,
  }));
  return (
    <div className="grid gap-6 pt-2">
      <ExploreTabs active="unis" />
      <div className="grid gap-2"><h1 className="text-4xl">{t("uniTitle")}</h1><p className="max-w-[60ch] text-lg text-ink-2">{t("uniLead", { n: rows.length })}</p></div>
      <UniTable rows={rows} canList={can(ctx.actor, "edit", { workspaceId: ws, module: "list" })} />
    </div>
  );
}
