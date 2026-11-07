import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '@/lib/engines/verification';
import { compareDocs } from '@/lib/engines/crossdoc';
import { computeRisk } from '@/lib/engines/risk';
import { buildOfferFromProduct, offerMath, rankOffers } from '@/lib/engines/matching';
import { checkDuplicate, verifyChain } from '@/lib/engines/registry';
import { buildPassport, verifyPassportOnServer } from '@/lib/engines/passport';
import { LENDER_PRODUCTS, SCENARIO_SPECS, makeDoc, makeTrade, seedDatabase } from '@/lib/seed';
import type { CheckResult, Doc, DocType, Trade } from '@/lib/types';

const DOC_TYPES: DocType[] = ['po', 'invoice', 'packing', 'shippingBill', 'bl'];

function docsFor(trade: Trade, scenario: 'A' | 'B' | 'C', amendedInvoice = false): Doc[] {
  const docs = DOC_TYPES.map((type) => makeDoc(trade.id, scenario, type));
  if (amendedInvoice) docs.push(makeDoc(trade.id, scenario, 'invoice', 2));
  return docs;
}

function runAll(trade: Trade, docs: Doc[], scenario: 'A' | 'B' | 'C', registry = seedDatabase(scenario).registry) {
  const results: Record<number, CheckResult> = {};
  const checks = [] as { checkId: number; result: CheckResult; line: string; evidence: unknown }[];
  for (let id = 1; id <= 14; id++) {
    const evaluation = evaluateCheck(id, {
      trade,
      docs,
      scenario,
      buyerConfirmed: false,
      shipmentStage: 0,
      registryEntries: registry,
      priorResults: {},
    });
    results[id] = evaluation.result;
    checks.push({ checkId: id, result: evaluation.result, line: evaluation.line, evidence: evaluation.evidence });
  }
  return { results, checks };
}

describe('Scenario B · cross-document fixture', () => {
  it('reports the exact quantity mismatch on check 8', () => {
    const trade = makeTrade('B');
    const docs = docsFor(trade, 'B');
    const comparison = compareDocs(docs);
    expect(comparison.pass).toBe(false);
    expect(comparison.headline).toBe(
      'Invoice quantity 4,800 does not match Bill of Lading quantity 4,200.',
    );

    const check = evaluateCheck(8, {
      trade,
      docs,
      scenario: 'B',
      buyerConfirmed: false,
      shipmentStage: 0,
      registryEntries: seedDatabase('B').registry,
      priorResults: {},
    });
    expect(check.result).toBe('fail');
    expect(check.line).toBe('Invoice quantity 4,800 does not match Bill of Lading quantity 4,200.');
  });

  it('passes check 8 after the amended invoice is added', () => {
    const trade = makeTrade('B');
    const docs = docsFor(trade, 'B', true);
    expect(compareDocs(docs).pass).toBe(true);
    const check = evaluateCheck(8, {
      trade,
      docs,
      scenario: 'B',
      buyerConfirmed: false,
      shipmentStage: 0,
      registryEntries: seedDatabase('B').registry,
      priorResults: {},
    });
    expect(check.result).toBe('pass');
  });

  it('keeps V = ₹22,31,250 after the amendment', () => {
    const amended = makeDoc('TRD-B-001', 'B', 'invoice', 2);
    expect(amended.extracted.fields.quantity.value).toBe(4200);
    expect(amended.extracted.fields.amount.value).toBe(26250);
    expect(26250 * 85).toBe(2231250);
  });
});

describe('risk engine fixtures', () => {
  it('scores 82.8 and caps at Limited on the pre-amendment trade', () => {
    const trade = makeTrade('B');
    const { results } = runAll(trade, docsFor(trade, 'B'), 'B');
    const risk = computeRisk({ results, paymentTermsDays: trade.paymentTermsDays });
    expect(risk.strength).toBe(82.8);
    expect(risk.band).toBe('Limited');
    expect(risk.blocking).toContain(8);
  });

  it('scores 92.8 and Strong after the amended invoice passes check 8', () => {
    const trade = makeTrade('B');
    const { results } = runAll(trade, docsFor(trade, 'B', true), 'B');
    const risk = computeRisk({ results, paymentTermsDays: trade.paymentTermsDays });
    expect(risk.strength).toBe(92.8);
    expect(risk.band).toBe('Strong');
    expect(risk.blocking).toEqual([]);
  });

  it('keeps the exact component maxima used by the lender sliders', () => {
    const trade = makeTrade('B');
    const { results } = runAll(trade, docsFor(trade, 'B', true), 'B');
    const risk = computeRisk({ results, paymentTermsDays: trade.paymentTermsDays });
    expect(risk.componentMax).toEqual({ entity: 30, txn: 40, buyer: 20, structure: 10 });
  });
});

describe('offer effective-cost fixture', () => {
  const invoiceValue = 26250 * 85;
  const bTrade = makeTrade('B');
  const offers = LENDER_PRODUCTS.map((product) => buildOfferFromProduct(product, bTrade, product.lenderId));

  it('reproduces 13.53%, 16.58% and 12.93%, ranked by effective cost', () => {
    const round = (n: number) => Math.round(n * 100) / 100;
    expect(round(offerMath(invoiceValue, offers[0]).effectiveAPR)).toBe(13.53);
    expect(round(offerMath(invoiceValue, offers[1]).effectiveAPR)).toBe(16.58);
    expect(round(offerMath(invoiceValue, offers[2]).effectiveAPR)).toBe(12.93);

    const ranked = rankOffers(offers, invoiceValue, 'cost');
    expect(ranked.map((o) => o.lenderId)).toEqual(['lender_meridian', 'lender_banyan', 'lender_tidewater']);
  });

  it('finds the conditional FX spread on Tidewater as a hidden fee', () => {
    const tid = offerMath(invoiceValue, offers[1]);
    expect(tid.hiddenFees).toHaveLength(1);
    expect(tid.hiddenFees[0].label).toContain('FX conversion spread');
    expect(Math.round(tid.hiddenFees[0].amount)).toBe(16065);
    expect(tid.hiddenFees[0].amount).toBeGreaterThan(0);
  });
});

describe('duplicate registry fixtures', () => {
  const c = SCENARIO_SPECS.C;
  const registry = seedDatabase('C').registry;

  it('blocks an exact duplicate of the financed invoice', () => {
    const result = checkDuplicate(
      {
        supplierId: c.smeId,
        buyerId: c.buyerId,
        invoiceNo: c.invoiceNo,
        invoiceDate: c.invoiceDate,
        amount: c.invoiceAmount,
        currency: 'USD',
        irn: c.irn,
      },
      registry,
      'lender_tidewater',
    );
    expect(result.code).toBe('FINANCED_BY_OTHER');
    expect(result.message).toContain('already been financed');
  });

  it('flags Scenario C attempt 2 at about 0.877 similarity', () => {
    const attemptDate = new Date(Date.now() - 48 * 86_400_000).toISOString().slice(0, 10);
    const result = checkDuplicate(
      {
        supplierId: c.smeId,
        buyerId: c.buyerId,
        invoiceNo: 'CKS/2627/0188-A',
        invoiceDate: attemptDate,
        amount: 18_900,
        currency: 'USD',
        irn: c.irn,
      },
      registry,
      'lender_tidewater',
    );
    expect(result.code).toBe('POSSIBLE_DUPLICATE');
    expect(result.similarity).toBeGreaterThan(0.86);
    expect(result.similarity).toBeLessThan(0.89);
    expect(result.similarity).toBeCloseTo(0.877, 2);
    expect(result.breakdown?.irn).toBeCloseTo(0.1, 6);
  });

  it('keeps Scenario C attempt 2 internally consistent while still flagging the duplicate', () => {
    const db = seedDatabase('C');
    const trade = db.trades.find((t) => t.id === 'TRD-C-002')!;
    const docs = db.docs.filter((d) => d.tradeId === trade.id);
    expect(trade.value).toBe(18_900 * 85);
    expect(compareDocs(docs).pass).toBe(true);

    const ctx = {
      trade,
      docs,
      scenario: 'C' as const,
      buyerConfirmed: false,
      shipmentStage: 0,
      registryEntries: db.registry,
      priorResults: {},
    };
    expect(evaluateCheck(8, ctx).result).toBe('pass');
    expect(evaluateCheck(12, ctx).result).toBe('warn');
    expect(evaluateCheck(13, ctx).line).toContain('COIMBATORE KNIT STUDIO LLP');
    const invoiceEvidence = evaluateCheck(5, ctx).evidence as {
      payload?: { irn?: string };
    };
    expect(invoiceEvidence.payload?.irn).toBe(SCENARIO_SPECS.C.irn);
  });

  it('verifies the seeded chain and detects a tampered entry', () => {
    const seeded = seedDatabase('B').registry;
    const good = verifyChain(seeded);
    expect(good.intact).toBe(true);
    expect(good.entriesVerified).toBe(seeded.length);
    expect(good.entriesVerified).toBe(14);

    const tampered = seeded.map((entry) => ({ ...entry }));
    tampered[tampered.length - 1].prevHash = 'f'.repeat(64);
    const bad = verifyChain(tampered);
    expect(bad.intact).toBe(false);
    expect(bad.brokenAt).toBe(tampered.length);
  });
});

describe('Trade Passport fixture', () => {
  it('signs claims and detects a single altered claim', () => {
    const passport = buildPassport({
      orgId: 'org_kaveri',
      legalName: 'Kaveri Textiles Pvt Ltd',
      history: [
        { value: 1_020_000, deliveredOnTime: true, repaidOnTime: true },
        { value: 860_000, deliveredOnTime: true, repaidOnTime: true },
        { value: 1_240_000, deliveredOnTime: true, repaidOnTime: false },
      ],
      entityChecks: { mca: 'pass', udyam: 'pass', iec: 'pass', gst: 'pass' },
      recipient: 'Meridian Bank',
      purpose: 'Credit assessment',
      now: new Date('2026-11-03T09:00:00.000Z'),
    });
    expect(passport.proof.type).toBe('Ed25519');
    expect(passport.claims.tier).toBe(2);
    expect(verifyPassportOnServer(passport)).toBe(true);

    const tampered = JSON.parse(JSON.stringify(passport)) as typeof passport;
    tampered.claims.completedTrades += 1;
    expect(verifyPassportOnServer(tampered)).toBe(false);
  });
});

describe('fixed FX', () => {
  it('values Scenario B at USD 25,500 before amendment and USD 22,312.50 after', () => {
    const b = SCENARIO_SPECS.B;
    expect(b.invoiceAmount * 85).toBe(2_550_000);
    expect(b.packingQty * b.unitPrice * 85).toBe(2_231_250);
  });
});
