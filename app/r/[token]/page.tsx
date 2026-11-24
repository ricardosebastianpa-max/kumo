import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { Kumo } from "@/components/kumo";
import { Reply } from "./reply";

export const dynamic = "force-dynamic";
/** Public page for a recommender: no account, token only, shows only what the student asked. */
export default async function RecommenderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) notFound();
  const [r] = await db.select({ r: s.recommender, owner: s.studentProfile.displayName, ws: s.workspace.name }).from(s.recommender)
    .innerJoin(s.workspace, eq(s.workspace.id, s.recommender.workspaceId)).leftJoin(s.studentProfile, eq(s.studentProfile.workspaceId, s.recommender.workspaceId))
    .where(and(eq(s.recommender.token, token), isNull(s.recommender.deletedAt)));
  if (!r) notFound();
  const t = await getTranslations("recs");
  const student = (r.owner ?? r.ws).split(" ")[0];
  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-md content-center gap-5 px-4 py-10">
      <Kumo state="cheering" size={90} className="text-ink" />
      <h1 className="text-3xl">{t("publicTitle", { student })}</h1>
      {r.r.ask && <section className="grid gap-1"><h2 className="font-sans text-sm font-semibold text-mute">{t("publicWhat")}</h2><p className="text-lg">{r.r.ask}</p></section>}
      {r.r.dueOn && <p className="font-semibold">{t("publicDue", { date: r.r.dueOn })}</p>}
      <Reply token={token} student={student} />
    </main>
  );
}
