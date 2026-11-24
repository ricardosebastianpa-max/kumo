import { and, eq, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { buildIcs } from "@/lib/domain/ics";

export const dynamic = "force-dynamic";
/** Secret-token ICS feed (Google/Apple Calendar subscription). Token rotates from the subscribe page. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tok = token.replace(/\.ics$/, "");
  if (!/^[a-f0-9]{32}$/.test(tok)) return new Response("Not found", { status: 404 });
  const [w] = await db.select().from(s.workspace).where(and(eq(s.workspace.icsToken, tok), isNull(s.workspace.deletedAt)));
  if (!w) return new Response("Not found", { status: 404 });
  const rows = await db.select().from(s.event).where(and(eq(s.event.workspaceId, w.id), isNull(s.event.deletedAt)));
  const t = await getTranslations({ locale: w.locale === "en" ? "en" : "es", namespace: "common" });
  const origin = new URL(req.url).origin;
  const body = buildIcs(`Kumo · ${w.name}`, rows.map((r) => ({ ...r, url: `${origin}/app/calendar?e=${r.id}` })), { estimated: t("confidence.estimated").toLowerCase(), unverified: t("confidence.unverified").toLowerCase() });
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900", "Content-Disposition": 'inline; filename="kumo.ics"' } });
}
