import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://kumo:kumo@localhost:5432/kumo_test";

describe("demo pack (fictional, runs in CI)", async () => {
  const { db, sqlClient } = await import("@/lib/db");
  const s = await import("@/db/schema");
  const { importSeedPack } = await import("@/lib/seed/import");
  const { createWorkspace } = await import("@/lib/server/workspace");
  const { scoreInstitution } = await import("@/lib/domain/score-institution");
  const pack = JSON.parse(readFileSync("seed/demo-pack.json", "utf8"));
  const uid = `demo-${Date.now()}`;
  let ws = "";
  beforeAll(async () => { await db.insert(s.user).values({ id: uid, name: "Demo", email: `${uid}@example.test` }); ws = (await createWorkspace(db, uid, { name: "Demo" })).id; });
  afterAll(async () => { await db.delete(s.workspace).where(eq(s.workspace.id, ws)); await db.delete(s.user).where(eq(s.user.id, uid)); await sqlClient.end(); });

  it("imports cleanly and twice is a no-op", async () => {
    const a = await importSeedPack(db, ws, pack, { actorId: uid });
    expect(a.unresolved).toEqual([]);
    const b = await importSeedPack(db, ws, pack, { actorId: uid });
    expect(Object.values(b.preview).every((v) => v.create === 0 && v.update === 0)).toBe(true);
  });
  it("scores every demo institution between 0 and 100 with a category", () => {
    for (const i of pack.institutions) {
      const r = scoreInstitution(i, pack.scoringModel.params);
      expect(r.total).toBeGreaterThan(0); expect(r.total).toBeLessThanOrEqual(100); expect(r.category).not.toBeNull();
    }
  });
  it("createWorkspace survives concurrent creation with the same name", async () => {
    const ids = [`c1-${Date.now()}`, `c2-${Date.now()}`, `c3-${Date.now()}`];
    await db.insert(s.user).values(ids.map((id) => ({ id, name: id, email: `${id}@example.test` })));
    const ws2 = await Promise.all(ids.map((id) => createWorkspace(db, id, { name: "Mismo nombre" })));
    expect(new Set(ws2.map((w) => w.slug)).size).toBe(3);
  });
  it("unknown relation becomes a tag", async () => {
    const tags = await db.select().from(s.tag).where(eq(s.tag.workspaceId, ws));
    expect(tags.map((t) => t.slug)).toContain("documents");
  });
});

