import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { CSCA } from "@/lib/csca/data";

/** Makes sure every hard-wired CSCA item has a progress row (done/notes) in this workspace. Idempotent. */
export async function cscaProgress(ws: string, userId: string) {
  let rows = await db.select({ id: s.studyResource.id, key: s.studyResource.externalKey, done: s.studyResource.done, notes: s.studyResource.notes }).from(s.studyResource).where(eq(s.studyResource.workspaceId, ws));
  const have = new Set(rows.map((r) => r.key));
  const missing = CSCA.filter((c) => !have.has(c.key));
  if (missing.length) {
    await db.insert(s.studyResource).values(missing.map((c) => ({ workspaceId: ws, externalKey: c.key, kind: c.kind, position: c.n, phase: c.phase, topic: c.topic, level: c.level, lang: c.lang, title: c.title, source: c.source, type: c.type, focus: c.focus, url: c.url, urlIsSearch: false, createdBy: userId }))).onConflictDoNothing();
    rows = await db.select({ id: s.studyResource.id, key: s.studyResource.externalKey, done: s.studyResource.done, notes: s.studyResource.notes }).from(s.studyResource).where(and(eq(s.studyResource.workspaceId, ws)));
  }
  return Object.fromEntries(rows.map((r) => [r.key, { id: r.id, done: r.done, notes: r.notes }]));
}
