import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";

/** What the UI may know about the AI connection (never the key itself). */
export async function aiStatus(ws: string) {
  const [w] = await db.select({ settings: s.workspace.settings }).from(s.workspace).where(eq(s.workspace.id, ws));
  const ai = (w?.settings as { ai?: { provider: "anthropic" | "openrouter"; model?: string; last4?: string } } | undefined)?.ai;
  if (ai) return { on: true, source: "app" as const, provider: ai.provider, model: ai.model ?? null, last4: ai.last4 ?? null };
  if (process.env.ANTHROPIC_API_KEY) return { on: true, source: "env" as const, provider: "anthropic" as const, model: null, last4: null };
  return { on: false, source: null, provider: null, model: null, last4: null };
}
