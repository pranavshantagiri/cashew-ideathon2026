import type { DocType, Fee, LenderProduct, Offer, Trade } from '@/lib/types';

export interface OfferMath {
  invoiceValue: number;
  advance: number;
  interest: number;
  fees: number;
  totalCost: number;
  effectiveAPR: number;
  netCash: number;
  feeLines: { label: string; amount: number; statedIn: 'headline' | 'conditions' }[];
  hiddenFees: { label: string; amount: number }[];
  tenureDays: number;
}

export function feeAmount(fee: Fee, advance: number, invoiceValue: number): number {
  if (fee.kind === 'flat') return fee.value;
  if (fee.kind === 'pctInvoice') return (invoiceValue * fee.value) / 100;
  return (advance * fee.value) / 100;
}

/** Effective-cost arithmetic from Section 11.5. All internal values unrounded. */
export function offerMath(invoiceValue: number, offer: Offer): OfferMath {
  const advance = invoiceValue * (offer.advancePct / 100);
  const interest = (advance * offer.ratePct * offer.tenureDays) / 365 / 100;
  const feeLines = (offer.fees || []).map((f) => ({
    label: f.label,
    amount: feeAmount(f, advance, invoiceValue),
    statedIn: f.statedIn,
  }));
  const fees = feeLines.reduce((s, f) => s + f.amount, 0);
  const totalCost = interest + fees;
  const effectiveAPR = advance > 0 ? (totalCost / advance) * (365 / offer.tenureDays) * 100 : 0;
  return {
    invoiceValue,
    advance,
    interest,
    fees,
    totalCost,
    effectiveAPR,
    netCash: advance - fees,
    feeLines,
    hiddenFees: feeLines
      .filter((f) => f.statedIn === 'conditions')
      .map(({ label, amount }) => ({ label, amount })),
    tenureDays: offer.tenureDays,
  };
}

/** Pull a percentage for a named charge out of free-text conditions, for the "hidden fee" chip. */
export function parseConditionsForFees(conditions: string): { label: string; pct: number }[] {
  const out: { label: string; pct: number }[] = [];
  const re = /([A-Za-z][A-Za-z0-9 /-]{2,40}?)\s+(?:of|at)\s+([0-9]+(?:\.[0-9]+)?)\s*%/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(conditions))) {
    out.push({ label: m[1].trim(), pct: Number(m[2]) });
  }
  return out;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export function checkEligibility(
  product: LenderProduct,
  trade: Trade,
  docsPresent: DocType[],
  strength: number,
): EligibilityResult {
  const reasons: string[] = [];
  const ticket = trade.value;
  if (!product.active) reasons.push('Product is inactive.');
  if (ticket < product.minTicket) reasons.push(`Ticket below minimum (₹${product.minTicket.toLocaleString('en-IN')}).`);
  if (ticket > product.maxTicket) reasons.push(`Ticket above maximum (₹${product.maxTicket.toLocaleString('en-IN')}).`);
  if (!product.corridors.includes(trade.corridor)) reasons.push(`Corridor ${trade.corridor} not supported.`);
  if (!product.sectors.includes('textiles')) reasons.push('Sector not supported.');
  if (trade.paymentTermsDays > product.maxTenureDays) reasons.push('Tenure exceeds the product maximum.');
  const missing = product.requiredDocs.filter((d) => !docsPresent.includes(d as DocType));
  if (missing.length) reasons.push(`Missing documents: ${missing.join(', ')}.`);
  if (strength < product.minStrength) reasons.push(`Evidence strength ${strength} is below the minimum ${product.minStrength}.`);
  return { eligible: reasons.length === 0, reasons };
}

export type SortMode = 'cost' | 'fastest' | 'cash';

export function rankOffers(offers: Offer[], invoiceValue: number, mode: SortMode = 'cost'): Offer[] {
  const withMath = offers.map((o) => ({ o, m: offerMath(invoiceValue, o) }));
  withMath.sort((a, b) => {
    if (mode === 'fastest') return a.o.disbursalHours - b.o.disbursalHours;
    if (mode === 'cash') return b.m.netCash - a.m.netCash;
    return a.m.effectiveAPR - b.m.effectiveAPR;
  });
  return withMath.map((x) => x.o);
}

/** Build a fully-populated offer from a lender product's defaults. */
export function buildOfferFromProduct(
  product: LenderProduct,
  trade: Trade,
  lenderId: string,
  now = new Date(),
  idSuffix = '',
): Offer {
  const validity = product.validityDays ?? 7;
  return {
    id: `off_${lenderId}_${trade.id}${idSuffix}`,
    tradeId: trade.id,
    lenderId,
    advancePct: product.advancePct ?? 85,
    ratePct: product.ratePct ?? 11.5,
    tenureDays: Math.min(trade.paymentTermsDays, product.maxTenureDays),
    fees: (product.fees ?? []).map((f) => ({ ...f })),
    recourse: product.recourse ?? true,
    collateral: product.collateral ?? 'None',
    conditions: product.conditions ?? '',
    validUntil: new Date(now.getTime() + validity * 86_400_000).toISOString(),
    status: 'open',
    disbursalHours: product.disbursalHours ?? 48,
    submittedAt: now.toISOString(),
    productType: product.type,
  };
}
