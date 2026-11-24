import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { auth } from "@/lib/auth";

/** Full export of the owner's workspace as JSON (images as ids; download them from /api/media). */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const [m] = await db.select().from(s.membership).where(eq(s.membership.userId, session.user.id));
  if (!m || m.role !== "owner") return new Response("Forbidden", { status: 403 });
  const ws = m.workspaceId;
  const by = <T extends { workspaceId: unknown }>(t: T) => db.select().from(t as never).where(eq((t as unknown as typeof s.event).workspaceId, ws));
  const tables = { workspace: db.select().from(s.workspace).where(eq(s.workspace.id, ws)), profile: by(s.studentProfile), institutions: by(s.institution), programs: by(s.program), scholarships: by(s.scholarship), events: by(s.event),
    list: by(s.targetListItem), applications: by(s.application), documents: by(s.document), recommenders: by(s.recommender), expenses: by(s.expense), messages: by(s.message), budgets: by(s.budgetScenario),
    scoringModels: by(s.scoringModel), study: by(s.studyResource), sessions: by(s.studySession), practiceTests: by(s.practiceTest), checkins: by(s.checkin), essays: by(s.essay), activity: by(s.activityLog) };
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString() };
  for (const [k, q] of Object.entries(tables)) out[k] = await q;
  return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="kumo-export-${new Date().toISOString().slice(0, 10)}.json"` } });
}
