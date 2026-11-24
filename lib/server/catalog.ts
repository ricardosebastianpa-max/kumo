import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { scoreInstitution } from "@/lib/domain/score-institution";
import type { ScoringParams } from "@/lib/domain/scoring";

export async function activeModel(workspaceId: string) {
  const [m] = await db.select().from(s.scoringModel).where(and(eq(s.scoringModel.workspaceId, workspaceId), eq(s.scoringModel.isActive, true))).orderBy(desc(s.scoringModel.version)).limit(1);
  return m ? { ...m, params: m.params as unknown as ScoringParams } : null;
}

export async function institutionsScored(workspaceId: string) {
  const [rows, model] = await Promise.all([
    db.select().from(s.institution).where(and(eq(s.institution.workspaceId, workspaceId), isNull(s.institution.deletedAt))),
    activeModel(workspaceId),
  ]);
  return rows.map((i) => ({ i, score: model ? scoreInstitution(i as never, model.params) : null })).sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));
}
