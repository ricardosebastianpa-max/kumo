import { getTranslations } from "next-intl/server";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { ImportFlow } from "./flow";

export async function generateMetadata() { return { title: (await getTranslations("import"))("title") }; }
export default async function ImportPage() {
  const ctx = await requireWorkspace();
  if (!can(ctx.actor, "edit", { workspaceId: ctx.workspace.id, module: "settings" })) redirect("/app");
  const t = await getTranslations("import");
  const history = await db.select().from(s.seedPack).where(eq(s.seedPack.workspaceId, ctx.workspace.id)).orderBy(desc(s.seedPack.importedAt)).limit(5);
  return (
    <div className="grid max-w-2xl gap-6 pt-6">
      <div className="grid gap-2"><h1 className="text-4xl">{t("title")}</h1><p className="text-ink-2 text-lg leading-relaxed">{t("lead")}</p></div>
      <ImportFlow />
      {history.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-xl">{t("history")}</h2>
          <ul className="grid gap-1 text-sm text-ink-2">
            {history.map((h) => <li key={h.id}>{h.title} · v{h.version} · {h.importedAt.toISOString().slice(0, 16).replace("T", " ")} UTC</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
