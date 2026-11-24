import { parseRank, scoreOption, type OptionInput, type ScoringParams } from "./scoring";

/** Maps a stored institution row (catalog JSON) to scoring input. Pure. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function institutionToInput(i: { tiers: string[]; rankings: any[]; climate?: any; costOfLiving?: any; admission?: any; finance?: any; details?: any }): OptionInput {
  const sc = i.details?.scoring ?? {};
  const qs = i.rankings?.find((r) => r.source === "QS");
  return {
    tiers: i.tiers ?? [],
    tierPointsOverride: sc.tierPointsOverride ?? null,
    rankPointsOverride: sc.rankPointsOverride ?? null,
    rank: qs?.rank ?? parseRank(qs?.label),
    fitKey: sc.fitKey ?? "none",
    tuitionPerYear: Number(i.finance?.tuitionYear ?? 0),
    livingPerMonth: Number(i.costOfLiving?.month ?? 0),
    scholarship: { pFull: +(i.finance?.pFull ?? 0), fullValue: +(i.finance?.fullValue ?? 0), pPartial: +(i.finance?.pPartial ?? 0), partialValue: +(i.finance?.partialValue ?? 0) },
    climate: { janLowC: i.climate?.janLowC ?? null, centralHeating: i.climate?.centralHeating ?? null, charm: i.climate?.charm ?? null },
    admission: { low: i.admission?.low ?? null, high: i.admission?.high ?? null },
  };
}
export const scoreInstitution = (i: Parameters<typeof institutionToInput>[0], p: ScoringParams) => scoreOption(institutionToInput(i), p);
