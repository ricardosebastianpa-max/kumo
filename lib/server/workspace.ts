import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db";
import * as s from "@/db/schema";
import { slugify } from "@/lib/seed/adapters/centro-v0";
import { isValidTimeZone } from "@/lib/domain/time";

const isUniqueViolation = (e: unknown) => {
  const x = e as { code?: string; cause?: { code?: string } };
  return x?.code === "23505" || x?.cause?.code === "23505";
};

/** Creates a workspace + owner membership. Slug collisions (even concurrent ones) retry with a suffix. */
export async function createWorkspace(db: DB, ownerId: string, input: { name: string; timezone?: string; locale?: "es" | "en" }) {
  const tz = input.timezone && isValidTimeZone(input.timezone) ? input.timezone : "UTC";
  const base = slugify(input.name) || "kumo";
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        let slug = attempt === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 6)}`;
        if (attempt === 0 && (await tx.select({ id: s.workspace.id }).from(s.workspace).where(eq(s.workspace.slug, slug)).limit(1)).length) slug = `${base}-${crypto.randomUUID().slice(0, 6)}`;
        const [w] = await tx.insert(s.workspace).values({ name: input.name, slug, timezone: tz, locale: input.locale ?? "es", createdBy: ownerId }).returning();
        await tx.insert(s.membership).values({ workspaceId: w.id, userId: ownerId, role: "owner" });
        await tx.insert(s.activityLog).values({ workspaceId: w.id, actorId: ownerId, action: "create", resourceType: "workspace", resourceId: w.id });
        return w;
      });
    } catch (e) {
      if (!isUniqueViolation(e) || attempt === 5) throw e;
    }
  }
  throw new Error("unreachable");
}
