import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/db/schema";
import { slugify } from "@/lib/seed/adapters/centro-v0";
import { isValidTimeZone } from "@/lib/domain/time";

export async function createWorkspace(db: DB, ownerId: string, input: { name: string; timezone?: string; locale?: "es" | "en" }) {
  const tz = input.timezone && isValidTimeZone(input.timezone) ? input.timezone : "UTC";
  const base = slugify(input.name) || "kumo";
  return db.transaction(async (tx) => {
    let slug = base, n = 2;
    while ((await tx.select({ id: s.workspace.id }).from(s.workspace).where(eq(s.workspace.slug, slug)).limit(1)).length) slug = `${base}-${n++}`;
    const [w] = await tx.insert(s.workspace).values({ name: input.name, slug, timezone: tz, locale: input.locale ?? "es", createdBy: ownerId }).returning();
    await tx.insert(s.membership).values({ workspaceId: w.id, userId: ownerId, role: "owner" });
    await tx.insert(s.activityLog).values({ workspaceId: w.id, actorId: ownerId, action: "create", resourceType: "workspace", resourceId: w.id });
    return w;
  });
}
