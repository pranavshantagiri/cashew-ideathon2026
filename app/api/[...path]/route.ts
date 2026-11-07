import { NextRequest, NextResponse } from 'next/server';
import {
  acceptOffer,
  addDocument,
  addOpsCase,
  advanceTime,
  audit,
  commitToRegistry,
  confirmBuyer,
  createLenderOffer,
  createTrade,
  getDocs,
  getProductForLender,
  getState,
  getTrade,
  grantConsent,
  materialize,
  moveShipment,
  notify,
  offersFor,
  opsDecision,
  orgName,
  passportFor,
  pendingOffersFor,
  refreshRisk,
  registryCheck,
  requestOffers,
  reset,
  respondNow,
  resultsFor,
  revokeConsent,
  riskFor,
  setAnchor,
  setProduct,
  setScenario,
  setSpeed,
  signOffer,
  startVerification,
} from '@/lib/store';
import { offerMath } from '@/lib/engines/matching';
import { buildEvidenceBundle, CHECK_META, invoiceFields } from '@/lib/engines/verification';
import { compareDocs } from '@/lib/engines/crossdoc';
import { verifyChain } from '@/lib/engines/registry';
import { canLenderView, isActiveConsent } from '@/lib/engines/state';
import type { CheckResult, DocType, Offer, Role, Trade } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  role: Role;
  orgId: string;
  scenario: 'A' | 'B' | 'C';
}

function roleOf(req: NextRequest): Role {
  const r = req.cookies.get('cashew_role')?.value as Role | undefined;
  return r === 'lender' || r === 'ops' || r === 'exporter' ? r : 'exporter';
}

function ctxOf(req: NextRequest): Ctx {
  const role = roleOf(req);
  const state = getState();
  let orgId = req.cookies.get('cashew_org')?.value ?? '';
  if (role === 'exporter') {
    // Scenario C is told from the perspective of the second exporter.
    orgId = state.scenario === 'C' ? 'org_cks' : 'org_kaveri';
  } else if (role === 'lender') {
    if (!orgId.startsWith('lender_')) orgId = 'lender_banyan';
  } else {
    orgId = 'org_ops';
  }
  return { role, orgId, scenario: state.scenario };
}

function err(code: string, message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

function latestChecks(tradeId: string) {
  const { checks } = resultsFor(tradeId);
  const map = new Map<number, (typeof checks)[number]>();
  for (const c of checks) map.set(c.checkId, c);
  return map;
}

function evidencePayload(trade: Trade) {
  const state = getState();
  materialize();
  const map = latestChecks(trade.id);
  const checks = [...map.values()].sort((a, b) => a.checkId - b.checkId);
  const run = state.runs[trade.id];
  const profile = riskFor(trade.id);
  const docs = getDocs(trade.id);
  const results = Object.fromEntries(checks.map((c) => [c.checkId, c.result])) as Record<number, CheckResult>;
  const bundle = buildEvidenceBundle(
    trade,
    checks.map((c) => ({ checkId: c.checkId, result: c.result, evidence: c.evidence, runAt: c.runAt })),
    docs,
  );
  const inv = invoiceFields(docs);
  const registryEntry =
    state.registry.find(
      (e) =>
        e.meta?.supplierId === trade.smeId &&
        e.meta?.buyerId === trade.buyerId &&
        e.meta?.invoiceNo === inv.invoiceNo &&
        e.status === 'FINANCED',
    ) ?? null;
  return {
    trade,
    docs,
    checks,
    run: run
      ? {
          startedAt: run.startedAt,
          pendingCheckIds: run.schedule.filter((s) => !map.has(s.checkId)).map((s) => s.checkId),
          total: run.checkIds.length,
        }
      : null,
    results,
    risk: profile,
    bundle,
    crossdoc: compareDocs(docs),
    flagged: trade.flaggedUnknownOrFailed,
    checkMeta: CHECK_META,
    consents: state.consents.filter((c) => c.tradeId === trade.id),
    registryEntry,
    shipmentStage: state.shipment[trade.id] ?? 0,
    buyerConfirmed: Boolean(state.buyerConfirmed[trade.id]),
  };
}

function canSeeTrade(ctx: Ctx, trade: Trade): boolean {
  if (ctx.role === 'ops') return true;
  if (ctx.role === 'exporter') return trade.smeId === ctx.orgId;
  return canLenderView(getState().consents, trade.id, ctx.orgId);
}

function lenderOfferStatus(tradeId: string, lenderId: string) {
  const offers = getState().offers.filter((o) => o.tradeId === tradeId && o.lenderId === lenderId);
  if (!offers.length) {
    return pendingOffersFor(tradeId).includes(lenderId) ? 'Awaiting' : 'Not responded';
  }
  const accepted = getState().offers.find((o) => o.tradeId === tradeId && o.status === 'accepted');
  if (accepted?.lenderId === lenderId) return 'Accepted';
  if (offers.some((o) => o.status === 'accepted')) return 'Declined';
  return 'Offer sent';
}

function inboxFor(ctx: Ctx) {
  const state = getState();
  materialize();
  const rows = state.trades
    .filter((t) => canLenderView(state.consents, t.id, ctx.orgId))
    .map((t) => {
      const profile = riskFor(t.id);
      return {
        trade: t,
        exporter: orgName(t.smeId),
        buyer: state.buyers.find((b) => b.id === t.buyerId)?.name ?? t.buyerId,
        strength: profile.strength,
        band: profile.band,
        offerStatus: lenderOfferStatus(t.id, ctx.orgId),
        requestedAt:
          state.consents.find((c) => c.tradeId === t.id && c.recipientOrgId === ctx.orgId)?.expiresAt ?? null,
      };
    });
  return rows;
}

function maskLender(state: ReturnType<typeof getState>, lenderId: string): string {
  const lenderIds = [...new Set(state.registry.map((e) => e.lenderId))];
  const idx = lenderIds.indexOf(lenderId);
  return idx >= 0 ? `Lender #${idx + 1}` : 'Lender';
}

async function body(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function tradeList(ctx: Ctx) {
  const state = getState();
  materialize();
  let trades = state.trades;
  if (ctx.role === 'exporter') trades = trades.filter((t) => t.smeId === ctx.orgId);
  if (ctx.role === 'lender') trades = trades.filter((t) => canLenderView(state.consents, t.id, ctx.orgId));
  return trades.map((t) => ({
    ...t,
    buyerName: state.buyers.find((b) => b.id === t.buyerId)?.name ?? t.buyerId,
    exporterName: orgName(t.smeId),
    strength: riskFor(t.id).strength,
    band: riskFor(t.id).band,
    offerCount: state.offers.filter((o) => o.tradeId === t.id).length,
    lastUpdated: t.createdAt,
  }));
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const p = params.path.join('/');
  const ctx = ctxOf(req);
  const state = getState();

  if (p === 'orgs/me') {
    const org = state.orgs.find((o) => o.id === ctx.orgId);
    return NextResponse.json({
      role: ctx.role,
      org: org ?? null,
      orgId: ctx.orgId,
      scenario: state.scenario,
      speed: state.speed,
      lenders: state.orgs.filter((o) => o.type === 'lender'),
      orgs: state.orgs,
    });
  }

  if (p === 'trades') return NextResponse.json({ trades: tradeList(ctx) });

  if (/^trades\/[^/]+$/.test(p)) {
    const trade = getTrade(p.split('/')[1]);
    if (!trade) return err('NOT_FOUND', 'Trade not found.', 404);
    if (!canSeeTrade(ctx, trade)) return err('CONSENT_REQUIRED', 'You do not have access to this trade.', 403);
    const profile = refreshRisk(trade.id);
    return NextResponse.json({
      trade,
      buyer: state.buyers.find((b) => b.id === trade.buyerId),
      exporter: state.orgs.find((o) => o.id === trade.smeId),
      risk: profile,
      offerStatus: ctx.role === 'lender' ? lenderOfferStatus(trade.id, ctx.orgId) : undefined,
    });
  }

  if (/^trades\/[^/]+\/evidence$/.test(p)) {
    const trade = getTrade(p.split('/')[1]);
    if (!trade) return err('NOT_FOUND', 'Trade not found.', 404);
    if (!canSeeTrade(ctx, trade)) return err('CONSENT_REQUIRED', 'You do not have access to this trade.', 403);
    return NextResponse.json(evidencePayload(trade));
  }

  if (/^trades\/[^/]+\/risk-profile$/.test(p)) {
    const tradeId = p.split('/')[1];
    const trade = getTrade(tradeId);
    if (!trade) return err('NOT_FOUND', 'Trade not found.', 404);
    if (!canSeeTrade(ctx, trade)) return err('CONSENT_REQUIRED', 'You do not have access to this trade.', 403);
    const w = req.nextUrl.searchParams.get('w');
    const weights = w ? (w.split(',').map(Number) as [number, number, number, number]) : undefined;
    return NextResponse.json({ risk: riskFor(tradeId, weights), trade });
  }

  if (/^trades\/[^/]+\/offers$/.test(p)) {
    const tradeId = p.split('/')[1];
    const trade = getTrade(tradeId);
    if (!trade) return err('NOT_FOUND', 'Trade not found.', 404);
    if (!canSeeTrade(ctx, trade)) return err('CONSENT_REQUIRED', 'You do not have access to this trade.', 403);
    const viewerLenderId = ctx.role === 'lender' ? ctx.orgId : undefined;
    const offers = offersFor(tradeId, { viewerLenderId });
    const pending = pendingOffersFor(tradeId).filter((lenderId) => !viewerLenderId || lenderId === viewerLenderId);
    const request = state.offerRequests[tradeId];
    return NextResponse.json({
      offers: offers.map((o) => ({
        ...o,
        math: offerMath(trade.value, o),
        lenderName: orgName(o.lenderId),
      })),
      pending,
      request: request ?? null,
      trade,
    });
  }

  if (p === 'products') {
    return NextResponse.json({ products: state.products });
  }

  if (p === 'registry/entries') {
    const entries = [...state.registry].sort((a, b) => b.position - a.position).map((e) => ({
      position: e.position,
      fingerprint: e.fingerprint,
      status: e.status,
      lender: maskLender(state, e.lenderId),
      timestamp: e.timestamp,
      entryHash: e.entryHash,
      previousHash: e.prevHash,
    }));
    const verification = verifyChain(state.registry);
    return NextResponse.json({
      entries,
      stats: {
        count: state.registry.length,
        chainLength: state.registry.length,
        head: verification.head,
        lastAnchored: state.anchor?.at ?? null,
        anchorHead: state.anchor?.head ?? null,
        intact: verification.intact,
      },
    });
  }

  if (/^passport\/[^/]+$/.test(p)) {
    const orgId = p.split('/')[1];
    if (ctx.role === 'exporter' && orgId !== ctx.orgId) return err('FORBIDDEN', 'Not your passport.', 403);
    try {
      const passport = passportFor(orgId);
      return NextResponse.json({ passport, history: state.history.filter((h) => h.smeId === orgId) });
    } catch {
      return err('NOT_FOUND', 'Org not found.', 404);
    }
  }

  if (p === 'audit') {
    const tradeId = req.nextUrl.searchParams.get('tradeId');
    const events = state.audit
      .filter((e) => (tradeId ? e.tradeId === tradeId : true))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return NextResponse.json({ events, count: events.length });
  }

  if (p === 'ops/queue') {
    return NextResponse.json({
      queue: state.ops,
      audit: state.audit.slice().reverse(),
      health: [
        { name: 'GST', status: 'Simulated, healthy', fallback: true },
        { name: 'MCA', status: 'Simulated, healthy', fallback: true },
        { name: 'IEC', status: 'Simulated, healthy', fallback: true },
        { name: 'Sanctions screening', status: 'Simulated, healthy', fallback: true },
        { name: 'Carrier tracking', status: 'Simulated, healthy', fallback: true },
        { name: 'Buyer registry', status: 'Simulated, healthy', fallback: true },
        { name: 'e-Sign', status: 'Simulated, healthy', fallback: true },
      ],
    });
  }

  if (p === 'notifications') {
    return NextResponse.json({ notifications: state.notifications });
  }

  if (p === 'demo/state') {
    return NextResponse.json({
      scenario: state.scenario,
      speed: state.speed,
      trades: state.trades.map((t) => ({ id: t.id, status: t.status, scenario: t.scenario, smeId: t.smeId })),
      pendingOffers: state.pendingOffers.length,
      anchor: state.anchor ?? null,
      registryCount: state.registry.length,
    });
  }

  if (p === 'lender/inbox') {
    if (ctx.role !== 'lender' && ctx.role !== 'ops') return err('FORBIDDEN', 'Lender access only.', 403);
    return NextResponse.json({ inbox: inboxFor(ctx) });
  }

  if (p === 'lender/products') {
    const product = getProductForLender(ctx.orgId);
    return NextResponse.json({ products: state.products.filter((x) => x.lenderId === ctx.orgId || ctx.role === 'ops'), product });
  }

  if (p === 'demo/scenario-trades') {
    return NextResponse.json({ trades: state.trades });
  }

  return err('NOT_FOUND', `No route for GET /api/${p}.`, 404);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const p = params.path.join('/');
  const ctx = ctxOf(req);
  const state = getState();
  const b = await body(req);

  if (p === 'session') {
    const role = String(b.role ?? 'exporter') as Role;
    const orgId =
      String(b.orgId ?? '') ||
      (role === 'lender' ? 'lender_banyan' : role === 'ops' ? 'org_ops' : state.scenario === 'C' ? 'org_cks' : 'org_kaveri');
    const res = NextResponse.json({ ok: true, role, orgId, scenario: state.scenario });
    res.cookies.set('cashew_role', role, { path: '/', sameSite: 'lax' });
    res.cookies.set('cashew_org', orgId, { path: '/', sameSite: 'lax' });
    return res;
  }

  if (p === 'trades') {
    if (ctx.role !== 'exporter') return err('FORBIDDEN', 'Only an exporter can create a trade.', 403);
    const trade = createTrade(
      {
        scenario: (b.scenario as 'A' | 'B' | 'C') ?? ctx.scenario,
        buyerId: b.buyerId as string | undefined,
        goods: b.goods as string | undefined,
        hsCode: b.hsCode as string | undefined,
        valueUsd: b.valueUsd as number | undefined,
        incoterm: b.incoterm as string | undefined,
        paymentTermsDays: b.paymentTermsDays as number | undefined,
      },
      ctx.orgId,
    );
    return NextResponse.json({ trade });
  }

  if (/^trades\/[^/]+\/documents$/.test(p)) {
    const tradeId = p.split('/')[1];
    const trade = getTrade(tradeId);
    if (!trade) return err('NOT_FOUND', 'Trade not found.', 404);
    if (ctx.role !== 'exporter' || trade.smeId !== ctx.orgId) return err('FORBIDDEN', 'Not your trade.', 403);
    const type = b.docType as DocType;
    if (!type) return err('INVALID', 'docType is required.');
    const doc = addDocument(tradeId, type, {
      amended: Boolean(b.amended),
      filename: b.filename as string | undefined,
    });
    return NextResponse.json({ doc, trade: getTrade(tradeId) });
  }

  if (/^trades\/[^/]+\/verify$/.test(p)) {
    const tradeId = p.split('/')[1];
    const trade = getTrade(tradeId);
    if (!trade) return err('NOT_FOUND', 'Trade not found.', 404);
    if (ctx.role !== 'exporter' || trade.smeId !== ctx.orgId) return err('FORBIDDEN', 'Not your trade.', 403);
    const checkId = typeof b.checkId === 'number' ? b.checkId : undefined;
    const run = startVerification(tradeId, checkId ? [checkId] : undefined, ctx.orgId);
    return NextResponse.json({ run, trade: getTrade(tradeId) });
  }

  if (/^trades\/[^/]+\/flag$/.test(p)) {
    const tradeId = p.split('/')[1];
    const trade = getTrade(tradeId);
    if (!trade) return err('NOT_FOUND', 'Trade not found.', 404);
    if (ctx.role !== 'exporter' || trade.smeId !== ctx.orgId) return err('FORBIDDEN', 'Not your trade.', 403);
    const ids = (b.checkIds as number[]) ?? [8];
    trade.flaggedUnknownOrFailed = [...new Set([...trade.flaggedUnknownOrFailed, ...ids])];
    audit(ctx.orgId, 'checks.flagged', `trade:${tradeId}`, { checks: ids }, tradeId);
    if (trade.status === 'NEEDS_INFO') trade.status = 'VERIFIED';
    return NextResponse.json({ trade });
  }

  if (/^trades\/[^/]+\/offer-requests$/.test(p)) {
    const tradeId = p.split('/')[1];
    const trade = getTrade(tradeId);
    if (!trade) return err('NOT_FOUND', 'Trade not found.', 404);
    if (ctx.role !== 'exporter' || trade.smeId !== ctx.orgId) return err('FORBIDDEN', 'Not your trade.', 403);
    try {
      const result = requestOffers(tradeId, ctx.orgId);
      return NextResponse.json({ ...result, trade: getTrade(tradeId) });
    } catch (e) {
      const error = e as Error & { code?: string; checks?: unknown };
      if (error.code === 'CHECKS_BLOCKING') return err('CHECKS_BLOCKING', error.message, 409, { checks: error.checks });
      return err('FAILED', error.message, 500);
    }
  }

  if (p === 'consents') {
    if (ctx.role !== 'exporter') return err('FORBIDDEN', 'Only the exporter can grant consent.', 403);
    const tradeId = String(b.tradeId ?? '');
    const trade = getTrade(tradeId);
    if (!trade || trade.smeId !== ctx.orgId) return err('FORBIDDEN', 'Not your trade.', 403);
    const recipientOrgId = String(b.recipientOrgId ?? '');
    if (!state.orgs.some((o) => o.id === recipientOrgId && o.type === 'lender')) {
      return err('INVALID', 'The recipient must be a lender.', 400);
    }
    const days = Math.max(1, Math.min(90, Number(b.days ?? 30)));
    const consent = grantConsent({
      orgId: ctx.orgId,
      tradeId,
      recipientOrgId,
      purpose: String(b.purpose ?? 'Credit assessment'),
      days,
    });
    return NextResponse.json({ consent });
  }

  if (p.startsWith('consents/') && p.endsWith('/revoke')) {
    revokeConsent(p.split('/')[1]);
    return NextResponse.json({ ok: true });
  }

  if (p === 'offers') {
    if (ctx.role !== 'lender') return err('FORBIDDEN', 'Only a lender can submit an offer.', 403);
    try {
      const offer = createLenderOffer(String(b.tradeId), ctx.orgId, b as Partial<Offer>, ctx.orgId);
      return NextResponse.json({ offer });
    } catch (e) {
      const error = e as Error & { code?: string };
      return err(error.code ?? 'FAILED', error.message, error.code === 'CONSENT_REQUIRED' ? 403 : 400);
    }
  }

  if (/^offers\/[^/]+\/accept$/.test(p)) {
    const offerId = p.split('/')[1];
    if (ctx.role !== 'exporter') return err('FORBIDDEN', 'Only the exporter can accept.', 403);
    const existing = getState().offers.find((o) => o.id === offerId);
    if (!existing) return err('NOT_FOUND', 'Offer not found.', 404);
    const owner = getTrade(existing.tradeId);
    if (!owner || owner.smeId !== ctx.orgId) return err('FORBIDDEN', 'Not your trade.', 403);
    const offer = acceptOffer(offerId, ctx.orgId);
    return NextResponse.json({ offer, trade: getTrade(offer.tradeId) });
  }

  if (/^offers\/[^/]+\/sign$/.test(p)) {
    const offerId = p.split('/')[1];
    if (ctx.role !== 'exporter') return err('FORBIDDEN', 'Only the exporter can sign.', 403);
    const existing = getState().offers.find((o) => o.id === offerId);
    if (!existing) return err('NOT_FOUND', 'Offer not found.', 404);
    const owner = getTrade(existing.tradeId);
    if (!owner || owner.smeId !== ctx.orgId) return err('FORBIDDEN', 'Not your trade.', 403);
    const offer = signOffer(offerId, ctx.orgId);
    return NextResponse.json({ offer, trade: getTrade(offer.tradeId), stagedDisbursalMs: 2000 / getState().speed });
  }

  if (p === 'registry/check') {
    const check = registryCheck(
      {
        supplierId: String(b.supplierId ?? ''),
        buyerId: String(b.buyerId ?? ''),
        invoiceNo: String(b.invoiceNo ?? ''),
        invoiceDate: String(b.invoiceDate ?? ''),
        amount: Number(b.amount ?? 0),
        currency: String(b.currency ?? 'USD'),
        irn: b.irn ? String(b.irn) : undefined,
      },
      ctx.orgId,
    );
    return NextResponse.json({ check });
  }

  if (p === 'registry/commit') {
    const trade = getTrade(String(b.tradeId ?? ''));
    if (!trade) return err('NOT_FOUND', 'Trade not found.', 404);
    if (ctx.role !== 'lender' && ctx.role !== 'ops') return err('FORBIDDEN', 'Lender or Ops only.', 403);
    const check = registryCheck(
      {
        supplierId: trade.smeId,
        buyerId: trade.buyerId,
        invoiceNo: invoiceFields(getDocs(trade.id)).invoiceNo,
        invoiceDate: invoiceFields(getDocs(trade.id)).invoiceDate,
        amount: invoiceFields(getDocs(trade.id)).amount,
        currency: invoiceFields(getDocs(trade.id)).currency,
        irn: invoiceFields(getDocs(trade.id)).irn,
      },
      ctx.orgId,
    );
    if (check.code === 'FINANCED_BY_OTHER' || check.code === 'POSSIBLE_DUPLICATE') {
      audit(ctx.orgId, 'duplicate.flagged', `trade:${trade.id}`, { code: check.code }, trade.id);
      return err('DUPLICATE', check.message, 409, { check });
    }
    const entry = commitToRegistry(trade, ctx.orgId);
    return NextResponse.json({ entry: { ...entry, lender: maskLender(getState(), entry.lenderId) } });
  }

  if (p === 'registry/verify-chain') {
    const verification = verifyChain(getState().registry);
    return NextResponse.json({ verification });
  }

  if (p === 'registry/anchor') {
    const verification = verifyChain(getState().registry);
    setAnchor(verification.head ?? '');
    return NextResponse.json({
      anchored: true,
      head: verification.head,
      simulated: true,
      message: `Chain head ${verification.head?.slice(0, 8)}…${verification.head?.slice(-4)} published to an external anchor (simulated).`,
    });
  }

  if (p === 'passport/share') {
    if (ctx.role !== 'exporter') return err('FORBIDDEN', 'Only the exporter can share a passport.', 403);
    const recipient = String(b.recipient ?? 'Meridian Bank').slice(0, 80);
    const purpose = String(b.purpose ?? 'Credit assessment').slice(0, 120);
    const passport = passportFor(ctx.orgId, recipient, purpose);
    const consent = grantConsent({
      orgId: ctx.orgId,
      tradeId: 'passport',
      recipientOrgId: recipient,
      purpose,
      days: 30,
    });
    return NextResponse.json({ passport, consent });
  }

  if (p === 'ops/queue') {
    if (ctx.role !== 'ops') return err('FORBIDDEN', 'Ops access only.', 403);
    const item = addOpsCase({
      tradeId: String(b.tradeId ?? ''),
      orgId: String(b.orgId ?? ''),
      reason: String(b.reason ?? 'Manual review'),
      detail: String(b.detail ?? ''),
    });
    return NextResponse.json({ case: item });
  }

  if (p.startsWith('ops/queue/') && p.endsWith('/decision')) {
    if (ctx.role !== 'ops') return err('FORBIDDEN', 'Ops access only.', 403);
    try {
      const item = opsDecision(p.split('/')[2], String(b.decision ?? ''), String(b.note ?? ''), 'Asha (Cashew Ops)');
      return NextResponse.json({ case: item });
    } catch (e) {
      return err('FAILED', (e as Error).message, 400);
    }
  }

  if (p === 'demo/scenario') {
    setScenario(b.id as 'A' | 'B' | 'C');
    return NextResponse.json({ ok: true, scenario: getState().scenario });
  }

  if (p === 'demo/speed') {
    const factor = b.factor === 'instant' ? 1000 : Number(b.factor ?? 1);
    setSpeed(factor);
    return NextResponse.json({ ok: true, speed: getState().speed });
  }

  if (p === 'demo/reset') {
    reset((b.scenario as 'A' | 'B' | 'C') ?? undefined);
    return NextResponse.json({ ok: true, scenario: getState().scenario });
  }

  if (p === 'demo/advance') {
    const what = String(b.what ?? '');
    const stateNow = getState();
    const activeTrade =
      (b.tradeId as string) ||
      [...stateNow.trades].reverse().find((t) => t.smeId === ctx.orgId)?.id ||
      [...stateNow.trades].reverse()[0]?.id;
    if (what === 'shipment' && activeTrade) {
      moveShipment(activeTrade);
      return NextResponse.json({ ok: true, trade: getTrade(activeTrade) });
    }
    if (what === 'buyer-confirm' && activeTrade) {
      confirmBuyer(activeTrade);
      return NextResponse.json({ ok: true, trade: getTrade(activeTrade) });
    }
    if (what === 'lenders-respond') {
      respondNow((b.tradeId as string) || undefined);
      return NextResponse.json({ ok: true });
    }
    if (what === 'time-30d' && activeTrade) {
      advanceTime(activeTrade, 'time-30d');
      return NextResponse.json({ ok: true });
    }
    if (what === 'repaid' && activeTrade) {
      advanceTime(activeTrade, 'repaid');
      return NextResponse.json({ ok: true, trade: getTrade(activeTrade) });
    }
    if (what === 'duplicate-1' || what === 'duplicate-2') {
      if (getState().scenario !== 'C') setScenario('C');
      const tradeId = what === 'duplicate-1' ? 'TRD-C-001' : 'TRD-C-002';
      const trade = getTrade(tradeId);
      if (trade) {
        notify('Duplicate attempt loaded', what === 'duplicate-1' ? 'Exact copy of a financed invoice.' : 'Altered copy with a reused e-invoice IRN.', 'warn');
        return NextResponse.json({ ok: true, trade, url: `/app/trades/${tradeId}?tab=verification` });
      }
      return err('NOT_FOUND', 'Duplicate scenario trade missing.', 404);
    }
    return err('INVALID', `Unknown demo action ${what}.`);
  }

  if (/^products\/[^/]+$/.test(p)) {
    if (ctx.role !== 'lender') return err('FORBIDDEN', 'Lenders can only edit their own product.', 403);
    const productId = p.split('/')[1];
    const existing = getState().products.find((x) => x.id === productId);
    if (!existing) return err('NOT_FOUND', 'Product not found.', 404);
    if (existing.lenderId !== ctx.orgId) return err('FORBIDDEN', 'Not your product.', 403);
    const num = (key: string, fallback: number) => {
      const value = Number(b[key]);
      return Number.isFinite(value) ? value : fallback;
    };
    const patch = {
      active: typeof b.active === 'boolean' ? b.active : existing.active,
      minTicket: num('minTicket', existing.minTicket),
      maxTicket: num('maxTicket', existing.maxTicket),
      maxTenureDays: num('maxTenureDays', existing.maxTenureDays),
      minStrength: Math.max(0, Math.min(100, num('minStrength', existing.minStrength))),
      advancePct: Math.max(1, Math.min(100, num('advancePct', existing.advancePct ?? 85))),
      ratePct: Math.max(0, num('ratePct', existing.ratePct ?? 11.5)),
      disbursalHours: Math.max(1, num('disbursalHours', existing.disbursalHours ?? 48)),
      validityDays: Math.max(1, Math.min(30, num('validityDays', existing.validityDays ?? 7))),
      corridors: Array.isArray(b.corridors) ? (b.corridors as string[]) : existing.corridors,
      sectors: Array.isArray(b.sectors) ? (b.sectors as string[]) : existing.sectors,
      requiredDocs: Array.isArray(b.requiredDocs) ? (b.requiredDocs as string[]) : existing.requiredDocs,
      conditions: String(b.conditions ?? existing.conditions ?? '').slice(0, 1000),
    };
    setProduct(productId, patch);
    return NextResponse.json({ product: getState().products.find((x) => x.id === productId) });
  }

  return err('NOT_FOUND', `No route for POST /api/${p}.`, 404);
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  const p = params.path.join('/');
  if (/^consents\/[^/]+$/.test(p)) {
    revokeConsent(p.split('/')[1]);
    return NextResponse.json({ ok: true });
  }
  return err('NOT_FOUND', `No route for DELETE /api/${p}.`, 404);
}
