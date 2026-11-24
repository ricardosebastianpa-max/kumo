import { getTranslations } from "next-intl/server";
import { requireWorkspace } from "@/lib/server/session";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { FocusTimer } from "./timer";

export async function generateMetadata() { return { title: (await getTranslations("focus"))("title") }; }
export default async function Focus({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const ctx = await requireWorkspace();
  const [plan] = await db.select().from(s.studyPlan).where(eq(s.studyPlan.workspaceId, ctx.workspace.id)).limit(1);
  const subjects = Object.keys(plan?.weeklyHours ?? {}).map((k) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
  return <FocusTimer subjects={subjects.length ? subjects : ["Matemáticas", "Física", "Inglés"]} initial={(await searchParams).s ?? null} />;
}
