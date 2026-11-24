import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { normStage } from "./list";
import { fmtWhen } from "@/lib/format";

/** Everything the detail page needs for pondering and enrichment of one option. */
export async function enrichData(ws: string, kind: "institution" | "scholarship", refId: string, tz: string, locale: string) {
  const col = kind === "institution" ? s.targetListItem.institutionId : s.targetListItem.scholarshipId;
  const evCol = kind === "institution" ? s.event.institutionId : s.event.scholarshipId;
  const [[item], photos, tasks] = await Promise.all([
    db.select().from(s.targetListItem).where(and(eq(s.targetListItem.workspaceId, ws), eq(s.targetListItem.list, "main"), eq(col, refId), isNull(s.targetListItem.deletedAt))).limit(1),
    db.select({ id: s.media.id, isCover: s.media.isCover, caption: s.media.caption }).from(s.media).where(and(eq(s.media.workspaceId, ws), eq(s.media.resourceType, kind), eq(s.media.resourceId, refId), isNull(s.media.deletedAt))).orderBy(desc(s.media.isCover), asc(s.media.createdAt)),
    db.select().from(s.event).where(and(eq(s.event.workspaceId, ws), eq(evCol, refId), eq(s.event.kind, "task"), isNull(s.event.deletedAt))).orderBy(asc(s.event.startsAt)),
  ]);
  return {
    stage: normStage(item?.status ?? null),
    ponder: { gut: item?.gut ?? null, pros: item?.pros ?? [], cons: item?.cons ?? [], notes: item?.notes ?? null },
    photos,
    cover: photos.find((p) => p.isCover) ? `/api/media/${photos.find((p) => p.isCover)!.id}` : null,
    tasks: tasks.map((e) => ({ id: e.id, title: e.title, when: fmtWhen(e, tz, locale).main, done: !!e.completedAt })),
  };
}
