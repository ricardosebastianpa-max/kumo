import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { dateInZone } from "@/lib/domain/time";
import { ProgressClient } from "./client";

export async function generateMetadata() { return { title: (await getTranslations("progress"))("title") }; }
export default async function Progress() {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  if (!can(ctx.actor, "view", { workspaceId: ws, module: "study" })) redirect("/app");
  const owner = ctx.role === "owner";
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const [sessions, plan, tests, checks] = await Promise.all([
    db.select({ subject: s.studySession.subject, m: s.studySession.minutes }).from(s.studySession).where(and(eq(s.studySession.workspaceId, ws), gte(s.studySession.startedAt, weekAgo))),
    db.select().from(s.studyPlan).where(eq(s.studyPlan.workspaceId, ws)).limit(1),
    db.select().from(s.practiceTest).where(eq(s.practiceTest.workspaceId, ws)).orderBy(asc(s.practiceTest.takenOn)),
    owner ? db.select().from(s.checkin).where(eq(s.checkin.workspaceId, ws)).orderBy(desc(s.checkin.day)).limit(7) : Promise.resolve([]),
  ]);
  const done: Record<string, number> = {};
  for (const x of sessions) done[x.subject] = (done[x.subject] ?? 0) + x.m / 60;
  const goals = plan[0]?.weeklyHours ?? {};
  const overload = checks.filter((c) => (c.stress ?? 0) >= 4 || (c.sleep ?? 5) <= 2).length >= 3;
  return <ProgressClient goals={goals} done={done} owner={owner} overload={overload} today={dateInZone(new Date(), ctx.user.timezone || ctx.workspace.timezone)}
    canEdit={can(ctx.actor, "edit", { workspaceId: ws, module: "study" })} checkin={checks[0]?.day === dateInZone(new Date(), ctx.user.timezone || ctx.workspace.timezone) ? checks[0] : null}
    tests={tests.map((x) => ({ id: x.id, exam: x.exam, section: x.section, score: x.score, maxScore: x.maxScore, takenOn: x.takenOn }))} />;
}
