import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { Kumo } from "@/components/kumo";
import { ButtonLink } from "@/components/ui";
import { AppsView } from "./view";

export async function generateMetadata() { return { title: (await getTranslations("apps"))("title") }; }
export default async function Applications() {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  if (!can(ctx.actor, "view", { workspaceId: ws, module: "applications" })) redirect("/app");
  const t = await getTranslations("apps");
  const apps = await db.select().from(s.application).where(and(eq(s.application.workspaceId, ws), isNull(s.application.deletedAt))).orderBy(asc(s.application.createdAt));
  const items = apps.length ? await db.select().from(s.applicationItem).where(inArray(s.applicationItem.applicationId, apps.map((a) => a.id))).orderBy(asc(s.applicationItem.position)) : [];
  const slugs = new Map((await db.select({ id: s.institution.id, slug: s.institution.slug }).from(s.institution).where(eq(s.institution.workspaceId, ws))).map((x) => [x.id, x.slug]));
  if (!apps.length) return (
    <div className="grid max-w-xl justify-items-start gap-4 pt-6"><Kumo state="awake" size={110} className="text-ink" /><h1 className="text-4xl">{t("title")}</h1><p className="text-lg text-ink-2">{t("empty")}</p><ButtonLink href="/app/list">Mi lista</ButtonLink></div>
  );
  return <AppsView canEdit={can(ctx.actor, "edit", { workspaceId: ws, module: "applications" })}
    apps={apps.map((a) => ({ ...a, href: a.institutionId ? `/app/universities/${slugs.get(a.institutionId)}` : null, submittedAt: a.submittedAt?.toISOString() ?? null, items: items.filter((i) => i.applicationId === a.id) }))} />;
}
