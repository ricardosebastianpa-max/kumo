import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { activeModel } from "@/lib/server/catalog";
import { ModelEditor } from "./editor";

export async function generateMetadata() { return { title: (await getTranslations("model"))("title") }; }
export default async function ModelPage() {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  if (!can(ctx.actor, "view", { workspaceId: ws, module: "catalog" })) redirect("/app");
  const model = await activeModel(ws);
  if (!model) redirect("/app/import");
  const insts = await db.select({ slug: s.institution.slug, name: s.institution.name, tiers: s.institution.tiers, rankings: s.institution.rankings, climate: s.institution.climate, costOfLiving: s.institution.costOfLiving, admission: s.institution.admission, finance: s.institution.finance, details: s.institution.details })
    .from(s.institution).where(and(eq(s.institution.workspaceId, ws), isNull(s.institution.deletedAt)));
  return <ModelEditor params={model.params} version={model.version} insts={insts as never} canEdit={can(ctx.actor, "edit", { workspaceId: ws, module: "settings" })} />;
}
