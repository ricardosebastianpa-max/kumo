import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { SchTable, type SchRow } from "./table";
import { ExploreTabs } from "@/components/explore-tabs";
import { stagesFor } from "@/lib/server/list";

export async function generateMetadata() { return { title: (await getTranslations("catalog"))("schTitle") }; }
export default async function Scholarships() {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  if (!can(ctx.actor, "view", { workspaceId: ws, module: "catalog" })) redirect("/app");
  const t = await getTranslations("catalog");
  const [rows, evs] = await Promise.all([
    db.select().from(s.scholarship).where(and(eq(s.scholarship.workspaceId, ws), isNull(s.scholarship.deletedAt))),
    db.select({ sid: s.event.scholarshipId, at: s.event.startsAt, tz: s.event.timezone }).from(s.event).where(and(eq(s.event.workspaceId, ws), isNull(s.event.deletedAt), isNotNull(s.event.scholarshipId))),
  ]);
  const stages = await stagesFor(ws, rows.map((x) => x.id));
  const next = new Map<string, string>();
  for (const e of evs) { const d = new Intl.DateTimeFormat("en-CA", { timeZone: e.tz }).format(e.at); if (!next.has(e.sid!) || d < next.get(e.sid!)!) next.set(e.sid!, d); }
  const list: SchRow[] = rows.map((x) => ({
    id: x.id, stage: stages.get(x.id) ?? "exploring",
    slug: x.slug, name: x.name, country: x.country, scope: x.scope, confidence: x.confidence, deadline: next.get(x.id) ?? null,
    coverage: ((x.coverage as { text?: string; summary?: string; items?: string[] } | null)?.summary ?? (x.coverage as { text?: string } | null)?.text ?? ((x.coverage as { items?: string[] } | null)?.items ?? []).join(", ")) || null,
  })).sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  return (
    <div className="grid gap-6 pt-2">
      <ExploreTabs active="schs" />
      <div className="grid gap-2"><h1 className="text-4xl">{t("schTitle")}</h1><p className="max-w-[60ch] text-lg text-ink-2">{t("schLead", { n: list.length })}</p></div>
      <SchTable rows={list} canList={can(ctx.actor, "edit", { workspaceId: ws, module: "list" })} />
    </div>
  );
}
