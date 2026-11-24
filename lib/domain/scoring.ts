/**
 * Generic option scoring. All numbers come from a scoring_model's params; nothing here knows a country.
 * Returns the total, a breakdown per component and readable explanations.
 */
export interface ScoringParams {
  weights: Record<string, number>; // e.g. { prestige: 35, fit: 20, finance: 35, climate_city: 10 }
  prestige: {
    tierPoints: Record<string, number>; // best tier wins
    rankPoints: [number | "unranked", number][]; // [maxRank, points], ascending, last may be "unranked"
    maxRaw: number; // tier max + rank max (normalises to weights.prestige)
  };
  fit: { points: Record<string, number>; maxRaw: number };
  finance: {
    scenarios: { key: string; amountPerYear: number; points: number }[]; // sum(points) = weights.finance
    insurancePerYear: number;
    /** A net cost up to budget × (1 + tolerance) still counts as affordable. */
    tolerance?: number;
  };
  climate: {
    coldBands: [number, number][]; // [janLowMaxC, points], ascending threshold
    noHeatingPenaltyBelowC?: number; // band threshold where missing heating lowers points by 1
    charmMax: number;
  };
  categories: { thresholds: { label: string; min: number }[]; centralScenario: string };
}

export interface OptionInput {
  tiers: string[];
  /** Explicit, documented manual assessments that replace the table lookups (editable in the UI). */
  tierPointsOverride?: number | null;
  rankPointsOverride?: number | null;
  rank: number | null;
  fitKey: string;
  tuitionPerYear: number;
  livingPerMonth: number;
  scholarship: { pFull: number; fullValue: number; pPartial: number; partialValue: number };
  climate: { janLowC: number | null; centralHeating: boolean | null; charm: number | null };
  admission: { low: number | null; high: number | null }; // percent
}

export interface ScoreResult {
  total: number;
  parts: { prestige: number; fit: number; finance: number; climate_city: number };
  raw: { tier: number; rank: number; fit: number; climate: number; charm: number };
  affordability: Record<string, number>;
  netCost: { full: number; partial: number; none: number; expected: number };
  category: string | null;
  successChance: number | null;
  reasons: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function rankPoints(rank: number | null, table: ScoringParams["prestige"]["rankPoints"]): number {
  for (const [max, pts] of table) {
    if (max === "unranked") continue;
    if (rank !== null && rank <= max) return pts;
  }
  const un = table.find(([m]) => m === "unranked");
  return un ? un[1] : 0;
}

export function tierPoints(tiers: string[], table: Record<string, number>): number {
  return tiers.reduce((best, t) => Math.max(best, table[t] ?? 0), 0);
}

export function climatePoints(c: OptionInput["climate"], p: ScoringParams["climate"]): number {
  if (c.janLowC === null) return 0;
  for (const [max, pts] of p.coldBands) {
    if (c.janLowC <= max) {
      const penal = p.noHeatingPenaltyBelowC !== undefined && max === p.noHeatingPenaltyBelowC && c.centralHeating === false;
      return penal ? pts - 1 : pts;
    }
  }
  return 0;
}

export function scoreOption(o: OptionInput, p: ScoringParams): ScoreResult {
  const reasons: string[] = [];
  const tier = o.tierPointsOverride ?? tierPoints(o.tiers, p.prestige.tierPoints);
  const rank = o.rankPointsOverride ?? rankPoints(o.rank, p.prestige.rankPoints);
  const prestige = ((tier + rank) / p.prestige.maxRaw) * (p.weights.prestige ?? 0);

  const fitRaw = p.fit.points[o.fitKey] ?? 0;
  const fit = (fitRaw / p.fit.maxRaw) * (p.weights.fit ?? 0);

  const gross = o.tuitionPerYear + o.livingPerMonth * 12 + p.finance.insurancePerYear;
  const s = o.scholarship;
  const pNone = Math.max(0, 1 - s.pFull - s.pPartial);
  const outcomes = [
    { p: s.pFull, net: gross - s.fullValue },
    { p: s.pPartial, net: gross - s.partialValue },
    { p: pNone, net: gross },
  ];
  const affordability: Record<string, number> = {};
  let finance = 0;
  for (const sc of p.finance.scenarios) {
    const pa = outcomes.reduce((acc, x) => acc + (x.net <= sc.amountPerYear * (1 + (p.finance.tolerance ?? 0)) ? x.p : 0), 0);
    affordability[sc.key] = round1(pa * 100) / 100;
    finance += sc.points * pa;
  }
  const expected = outcomes.reduce((a, x) => a + x.p * x.net, 0);

  const climate = climatePoints(o.climate, p.climate);
  const charm = Math.min(o.climate.charm ?? 0, p.climate.charmMax);
  const climate_city = Math.min(climate + charm, p.weights.climate_city ?? 0);

  const total = round1(prestige + fit + finance + climate_city);

  const central = p.categories.centralScenario;
  let successChance: number | null = null;
  let category: string | null = null;
  if (o.admission.low !== null && o.admission.high !== null) {
    const mid = (o.admission.low + o.admission.high) / 200;
    successChance = mid * (affordability[central] ?? 0);
    category = p.categories.thresholds.find((t) => successChance! >= t.min)?.label ?? null;
  }

  const lostFinance = (p.weights.finance ?? 0) - finance;
  if (lostFinance >= 8) {
    const miss = p.finance.scenarios.filter((sc) => (affordability[sc.key] ?? 0) < 1).map((sc) => sc.key);
    reasons.push(`finance:-${Math.round(lostFinance)}:${miss.join(",")}`);
  }
  if (fitRaw < p.fit.maxRaw) reasons.push(`fit:-${Math.round((p.weights.fit ?? 0) - fit)}:${o.fitKey}`);
  if (tier + rank < p.prestige.maxRaw * 0.7) reasons.push(`prestige:-${Math.round((p.weights.prestige ?? 0) - prestige)}`);

  return {
    total,
    parts: { prestige: round1(prestige), fit: round1(fit), finance: round1(finance), climate_city: round1(climate_city) },
    raw: { tier, rank, fit: fitRaw, climate, charm },
    affordability,
    netCost: { full: outcomes[0].net, partial: outcomes[1].net, none: outcomes[2].net, expected: Math.round(expected) },
    category,
    successChance: successChance === null ? null : Math.round(successChance * 1000) / 1000,
    reasons,
  };
}

/** Parse a ranking band like "≈190–217 · THE =131" or "#45" into the first QS-style rank number. */
export function parseRank(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.replace(/[.,](?=\d{3})/g, "").match(/(\d{1,4})/);
  return m ? Number(m[1]) : null;
}
