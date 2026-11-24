import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { open } from "./secrets";

type AiCfg = { provider: "anthropic" | "openrouter"; key: string; model: string };
/** Key from the workspace settings (entered in the app, encrypted) or, as a fallback, the server env. */
async function aiConfig(ws: string): Promise<AiCfg | null> {
  const [w] = await db.select({ settings: s.workspace.settings }).from(s.workspace).where(eq(s.workspace.id, ws));
  const ai = (w?.settings as { ai?: { provider: AiCfg["provider"]; key: string; model?: string } } | undefined)?.ai;
  if (ai?.key) { const k = open(ai.key); if (k) return { provider: ai.provider, key: k, model: ai.model || (ai.provider === "openrouter" ? "anthropic/claude-sonnet-4.5" : "claude-sonnet-5-5") }; }
  if (process.env.ANTHROPIC_API_KEY) return { provider: "anthropic", key: process.env.ANTHROPIC_API_KEY, model: process.env.KUMO_AI_MODEL ?? "claude-sonnet-5-5" };
  return null;
}
export async function askModel(ws: string, system: string, user: string): Promise<string | null> {
  const cfg = await aiConfig(ws);
  if (!cfg) return null;
  if (cfg.provider === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${cfg.key}`, "X-Title": "Kumo" },
      body: JSON.stringify({ model: cfg.model, max_tokens: 900, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`ai ${res.status}`);
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content ?? "";
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: cfg.model, max_tokens: 900, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`ai ${res.status}`);
  const j = (await res.json()) as { content?: { type: string; text?: string }[] };
  return j.content?.filter((c) => c.type === "text").map((c) => c.text).join("\n") ?? "";
}
