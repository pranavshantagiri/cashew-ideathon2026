import type { CheckResult } from '@/lib/types';

export interface RiskInput {
  results: Record<number, CheckResult>;
  paymentTermsDays: number;
  weights?: [number, number, number, number];
}

export interface RiskOutput {
  strength: number;
  band: 'Strong' | 'Moderate' | 'Limited';
  riskBand: 'Low' | 'Medium' | 'High';
  components: Record<string, number>;
  componentMax: Record<string, number>;
  componentPct: Record<string, number>;
  blocking: number[];
  weights: number[];
  ruleVersion: string;
  computedAt: string;
}

export const RULE_VERSION = 'rules-v0.1';
export const DEFAULT_WEIGHTS: [number, number, number, number] = [1, 1, 1, 1];

const COMPONENTS = [
  {
    key: 'entity',
    max: 30,
    checks: [
      { id: 1, weight: 10 },
      { id: 2, weight: 5 },
      { id: 3, weight: 7 },
      { id: 4, weight: 8 },
    ],
  },
  {
    key: 'txn',
    max: 40,
    checks: [
      { id: 5, weight: 10 },
      { id: 6, weight: 8 },
      { id: 7, weight: 6 },
      { id: 8, weight: 10 },
      { id: 12, weight: 6 },
    ],
  },
  {
    key: 'buyer',
    max: 20,
    checks: [
      { id: 9, weight: 6 },
      { id: 10, weight: 4 },
      { id: 11, weight: 4 },
      { id: 14, weight: 6 },
    ],
  },
  {
    key: 'structure',
    max: 10,
    checks: [{ id: 13, weight: 5 }],
  },
] as const;

const BLOCKING_CHECKS = [5, 8, 10, 12];

function pointsFor(result: CheckResult | undefined, weight: number): number {
  if (result === 'pass') return weight;
  if (result === 'fail') return 0;
  // unknown, pending and needs-review are honest partial credit: 40% of the weight
  return weight * 0.4;
}

export function computeRisk(input: RiskInput): RiskOutput {
  const weights = (input.weights ?? DEFAULT_WEIGHTS).map((w) => Math.min(2, Math.max(0, Number(w)))) as number[];
  const components: Record<string, number> = {};
  const componentMax: Record<string, number> = {};
  const componentPct: Record<string, number> = {};
  const blocking = BLOCKING_CHECKS.filter((id) => input.results[id] === 'fail');

  COMPONENTS.forEach((c) => {
    let earned = 0;
    let max = 0;
    c.checks.forEach((ch) => {
      earned += pointsFor(input.results[ch.id], ch.weight);
      max += ch.weight;
    });
    if (c.key === 'structure') {
      const termPoints = input.paymentTermsDays <= 90 ? 5 : 2;
      earned += termPoints;
      max += 5;
    }
    components[c.key] = round2(earned);
    componentMax[c.key] = max;
    componentPct[c.key] = round2((earned / max) * 100);
  });

  const numerator = COMPONENTS.reduce(
    (sum, c, i) => sum + weights[i] * componentMax[c.key] * (componentPct[c.key] / 100),
    0,
  );
  const denominator = COMPONENTS.reduce((sum, c, i) => sum + weights[i] * componentMax[c.key], 0);
  let strength = denominator > 0 ? (100 * numerator) / denominator : 0;
  strength = round1(strength);

  let band: RiskOutput['band'] = strength >= 80 ? 'Strong' : strength >= 60 ? 'Moderate' : 'Limited';
  if (blocking.length > 0) band = 'Limited';
  const riskBand = band === 'Strong' ? 'Low' : band === 'Moderate' ? 'Medium' : 'High';

  return {
    strength,
    band,
    riskBand,
    components,
    componentMax,
    componentPct,
    blocking,
    weights,
    ruleVersion: RULE_VERSION,
    computedAt: new Date().toISOString(),
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
