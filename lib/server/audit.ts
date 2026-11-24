import "server-only";
import { db } from "@/lib/db";
import * as s from "@/db/schema";

/** Field-level diff of `next` against `prev` (only keys present in `next`). Dates compare by instant. */
export function diff(prev: Record<string, unknown>, next: Record<string, unknown>) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(next)) {
    const a = prev[k];
    const same = a instanceof Date || v instanceof Date ? new Date(a as string).getTime() === new Date(v as string).getTime() : JSON.stringify(a ?? null) === JSON.stringify(v ?? null);
    if (!same) out[k] = { from: a ?? null, to: v ?? null };
  }
  return out;
}

export async function audit(entry: { workspaceId: string; actorId: string; action: string; resourceType: string; resourceId: string; diff?: Record<string, { from: unknown; to: unknown }>; meta?: Record<string, unknown> }) {
  await db.insert(s.activityLog).values(entry);
}
