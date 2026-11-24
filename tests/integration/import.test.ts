import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { count, eq } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://kumo:kumo@localhost:5432/kumo_test";
const DIR = process.env.KUMO_PRIVATE_DATA ?? "private/data";

describe.skipIf(!existsSync(DIR))("seed import (Postgres)", async () => {
  const { db, sqlClient } = await import("@/lib/db");
  const s = await import("@/db/schema");
  const { importSeedPack } = await import("@/lib/seed/import");
  const { loadCentroPack } = await import("@/lib/seed/load-centro");
  const { createWorkspace } = await import("@/lib/server/workspace");
  let wsId = "";
  const uid = `u-${Date.now()}`;

  beforeAll(async () => {
    await db.insert(s.user).values({ id: uid, name: "Test", email: `${uid}@example.test` });
    wsId = (await createWorkspace(db, uid, { name: "Test space", timezone: "America/Managua" })).id;
  });
  afterAll(async () => { await db.delete(s.workspace).where(eq(s.workspace.id, wsId)); await db.delete(s.user).where(eq(s.user.id, uid)); await sqlClient.end(); });

  const pack = loadCentroPack(DIR);

  it("dry run writes nothing", async () => {
    const r = await importSeedPack(db, wsId, pack, { actorId: uid, dryRun: true });
    expect(r.preview.institution.create).toBe(65);
    const [{ n }] = await db.select({ n: count() }).from(s.institution).where(eq(s.institution.workspaceId, wsId));
    expect(n).toBe(0);
  });
  it("imports everything without unresolved relations", async () => {
    const r = await importSeedPack(db, wsId, pack, { actorId: uid });
    expect(r.unresolved).toEqual([]);
    const c = async (t: typeof s.institution | typeof s.event | typeof s.scholarship) => (await db.select({ n: count() }).from(t as typeof s.institution).where(eq((t as typeof s.institution).workspaceId, wsId)))[0].n;
    expect(await c(s.institution)).toBe(65);
    expect(await c(s.scholarship)).toBeGreaterThanOrEqual(111 + 19);
    expect(await c(s.event)).toBeGreaterThanOrEqual(56);
  });
  it("is idempotent: second import changes nothing", async () => {
    const r = await importSeedPack(db, wsId, pack, { actorId: uid });
    for (const [k, v] of Object.entries(r.preview)) expect({ k, create: v.create, update: v.update }).toEqual({ k, create: 0, update: 0 });
  });
  it("stores Beijing deadlines in UTC with their original zone", async () => {
    const [e] = await db.select().from(s.event).where(eq(s.event.title, "CSCA dic: abre el registro"));
    expect(e.timezone).toBe("Asia/Shanghai");
    expect(e.startsAt.toISOString()).toBe("2026-11-25T07:00:00.000Z");
  });
});
