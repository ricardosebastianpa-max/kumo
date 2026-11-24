import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { auth } from "@/lib/auth";
import { can, type Role } from "@/lib/domain/permissions";

/** Private image bytes. Only members of the image's workspace who can view the catalog get them. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const [m] = await db.select().from(s.media).where(and(eq(s.media.id, id), isNull(s.media.deletedAt)));
  if (!m) return new Response("Not found", { status: 404 });
  const [mem] = await db.select().from(s.membership).where(and(eq(s.membership.workspaceId, m.workspaceId), eq(s.membership.userId, session.user.id)));
  const actor = { userId: session.user.id, membership: mem ? { workspaceId: mem.workspaceId, role: mem.role as Role, permissions: mem.permissions } : null };
  if (!can(actor, "view", { workspaceId: m.workspaceId, module: "catalog" })) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(m.bytes), { headers: { "Content-Type": m.mime, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
