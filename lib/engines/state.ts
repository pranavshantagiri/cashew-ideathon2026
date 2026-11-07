import type { CheckResult, ConsentArtefact, Trade, TradeStatus } from '@/lib/types';

const ALLOWED: Record<TradeStatus, TradeStatus[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['VERIFYING', 'WITHDRAWN'],
  VERIFYING: ['VERIFIED', 'NEEDS_INFO', 'REJECTED_VERIFICATION'],
  NEEDS_INFO: ['VERIFYING', 'WITHDRAWN'],
  VERIFIED: ['OFFERS_OPEN', 'REJECTED_VERIFICATION', 'WITHDRAWN'],
  OFFERS_OPEN: ['OFFER_ACCEPTED', 'WITHDRAWN', 'NEEDS_INFO'],
  OFFER_ACCEPTED: ['CONTRACT_SIGNED', 'WITHDRAWN'],
  CONTRACT_SIGNED: ['FINANCED'],
  FINANCED: ['SHIPMENT_IN_TRANSIT', 'DISPUTED', 'DEFAULTED'],
  SHIPMENT_IN_TRANSIT: ['DELIVERED', 'DISPUTED'],
  DELIVERED: ['BUYER_ACCEPTED', 'DISPUTED'],
  BUYER_ACCEPTED: ['REPAID', 'DISPUTED'],
  REPAID: ['CLOSED'],
  CLOSED: [],
  REJECTED_VERIFICATION: ['WITHDRAWN'],
  WITHDRAWN: [],
  DISPUTED: ['CLOSED'],
  DEFAULTED: ['CLOSED'],
};

export function allowedTransitions(from: TradeStatus): TradeStatus[] {
  return ALLOWED[from] ?? [];
}

export function canTransition(from: TradeStatus, to: TradeStatus): boolean {
  return allowedTransitions(from).includes(to);
}

export function transition(trade: Trade, to: TradeStatus, actor: string): Trade {
  if (!canTransition(trade.status, to)) {
    throw new Error(`Illegal transition ${trade.status} → ${to} (actor: ${actor}).`);
  }
  return { ...trade, status: to };
}

export const MINIMUM_CHECKS_FOR_OFFERS = [1, 2, 5, 8, 12, 14];

export function canOpenToLenders(results: Record<number, CheckResult>, flagged: number[] = []): {
  ok: boolean;
  blocking: { id: number; result: CheckResult }[];
} {
  const blocking: { id: number; result: CheckResult }[] = [];
  for (const id of MINIMUM_CHECKS_FOR_OFFERS) {
    const r = results[id];
    if (r === 'pass') continue;
    if (flagged.includes(id)) continue;
    blocking.push({ id, result: r ?? 'pending' });
  }
  return { ok: blocking.length === 0, blocking };
}

const MODIFIABLE: TradeStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'VERIFYING',
  'NEEDS_INFO',
  'VERIFIED',
  'OFFERS_OPEN',
  'OFFER_ACCEPTED',
  'CONTRACT_SIGNED',
];

export function canModifyTrade(trade: Trade): boolean {
  return MODIFIABLE.includes(trade.status);
}

export function canLenderView(
  consents: ConsentArtefact[],
  tradeId: string,
  lenderId: string,
  now = new Date(),
): boolean {
  return consents.some(
    (c) =>
      c.tradeId === tradeId &&
      c.recipientOrgId === lenderId &&
      !c.revokedAt &&
      new Date(c.expiresAt).getTime() > now.getTime(),
  );
}

export function isActiveConsent(consent: ConsentArtefact, now = new Date()): boolean {
  return !consent.revokedAt && new Date(consent.expiresAt).getTime() > now.getTime();
}
