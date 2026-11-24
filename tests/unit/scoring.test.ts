import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { loadCentroPack } from "@/lib/seed/load-centro";
import { scoreInstitution } from "@/lib/domain/score-institution";
import type { ScoringParams } from "@/lib/domain/scoring";
import { PackPack } from "@/lib/seed/schema";

const DIR = process.env.KUMO_PRIVATE_DATA ?? "private/data";
const has = existsSync(DIR);

describe.skipIf(!has)("scoring regression (private seed)", () => {
  const pack = PackPack.parse(loadCentroPack(DIR));
  const params = pack.scoringModel!.params as unknown as ScoringParams;
  const scored = pack.institutions.map((i) => ({ slug: i.slug, r: scoreInstitution(i as never, params), legacy: (i.details as { legacy: { scores: { total: number } } }).legacy.scores.total }))
    .sort((a, b) => b.r.total - a.r.total);

  it("top 4 is HIT ≈79, Beihang ≈72, Northeastern ≈72, BIT ≈71 (±1)", () => {
    const top = scored.slice(0, 4);
    expect(new Set(top.map((x) => x.slug))).toEqual(new Set(["hit", "buaa", "neu", "bit"]));
    const want: Record<string, number> = { hit: 79, buaa: 72, neu: 72, bit: 71 };
    for (const t of top) expect(Math.abs(t.r.total - want[t.slug])).toBeLessThanOrEqual(1);
  });
  it("every institution matches the research total within ±1", () => {
    const off = scored.filter((x) => Math.abs(x.r.total - x.legacy) > 1).map((x) => `${x.slug}: ${x.r.total} vs ${x.legacy}`);
    expect(off).toEqual([]);
  });
  it("pack is valid and complete", () => {
    expect(pack.institutions).toHaveLength(65);
    expect(pack.events.filter((e) => e.key.startsWith("ev:"))).toHaveLength(56);
    expect(pack.scholarships.filter((s) => s.scope === "local_government")).toHaveLength(19);
  });
});
