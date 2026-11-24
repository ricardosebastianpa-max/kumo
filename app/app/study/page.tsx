import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { Kumo } from "@/components/kumo";
import { ButtonLink } from "@/components/ui";
import { StudyView } from "./view";

export async function generateMetadata() { return { title: (await getTranslations("study"))("title") }; }
export default async function Study({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  if (!can(ctx.actor, "view", { workspaceId: ws, module: "study" })) redirect("/app");
  const t = await getTranslations("study");
  const rows = await db.select({ id: s.studyResource.id, kind: s.studyResource.kind, position: s.studyResource.position, phase: s.studyResource.phase, topic: s.studyResource.topic, level: s.studyResource.level,
    lang: s.studyResource.lang, title: s.studyResource.title, source: s.studyResource.source, type: s.studyResource.type, focus: s.studyResource.focus, url: s.studyResource.url, urlIsSearch: s.studyResource.urlIsSearch, done: s.studyResource.done, notes: s.studyResource.notes })
    .from(s.studyResource).where(and(eq(s.studyResource.workspaceId, ws), isNull(s.studyResource.deletedAt))).orderBy(asc(s.studyResource.kind), asc(s.studyResource.position));
  const wanted = (await searchParams).tab;
  const tab = (["route", "deep", "channel"] as const).find((x) => x === wanted) ?? "route";
  if (!rows.length) return (
    <div className="grid max-w-xl justify-items-start gap-4 pt-6">
      <Kumo state="focused" size={110} className="text-ink" /><h1 className="text-4xl">{t("title")}</h1><p className="text-lg text-ink-2">{t("empty")}</p>
      {ctx.role === "owner" && <ButtonLink href="/app/import">{t("goImport")}</ButtonLink>}
    </div>
  );
  return <StudyView rows={rows} tab={tab} canEdit={can(ctx.actor, "edit", { workspaceId: ws, module: "study" })} />;
}
