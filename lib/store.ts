import fs from 'node:fs';
import path from 'node:path';
import type {
  AppNotification,
  AuditEvent,
  Buyer,
  CheckResult,
  ConsentArtefact,
  Doc,
  DocType,
  LenderProduct,
  Offer,
  OpsCase,
  Org,
  RegistryEntry,
  RiskProfile,
  Trade,
  TradeHistory,
  TradeStatus,
  VerificationCheck,
  VerificationRun,
} from '@/lib/types';
import { seedDatabase, makeDoc, makeTrade, FX, type SeedDatabase } from '@/lib/seed';
import { CHECK_META, evaluateCheck, evidenceHash } from '@/lib/engines/verification';
import { computeRisk } from '@/lib/engines/risk';
import { buildOfferFromProduct, checkEligibility, offerMath } from '@/lib/engines/matching';
import { buildEntry, checkDuplicate, fingerprint, irnFingerprint } from '@/lib/engines/registry';
import { invoiceFields } from '@/lib/engines/verification';
import { canLenderView, canOpenToLenders, canTransition, isActiveConsent } from '@/lib/engines/state';
import { buildPassport } from '@/lib/engines/passport';

const STATE_FILE = path.join(process.cwd(), '.demo-state.json');
const STATE_VERSION = 2;

interface PendingOffer {
  id: string;
  tradeId: string;
  lenderId: string;
  dueAt: number;
  offer: Offer;
}

interface OfferRequest {
  tradeId: string;
  requestedAt: string;
  eligible: string[];
  excluded: { lenderId: string; reasons: string[] }[];
}

interface StoreState {
  version: number;
  scenario: 'A' | 'B' | 'C';
  speed: number;
  orgs: Org[];
  buyers: Buyer[];
  trades: Trade[];
  docs: Doc[];
  products: LenderProduct[];
  registry: RegistryEntry[];
  consents: ConsentArtefact[];
  audit: AuditEvent[];
  ops: OpsCase[];
  notifications: AppNotification[];
  history: TradeHistory[];
  checks: VerificationCheck[];
  risk: RiskProfile[];
  offers: Offer[];
  pendingOffers: PendingOffer[];
  runs: Record<string, VerificationRun>;
  offerRequests: Record<string, OfferRequest>;
  shipment: Record<string, number>;
  buyerConfirmed: Record<string, boolean>;
  disbursals: Record<string, number>;
  rankingsLogged: Record<string, boolean>;
  anchor?: { head: string; at: string };
  seq: number;
}

let state: StoreState = boot();

function fresh(scenario: 'A' | 'B' | 'C' = 'B'): StoreState {
  const seed: SeedDatabase = seedDatabase(scenario);
  return {
    version: STATE_VERSION,
    scenario,
    speed: 1,
    ...seed,
    checks: [],
    risk: [],
    offers: [],
    pendingOffers: [],
    runs: {},
    offerRequests: {},
    shipment: {},
    buyerConfirmed: {},
    disbursals: {},
    rankingsLogged: {},
    seq: 0,
  };
}

function boot(): StoreState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as StoreState;
      if (raw.version === STATE_VERSION) {
        raw.anchor = raw.anchor;
        return raw;
      }
    }
  } catch {
    // corrupted mirror: fall through to a clean seed
  }
  const s = fresh('B');
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
  } catch {
    /* read-only filesystems are fine */
  }
  return s;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch {
      /* ignore */
    }
  }, 200);
}
function saveNow() {
  if (saveTimer) clearTimeout(saveTimer);
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    /* ignore */
  }
}

export function getState(): StoreState {
  materialize();
  return state;
}

export function id(prefix: string): string {
  state.seq += 1;
  return `${prefix}_${Date.now().toString(36)}${state.seq.toString(36)}`;
}

export function audit(
  actor: string,
  action: string,
  object: string,
  meta?: unknown,
  tradeId?: string,
): AuditEvent {
  const e: AuditEvent = {
    id: id('aud'),
    actor,
    action,
    object,
    timestamp: new Date().toISOString(),
    meta,
    tradeId,
  };
  state.audit.push(e);
  return e;
}

export function notify(title: string, body: string, kind: AppNotification['kind'] = 'info') {
  state.notifications.unshift({
    id: id('notif'),
    title,
    body,
    kind,
    createdAt: new Date().toISOString(),
  });
  state.notifications = state.notifications.slice(0, 30);
}

export function reset(scenario?: 'A' | 'B' | 'C') {
  const next = scenario ?? state.scenario;
  state = fresh(next);
  audit('demo', 'demo.reset', `scenario:${next}`);
  notify('Demo reset', `Scenario ${next} restored from seed.`, 'info');
  saveNow();
}

export function setScenario(scenario: 'A' | 'B' | 'C') {
  reset(scenario);
}

export function setSpeed(speed: number) {
  state.speed = Math.max(0.1, Math.min(1000, speed || 1));
  audit('demo', 'demo.speed', `speed:${state.speed}`);
  save();
}

function ms(base: number): number {
  return base / state.speed;
}

function latestLatest(): void {
  // placeholder for readability
}

export function resultsFor(tradeId: string): { results: Record<number, CheckResult>; checks: VerificationCheck[] } {
  const all = state.checks.filter((c) => c.tradeId === tradeId).sort((a, b) => a.sequence - b.sequence);
  const latest: Record<number, VerificationCheck> = {};
  for (const c of all) latest[c.checkId] = c;
  const results: Record<number, CheckResult> = {};
  Object.entries(latest).forEach(([k, v]) => {
    results[Number(k)] = v.result;
  });
  return { results, checks: all };
}

export function riskFor(tradeId: string, weights?: number[]): RiskProfile {
  const { results } = resultsFor(tradeId);
  const trade = state.trades.find((t) => t.id === tradeId);
  const out = computeRisk({ results, paymentTermsDays: trade?.paymentTermsDays ?? 90, weights: weights as never });
  return { tradeId, ...out } as RiskProfile;
}

export function refreshRisk(tradeId: string) {
  const profile = riskFor(tradeId);
  state.risk = state.risk.filter((r) => r.tradeId !== tradeId);
  state.risk.push(profile);
  return profile;
}

export interface CreateTradeInput {
  scenario?: 'A' | 'B' | 'C';
  buyerId?: string;
  goods?: string;
  hsCode?: string;
  valueUsd?: number;
  incoterm?: string;
  paymentTermsDays?: number;
}

export function createTrade(input: CreateTradeInput, actor = 'exporter'): Trade {
  const scenario = input.scenario ?? state.scenario;
  const base = makeTrade(scenario);
  const existing = new Set(state.trades.map((t) => t.id));
  let tradeId = base.id;
  let n = 1;
  while (existing.has(tradeId)) {
    n += 1;
    tradeId = `${base.id}-${n}`;
  }
  const trade: Trade = {
    ...base,
    id: tradeId,
    buyerId: input.buyerId ?? base.buyerId,
    goods: input.goods ?? base.goods,
    hsCode: input.hsCode ?? base.hsCode,
    incoterm: input.incoterm ?? base.incoterm,
    paymentTermsDays: input.paymentTermsDays ?? base.paymentTermsDays,
    value: input.valueUsd != null ? Math.round(input.valueUsd * FX) : base.value,
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
  };
  state.trades.push(trade);
  audit(actor, 'trade.created', `trade:${trade.id}`, { value: trade.value, scenario }, trade.id);
  save();
  return trade;
}

export function getTrade(tradeId: string): Trade | undefined {
  return state.trades.find((t) => t.id === tradeId);
}

export function getDocs(tradeId: string): Doc[] {
  return state.docs.filter((d) => d.tradeId === tradeId);
}

export function addDocument(
  tradeId: string,
  type: DocType,
  opts: { amended?: boolean; filename?: string } = {},
): Doc {
  const trade = getTrade(tradeId);
  if (!trade) throw new Error('Trade not found.');
  if (type === 'invoice' && opts.amended) {
    const maxV = Math.max(0, ...getDocs(tradeId).filter((d) => d.type === 'invoice').map((d) => d.version));
    const doc = makeDoc(tradeId, trade.scenario, 'invoice', maxV + 1);
    doc.filename = opts.filename ?? doc.filename;
    state.docs.push(doc);
    const inv = invoiceFields([doc]);
    trade.value = Math.round(inv.amount * FX);
    audit('exporter', 'document.uploaded', `doc:${doc.id}`, { type, version: doc.version }, tradeId);
    audit('exporter', 'document.extracted', `doc:${doc.id}`, { fields: 11, lowConfidence: 1 }, tradeId);
    save();
    // An amended invoice immediately re-runs the computed cross-document check.
    startVerification(tradeId, [8], 'exporter');
    return doc;
  }
  const maxV = Math.max(0, ...getDocs(tradeId).filter((d) => d.type === type).map((d) => d.version));
  const doc = makeDoc(tradeId, trade.scenario, type, maxV + 1);
  doc.filename = opts.filename ?? doc.filename;
  state.docs.push(doc);
  audit('exporter', 'document.uploaded', `doc:${doc.id}`, { type, size: 182_400 }, tradeId);
  audit('exporter', 'document.extracted', `doc:${doc.id}`, { fields: Object.keys(doc.extracted.fields).length }, tradeId);
  if (trade.status === 'DRAFT') trade.status = 'SUBMITTED';
  save();
  return doc;
}

export function startVerification(tradeId: string, checkIds?: number[], actor = 'exporter') {
  const trade = getTrade(tradeId);
  if (!trade) throw new Error('Trade not found.');
  const ids = checkIds?.length ? checkIds : CHECK_META.map((c) => c.id);
  const now = Date.now();
  let cursor = 0;
  const schedule = ids.map((checkId) => {
    const meta = CHECK_META.find((c) => c.id === checkId)!;
    cursor += ms(meta.durationMs);
    return { checkId, dueAt: now + cursor, durationMs: Math.round(ms(meta.durationMs)) };
  });
  state.runs[tradeId] = {
    tradeId,
    startedAt: new Date(now).toISOString(),
    speed: state.speed,
    checkIds: ids,
    schedule: schedule.map((s) => ({ ...s })),
  };
  if (trade.status === 'DRAFT' || trade.status === 'SUBMITTED' || trade.status === 'NEEDS_INFO') {
    trade.status = 'VERIFYING';
  }
  audit(actor, 'verification.started', `trade:${tradeId}`, { checks: ids }, tradeId);
  save();
  materialize();
  return state.runs[tradeId];
}

export function materialize() {
  const now = Date.now();
  let changed = false;

  for (const [tradeId, run] of Object.entries(state.runs)) {
    const trade = getTrade(tradeId);
    if (!trade) continue;
    const done = new Set(
      state.checks
        .filter((c) => c.tradeId === tradeId && new Date(c.runAt).getTime() >= new Date(run.startedAt).getTime())
        .map((c) => c.checkId),
    );
    let allDone = true;
    for (const item of run.schedule) {
      if (item.dueAt > now) {
        allDone = false;
        continue;
      }
      if (done.has(item.checkId)) continue;
      const prior = resultsFor(tradeId).results;
      const evaluation = evaluateCheck(item.checkId, {
        trade,
        docs: getDocs(tradeId),
        scenario: trade.scenario,
        buyerConfirmed: Boolean(state.buyerConfirmed[tradeId]),
        shipmentStage: state.shipment[tradeId] ?? 0,
        registryEntries: state.registry,
        priorResults: prior,
      });
      const evHash = evidenceHash(evaluation.evidence);
      const check: VerificationCheck = {
        id: id('chk'),
        tradeId,
        checkId: item.checkId,
        result: evaluation.result,
        line: evaluation.line,
        source: CHECK_META.find((c) => c.id === item.checkId)?.source ?? 'Unknown',
        evidence: evaluation.evidence,
        evidenceHash: evHash,
        runAt: new Date().toISOString(),
        durationMs: item.durationMs,
        sequence: state.checks.length + 1,
      };
      state.checks.push(check);
      changed = true;
      audit('system', 'verification.check.completed', `check:${item.checkId}`, { result: evaluation.result }, tradeId);
      if (item.checkId === 12 && evaluation.result === 'warn') {
        ensureDuplicateCase(trade, evaluation.line);
      }
    }
    if (allDone) {
      const { results } = resultsFor(tradeId);
      const failed = Object.values(results).some((r) => r === 'fail');
      const wasVerifying = trade.status === 'VERIFYING';
      if (wasVerifying) {
        trade.status = failed ? 'NEEDS_INFO' : 'VERIFIED';
        audit('system', 'verification.completed', `trade:${tradeId}`, { status: trade.status }, tradeId);
      }
      refreshRisk(tradeId);
      delete state.runs[tradeId];
      changed = true;
    }
  }

  // Offers become visible when their timer fires.
  const due = state.pendingOffers.filter((p) => p.dueAt <= now);
  if (due.length) {
    for (const p of due) {
      state.offers.push(p.offer);
      state.pendingOffers = state.pendingOffers.filter((x) => x.id !== p.id);
      audit('lender', 'offer.submitted', `offer:${p.offer.id}`, { lenderId: p.lenderId }, p.tradeId);
      notify('Offer received', `Offer received from ${orgName(p.lenderId)}.`, 'offer');
      changed = true;
    }
  }

  // Disbursal after signing.
  for (const [tradeId, dueAt] of Object.entries(state.disbursals)) {
    if (dueAt <= now) {
      const trade = getTrade(tradeId);
      if (trade && trade.status === 'CONTRACT_SIGNED') {
        const accepted = state.offers.find((o) => o.tradeId === tradeId && o.status === 'accepted');
        if (accepted) {
          trade.status = 'FINANCED';
          commitToRegistry(trade, accepted.lenderId);
          audit('system', 'financing.disbursed', `trade:${tradeId}`, { offerId: accepted.id }, tradeId);
          notify('Financing disbursed', `${orgName(trade.smeId)}: ${money(offerMath(trade.value, accepted).netCash)} disbursed against INV ${invoiceFields(getDocs(tradeId)).invoiceNo}.`, 'success');
        }
      }
      delete state.disbursals[tradeId];
      changed = true;
    }
  }

  if (changed) save();
}

function ensureDuplicateCase(trade: Trade, detail: string) {
  if (state.ops.some((c) => c.tradeId === trade.id && c.status === 'open')) return;
  state.ops.unshift({
    id: id('case'),
    tradeId: trade.id,
    orgId: trade.smeId,
    reason: 'Possible duplicate',
    detail,
    ageHours: 0,
    reviewer: 'Unassigned',
    status: 'open',
  });
  audit('system', 'duplicate.flagged', `trade:${trade.id}`, { detail }, trade.id);
}

export function orgName(orgId: string): string {
  return state.orgs.find((o) => o.id === orgId)?.legalName ?? orgId;
}

function money(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function grantConsent(input: {
  orgId: string;
  tradeId: string;
  recipientOrgId: string;
  purpose: string;
  days?: number;
}): ConsentArtefact {
  const existing = state.consents.find(
    (c) => c.tradeId === input.tradeId && c.recipientOrgId === input.recipientOrgId && isActiveConsent(c),
  );
  if (existing) return existing;
  const consent: ConsentArtefact = {
    id: id('consent'),
    orgId: input.orgId,
    scope: `trade:${input.tradeId}`,
    recipientOrgId: input.recipientOrgId,
    purpose: input.purpose,
    expiresAt: new Date(Date.now() + (input.days ?? 30) * 86_400_000).toISOString(),
    tradeId: input.tradeId,
  };
  state.consents.push(consent);
  audit('exporter', 'consent.granted', `consent:${consent.id}`, { recipient: input.recipientOrgId, purpose: input.purpose }, input.tradeId);
  save();
  return consent;
}

export function revokeConsent(consentId: string) {
  const c = state.consents.find((x) => x.id === consentId);
  if (c) {
    c.revokedAt = new Date().toISOString();
    audit('exporter', 'consent.revoked', `consent:${c.id}`, undefined, c.tradeId);
    save();
  }
}

export function requestOffers(tradeId: string, actor = 'exporter') {
  const trade = getTrade(tradeId);
  if (!trade) throw new Error('Trade not found.');
  const docs = getDocs(tradeId);
  const docsPresent = [...new Set(docs.map((d) => d.type))];
  const { results } = resultsFor(tradeId);
  const profile = refreshRisk(tradeId);

  // Pending and unknown minimum checks are flagged to lenders automatically; a failure needs an explicit flag.
  const minimum = [1, 2, 5, 8, 12, 14];
  const explicitFailures = minimum.filter(
    (id) => results[id] === 'fail' && !trade.flaggedUnknownOrFailed.includes(id),
  );
  if (explicitFailures.length) {
    throw Object.assign(new Error('Resolve or explicitly flag failed checks before opening to lenders.'), {
      code: 'CHECKS_BLOCKING',
      checks: explicitFailures,
    });
  }
  const autoFlag = minimum.filter((checkId) => results[checkId] !== 'pass' && !trade.flaggedUnknownOrFailed.includes(checkId));
  if (autoFlag.length) {
    trade.flaggedUnknownOrFailed = [...trade.flaggedUnknownOrFailed, ...autoFlag];
    audit(actor, 'checks.flagged', `trade:${tradeId}`, { checks: autoFlag }, tradeId);
  }
  const consent = canOpenToLenders(results, trade.flaggedUnknownOrFailed);
  if (!consent.ok) {
    throw Object.assign(new Error('Resolve or explicitly flag failed checks before opening to lenders.'), {
      code: 'CHECKS_BLOCKING',
      checks: consent.blocking,
    });
  }

  const eligible: string[] = [];
  const excluded: { lenderId: string; reasons: string[] }[] = [];
  for (const product of state.products.filter((p) => p.lenderId !== 'org_ops')) {
    const lens = checkEligibility(product, trade, docsPresent, profile.strength);
    if (!lens.eligible) {
      excluded.push({ lenderId: product.lenderId, reasons: lens.reasons });
      continue;
    }
    if (!state.offerRequests[tradeId]?.eligible.includes(product.lenderId)) {
      eligible.push(product.lenderId);
      const offer = buildOfferFromProduct(product, trade, product.lenderId, new Date(), `_${state.seq}`);
      const baseDelay = product.lenderId === 'lender_tidewater' ? 4000 : product.lenderId === 'lender_banyan' ? 8000 : 12_000;
      state.pendingOffers.push({
        id: id('poff'),
        tradeId,
        lenderId: product.lenderId,
        dueAt: Date.now() + ms(baseDelay),
        offer,
      });
    }
  }
  state.offerRequests[tradeId] = {
    tradeId,
    requestedAt: new Date().toISOString(),
    eligible: [...new Set([...(state.offerRequests[tradeId]?.eligible ?? []), ...eligible])],
    excluded,
  };

  if (trade.status === 'VERIFIED') trade.status = 'OFFERS_OPEN';
  for (const lenderId of eligible) {
    grantConsent({
      orgId: trade.smeId,
      tradeId,
      recipientOrgId: lenderId,
      purpose: 'Credit assessment for this trade',
      days: 30,
    });
  }
  audit(actor, 'offers.requested', `trade:${tradeId}`, { eligible, excluded: excluded.map((e) => e.lenderId) }, tradeId);
  notify('Trade opened to lenders', `${eligible.length} lenders received the verified trade.`, 'info');
  save();
  materialize();
  return { eligible, excluded, pending: state.pendingOffers.filter((p) => p.tradeId === tradeId).length };
}

export function respondNow(tradeId?: string) {
  for (const p of state.pendingOffers) {
    if (!tradeId || p.tradeId === tradeId) p.dueAt = Date.now() - 1;
  }
  materialize();
}

export function offersFor(tradeId: string, opts: { viewerLenderId?: string } = {}): Offer[] {
  materialize();
  let list = state.offers.filter((o) => o.tradeId === tradeId);
  if (opts.viewerLenderId) list = list.filter((o) => o.lenderId === opts.viewerLenderId);
  const trade = getTrade(tradeId);
  if (!opts.viewerLenderId && trade && list.length >= 3 && !state.rankingsLogged[tradeId]) {
    state.rankingsLogged[tradeId] = true;
    const ranked = [...list].sort((a, b) => offerMath(trade.value, a).effectiveAPR - offerMath(trade.value, b).effectiveAPR);
    audit('system', 'ranking.computed', `trade:${tradeId}`, {
      sortKey: 'effectiveAPR',
      order: ranked.map((o) => o.lenderId),
      note: 'Commission is not an input.',
    }, tradeId);
    save();
  }
  return list;
}

export function pendingOffersFor(tradeId: string) {
  materialize();
  return state.pendingOffers.filter((p) => p.tradeId === tradeId).map((p) => p.lenderId);
}

export function createLenderOffer(
  tradeId: string,
  lenderId: string,
  body: Partial<Offer>,
  actor = 'lender',
): Offer {
  const trade = getTrade(tradeId);
  if (!trade) throw new Error('Trade not found.');
  if (!canLenderView(state.consents, tradeId, lenderId)) {
    throw Object.assign(new Error('Consent required.'), { code: 'CONSENT_REQUIRED' });
  }
  const offer: Offer = {
    id: id('off'),
    tradeId,
    lenderId,
    advancePct: body.advancePct ?? 85,
    ratePct: body.ratePct ?? 11.5,
    tenureDays: body.tenureDays ?? 90,
    fees: body.fees ?? [],
    recourse: body.recourse ?? true,
    collateral: body.collateral ?? 'None',
    conditions: body.conditions ?? '',
    validUntil: body.validUntil ?? new Date(Date.now() + 7 * 86_400_000).toISOString(),
    status: 'open',
    disbursalHours: body.disbursalHours ?? 48,
    submittedAt: new Date().toISOString(),
    productType: body.productType ?? 'Export invoice discounting',
  };
  state.offers.push(offer);
  audit(actor, 'offer.submitted', `offer:${offer.id}`, { lenderId }, tradeId);
  save();
  return offer;
}

export function acceptOffer(offerId: string, actor = 'exporter'): Offer {
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer) throw new Error('Offer not found.');
  const trade = getTrade(offer.tradeId);
  if (!trade) throw new Error('Trade not found.');
  state.offers.forEach((o) => {
    if (o.tradeId === offer.tradeId) o.status = o.id === offerId ? 'accepted' : 'declined';
  });
  offer.status = 'accepted';
  trade.status = 'OFFER_ACCEPTED';
  audit(actor, 'offer.accepted', `offer:${offer.id}`, { lenderId: offer.lenderId }, trade.id);
  notify('Offer accepted', `${orgName(offer.lenderId)} will fund this trade.`, 'success');
  save();
  return offer;
}

export function signOffer(offerId: string, actor = 'exporter') {
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer) throw new Error('Offer not found.');
  const trade = getTrade(offer.tradeId);
  if (!trade) throw new Error('Trade not found.');
  if (trade.status === 'OFFER_ACCEPTED') trade.status = 'CONTRACT_SIGNED';
  state.disbursals[trade.id] = Date.now() + ms(2000);
  audit(actor, 'contract.signed', `offer:${offer.id}`, { method: 'OTP (simulated)' }, trade.id);
  save();
  materialize();
  return offer;
}

export function commitToRegistry(trade: Trade, lenderId: string): RegistryEntry {
  const inv = invoiceFields(getDocs(trade.id));
  const prev = [...state.registry].sort((a, b) => b.position - a.position)[0];
  const entry = buildEntry(prev, {
    fingerprint: fingerprint({
      supplierId: trade.smeId,
      buyerId: trade.buyerId,
      invoiceNo: inv.invoiceNo,
      invoiceDate: inv.invoiceDate,
      amount: inv.amount,
      currency: inv.currency,
    }),
    irnFingerprint: irnFingerprint(inv.irn),
    lenderId,
    status: 'FINANCED',
    timestamp: new Date().toISOString(),
    supplierId: trade.smeId,
    buyerId: trade.buyerId,
    ref: inv.invoiceNo,
    meta: {
      supplierId: trade.smeId,
      buyerId: trade.buyerId,
      invoiceNo: inv.invoiceNo,
      invoiceDate: inv.invoiceDate,
      amount: inv.amount,
      currency: inv.currency,
      irn: inv.irn,
    },
  });
  state.registry.push(entry);
  audit('system', 'registry.committed', `registry:${entry.position}`, { fingerprint: entry.fingerprint }, trade.id);
  save();
  return entry;
}

export function registryCheck(
  input: Parameters<typeof checkDuplicate>[0],
  lenderId = 'lender_banyan',
) {
  return checkDuplicate(input, state.registry, lenderId);
}

export function moveShipment(tradeId: string) {
  const trade = getTrade(tradeId);
  if (!trade) return;
  const stage = (state.shipment[tradeId] ?? 0) + 1;
  state.shipment[tradeId] = Math.min(stage, 4);
  const transitions: Partial<Record<number, TradeStatus>> = {
    2: 'SHIPMENT_IN_TRANSIT',
    3: 'DELIVERED',
    4: 'BUYER_ACCEPTED',
  };
  const to = transitions[stage];
  if (to && trade.status !== to && canTransition(trade.status, to)) trade.status = to;
  audit('system', 'shipment.advanced', `trade:${tradeId}`, { stage }, tradeId);
  save();
}

export function confirmBuyer(tradeId: string) {
  state.buyerConfirmed[tradeId] = true;
  audit('buyer', 'buyer.confirmed', `trade:${tradeId}`, undefined, tradeId);
  save();
  startVerification(tradeId, [14], 'buyer');
}

export function advanceTime(tradeId: string, what: 'repaid' | 'time-30d') {
  if (what === 'time-30d') {
    audit('demo', 'time.advanced', `trade:${tradeId}`, { days: 30 }, tradeId);
    save();
    return;
  }
  const trade = getTrade(tradeId);
  if (!trade) return;
  if (trade.status !== 'REPAID' && trade.status !== 'CLOSED') {
    trade.status = 'REPAID';
    const inv = invoiceFields(getDocs(tradeId));
    state.history.push({
      id: id('hist'),
      smeId: trade.smeId,
      buyerId: trade.buyerId,
      value: Math.round(inv.amount * FX),
      currency: 'USD',
      completedAt: new Date().toISOString(),
      deliveredOnTime: true,
      repaidOnTime: true,
    });
    audit('system', 'repayment.received', `trade:${tradeId}`, { value: inv.amount }, tradeId);
    notify('Repayment received', `${orgName(trade.buyerId)} paid ${money(Math.round(inv.amount * FX))}.`, 'success');
  }
  save();
}

export function passportFor(orgId: string, recipient = 'Meridian Bank', purpose = 'Credit assessment') {
  const org = state.orgs.find((o) => o.id === orgId);
  if (!org) throw new Error('Org not found.');
  const history = state.history.filter((h) => h.smeId === orgId);
  const entityChecks = { mca: 'pass' as const, udyam: 'pass' as const, iec: 'pass' as const, gst: 'pass' as const };
  return buildPassport({
    orgId,
    legalName: org.legalName,
    history: history.map((h) => ({ value: h.value, deliveredOnTime: h.deliveredOnTime, repaidOnTime: h.repaidOnTime })),
    entityChecks,
    recipient,
    purpose,
  });
}

export function opsDecision(caseId: string, decision: string, note: string, actor = 'Asha (Cashew Ops)') {
  const c = state.ops.find((x) => x.id === caseId);
  if (!c) throw new Error('Case not found.');
  c.status = 'closed';
  c.decision = decision;
  c.note = note;
  c.reviewer = actor;
  if (decision === 'Confirm duplicate') {
    const trade = getTrade(c.tradeId);
    if (trade) trade.flaggedUnknownOrFailed = [...new Set([...trade.flaggedUnknownOrFailed, 12])];
  }
  audit(actor, 'ops.decision', `case:${caseId}`, { decision, note }, c.tradeId);
  save();
  return c;
}

export function eligibleConsent(tradeId: string, lenderId: string): boolean {
  return canLenderView(state.consents, tradeId, lenderId);
}

export function acceptedOffer(tradeId: string): Offer | undefined {
  return state.offers.find((o) => o.tradeId === tradeId && o.status === 'accepted');
}

export function setProduct(id: string, patch: Partial<LenderProduct>) {
  const p = state.products.find((x) => x.id === id);
  if (!p) return;
  Object.assign(p, patch);
  audit('lender', 'product.updated', `product:${id}`, patch);
  save();
}

export function setAnchor(head: string) {
  state.anchor = { head, at: new Date().toISOString() };
  audit('ops', 'registry.anchored', 'registry:head', { head, simulated: true });
  save();
}

export function addOpsCase(c: Omit<OpsCase, 'id' | 'ageHours' | 'reviewer' | 'status'>) {
  const existing = state.ops.find((o) => o.tradeId === c.tradeId && o.status === 'open');
  if (existing) return existing;
  const item: OpsCase = { ...c, id: id('case'), ageHours: 0, reviewer: 'Unassigned', status: 'open' };
  state.ops.unshift(item);
  save();
  return item;
}

export function getProductForLender(lenderId: string): LenderProduct | undefined {
  return state.products.find((p) => p.lenderId === lenderId);
}
