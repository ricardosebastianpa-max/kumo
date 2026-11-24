import { timingSafeEqual } from "node:crypto";
import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as s from "@/db/schema";

/**
 * Admin-only password recovery while there is no email provider: with the secret KUMO_ADMIN_TOKEN
 * (set only in Vercel) it issues a normal one-time reset link (1 hour) and returns it.
 */
export async function POST(req: Request) {
  const expected = process.env.KUMO_ADMIN_TOKEN;
  const got = req.headers.get("x-admin-token") ?? "";
  if (!expected || expected.length < 32 || got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) return new Response("Not found", { status: 404 });
  const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(await req.json());
  const since = new Date();
  await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: req.headers });
  const [row] = await db.select().from(s.authOutbox).where(and(eq(s.authOutbox.email, email), gte(s.authOutbox.createdAt, since))).orderBy(desc(s.authOutbox.createdAt)).limit(1);
  return Response.json(row ? { url: row.url } : { error: "no user with that email" }, { status: row ? 200 : 404 });
}
