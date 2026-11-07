'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSearch,
  Flag,
  Info,
  Lock,
  Plus,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, toast, useApi } from '@/lib/client';
import { Button } from '@/components/Button';
import { StatusChip, BandChip } from '@/components/StatusChip';
import { HashPill } from '@/components/HashPill';
import { VerificationBoard, type EvidenceResponse } from '@/components/VerificationBoard';
import { EmptyState } from '@/components/EmptyState';
import { inr, usd, pct, dateOnly, dateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { offerMath } from '@/lib/engines/matching';
import type { Buyer, Fee, LenderProduct, Offer, Org, RiskProfile, Trade } from '@/lib/types';
import type { OfferWithMath } from '@/components/OfferComparison';

interface TradeRes {
  trade: Trade;
  buyer: Buyer;
  exporter: Org;
  risk: RiskProfile;
  offerStatus?: string;
}
interface RiskRes {
  risk: RiskProfile;
  trade: Trade;
}
interface ProductsRes {
  product?: LenderProduct;
  products: LenderProduct[];
}
interface OffersRes {
  offers: OfferWithMath[];
  trade: Trade;
}

const COMPONENT_LABELS: Record<string, { label: string; check: string }> = {
  entity: { label: 'Entity health', check: 'Checks 1–4' },
  txn: { label: 'Transaction authenticity', check: 'Checks 5–8, 12' },
  buyer: { label: 'Buyer risk', check: 'Checks 9–11, 14' },
  structure: { label: 'Structure and terms', check: 'Check 13 + terms' },
};
const COMPONENT_ORDER = ['entity', 'txn', 'buyer', 'structure'];
const COMPONENT_MAX = [30, 40, 20, 10];

const FEE_KINDS: { value: Fee['kind']; label: string }[] = [
  { value: 'pctAdvance', label: '% of advance' },
  { value: 'pctInvoice', label: '% of invoice' },
  { value: 'flat', label: 'Flat ₹' },
];

export default function LenderReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tradeRes, error: tradeError, refresh: refreshTrade } = useApi<TradeRes>(
    id ? `/trades/${id}` : null,
    { interval: 4000 },
  );
  const { data: evidence } = useApi<EvidenceResponse>(id ? `/trades/${id}/evidence` : null, {
    interval: 5000,
  });
  const { data: offersData, refresh: refreshOffers } = useApi<OffersRes>(
    id ? `/trades/${id}/offers` : null,
    { interval: 4000 },
  );
  const { data: productsRes } = useApi<ProductsRes>('/lender/products', { interval: 0 });
  const product = productsRes?.product;

  const [weights, setWeights] = useState<[number, number, number, number]>([1, 1, 1, 1]);
  const { data: riskRes } = useApi<RiskRes>(
    id ? `/trades/${id}/risk-profile?w=${weights.join(',')}` : null,
    { interval: 0 },
  );
  const weighted = riskRes?.risk ?? tradeRes?.risk;

  const trade = tradeRes?.trade;
  const ownOffer = offersData?.offers?.[0];

  const [advancePct, setAdvancePct] = useState(85);
  const [ratePct, setRatePct] = useState(11.5);
  const [tenureDays, setTenureDays] = useState(90);
  const [fees, setFees] = useState<Fee[]>([]);
  const [conditions, setConditions] = useState('');
  const [recourse, setRecourse] = useState(true);
  const [collateral, setCollateral] = useState('None');
  const [disbursalHours, setDisbursalHours] = useState(48);
  const [submitting, setSubmitting] = useState(false);
  const prefilled = useRef(false);

  useEffect(() => {
    if (prefilled.current || !product) return;
    prefilled.current = true;
    setAdvancePct(product.advancePct ?? 85);
    setRatePct(product.ratePct ?? 11.5);
    setTenureDays(Math.min(product.maxTenureDays, 90));
    setFees((product.fees ?? []).map((f) => ({ ...f })));
    setConditions(product.conditions ?? '');
    setRecourse(product.recourse ?? true);
    setCollateral(product.collateral ?? 'None');
    setDisbursalHours(product.disbursalHours ?? 48);
  }, [product]);

  const draft: Offer | null = useMemo(() => {
    if (!trade) return null;
    return {
      id: 'preview',
      tradeId: trade.id,
      lenderId: 'preview',
      advancePct: Number(advancePct) || 0,
      ratePct: Number(ratePct) || 0,
      tenureDays: Math.max(1, Number(tenureDays) || 1),
      fees: fees.filter((f) => f.label.trim() && Number(f.value) >= 0),
      recourse,
      collateral,
      conditions,
      validUntil: new Date().toISOString(),
      status: 'open',
      disbursalHours,
      submittedAt: new Date().toISOString(),
      productType: product?.type,
    };
  }, [trade, advancePct, ratePct, tenureDays, fees, recourse, collateral, conditions, disbursalHours, product?.type]);

  const preview = draft && trade ? offerMath(trade.value, draft) : null;
  const hidden = preview?.hiddenFees.reduce((s, f) => s + f.amount, 0) ?? 0;

  function updateFee(index: number, patch: Partial<Fee>) {
    setFees((rows) => rows.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function feeSuffix(kind: Fee['kind']) {
    return kind === 'flat' ? '₹' : '%';
  }

  async function submitOffer() {
    if (!trade) return;
    if (!(advancePct > 0 && advancePct <= 100)) {
      toast('Advance is out of range', 'Use a value above 0 and no more than 100%.', 'danger');
      return;
    }
    if (!(ratePct >= 0)) {
      toast('Headline rate is invalid', 'Use a rate of zero or more.', 'danger');
      return;
    }
    setSubmitting(true);
    try {
      const validity = product?.validityDays ?? 7;
      await api('/offers', {
        method: 'POST',
        json: {
          tradeId: trade.id,
          advancePct: Number(advancePct),
          ratePct: Number(ratePct),
          tenureDays: Number(tenureDays),
          fees: draft?.fees ?? [],
          recourse,
          collateral,
          conditions,
          disbursalHours: Number(disbursalHours),
          productType: product?.type ?? 'Export invoice discounting',
          validUntil: new Date(Date.now() + validity * 86_400_000).toISOString(),
        },
      });
      toast('Sealed offer submitted', 'The exporter will see its effective cost, including conditional fees.', 'success');
      refreshOffers();
      refreshTrade();
    } catch (e) {
      toast('Offer not submitted', (e as Error).message, 'danger');
    } finally {
      setSubmitting(false);
    }
  }

  if (tradeError) {
    return (
      <div className="card">
        <EmptyState
          title={tradeError.code === 'CONSENT_REQUIRED' ? 'No consent for this trade' : 'Trade unavailable'}
          body={
            tradeError.code === 'CONSENT_REQUIRED'
              ? 'The exporter has not shared this trade with your lender, or the consent has expired or been revoked.'
              : tradeError.message
          }
          action="Back to inbox"
          href="/lender"
        />
      </div>
    );
  }

  if (!trade) {
    return <div className="card p-10 text-center text-[13px] text-ink-3">Loading shared trade…</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/lender" className="mb-2 inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink">
          <ArrowLeft size={14} /> Inbox
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="h2 mono !font-mono !text-[20px]">{trade.id}</h1>
              <StatusChip status={statusFor(trade.status)} label={trade.status.replace(/_/g, ' ').toLowerCase()} />
              {weighted && <BandChip band={weighted.band} />}
              {tradeRes?.offerStatus && (
                <StatusChip status={tradeRes.offerStatus === 'Accepted' ? 'success' : 'neutral'} label={tradeRes.offerStatus} size="sm" />
              )}
            </div>
            <div className="mt-1 text-[13px] text-ink-2">
              {tradeRes?.exporter?.legalName} → {tradeRes?.buyer?.name} · {trade.goods}
            </div>
          </div>
          <HashPill hash={evidence?.bundle.bundleHash ?? ''} label="Evidence bundle" />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-card border border-line bg-[#fffaf0] px-4 py-3 text-[12px] leading-5 text-ink-2">
        <Lock size={15} className="mt-0.5 shrink-0 text-brand" />
        <div>
          Shared under a scoped consent for credit assessment. You see this trade&apos;s evidence and your own offer
          only; other lenders&apos; offers are sealed. Consent expiry is enforced by the API.
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-4">
          <section className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="h3">Trade facts</div>
              <StatusChip status="info" label={`Scenario ${trade.scenario}`} size="sm" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <dl className="space-y-2 text-[13px]">
                <KV label="Invoice value" value={`${inr(trade.value)} (${usd(trade.value / trade.fx)} @ ${trade.fx.toFixed(2)})`} />
                <KV label="Buyer" value={`${tradeRes?.buyer?.name} · ${tradeRes?.buyer?.country}`} />
                <KV label="Buyer registration" value={tradeRes?.buyer?.registrationId} />
                <KV label="Buyer rating" value={tradeRes?.buyer?.rating ?? 'Not rated'} />
              </dl>
              <dl className="space-y-2 text-[13px]">
                <KV label="Corridor" value={trade.corridor} />
                <KV label="Incoterm" value={trade.incoterm} />
                <KV label="Payment terms" value={`${trade.paymentTermsDays} days`} />
                <KV label="Flagged to lenders" value={evidence?.flagged?.length ? `Checks ${evidence.flagged.join(', ')}` : 'None'} />
              </dl>
            </div>
            {evidence?.flagged?.length ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[11px] leading-4 text-warn">
                <Flag size={13} className="mt-0.5 shrink-0" />
                The exporter explicitly flagged check(s) {evidence.flagged.join(', ')}. Read those rows before pricing.
              </div>
            ) : null}
          </section>

          {weighted && (
            <section className="card p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="h3">Your weighted view</div>
                  <div className="text-[12px] text-ink-3">
                    Component weights change the blend, never the underlying check result.
                  </div>
                </div>
                <WeightControls weights={weights} onChange={setWeights} />
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <div className="caption">Weighted strength</div>
                  <div className="font-display text-[38px] font-semibold leading-10 tabular">
                    {pct(weighted.strength, 1)}
                  </div>
                </div>
                <div className="pb-1">
                  <BandChip band={weighted.band} />
                  <div className="mt-1 text-[11px] text-ink-3">Rules {weighted.ruleVersion}</div>
                </div>
                <div className="flex-1" />
                <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-[11px] text-ink-2">
                  Weights ×{weights.map((w) => w.toFixed(2)).join(' / ×')} ·{' '}
                  {weighted.blocking.length ? `capped by check(s) ${weighted.blocking.join(', ')}` : 'no blocking check'}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {COMPONENT_ORDER.map((key, i) => {
                  const earned = weighted.components[key] ?? 0;
                  const max = weighted.componentMax[key] ?? COMPONENT_MAX[i];
                  const share = weights[i] * max;
                  const denominator = COMPONENT_ORDER.reduce(
                    (sum, k, j) => sum + weights[j] * (weighted.componentMax[k] ?? COMPONENT_MAX[j]),
                    0,
                  );
                  return (
                    <div key={key} className="rounded-lg border border-line px-3 py-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12px] font-medium text-ink">{COMPONENT_LABELS[key]?.label ?? key}</span>
                        <span className="tabular text-[12px] text-ink-2">
                          {earned}/{max}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${Math.min(100, (earned / Math.max(1, max)) * 100)}%` }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] text-ink-3">
                        <span>{COMPONENT_LABELS[key]?.check}</span>
                        <span>{denominator ? Math.round((share / denominator) * 100) : 0}% of blend</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="card p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="h3">Verified evidence</div>
                <div className="text-[12px] text-ink-3">
                  Fourteen checks, each with a source and an evidence reference. Click any completed row.
                </div>
              </div>
              {evidence && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <StatusChip status="pass" label={`${evidence.checks.filter((c) => c.result === 'pass').length} pass`} size="sm" />
                  <StatusChip status="unknown" label={`${evidence.checks.filter((c) => c.result === 'unknown').length} unknown`} size="sm" />
                  <StatusChip status="fail" label={`${evidence.checks.filter((c) => c.result === 'fail').length} fail`} size="sm" />
                  <StatusChip status="warn" label={`${evidence.checks.filter((c) => c.result === 'warn').length} review`} size="sm" />
                </div>
              )}
            </div>
            <VerificationBoard evidence={evidence} onRun={() => undefined} canAct={false} compact />
          </section>
        </div>

        <aside className="space-y-4">
          {ownOffer ? (
            <section className="card p-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="caption">Your sealed offer</div>
                <StatusChip
                  status={ownOffer.status === 'accepted' ? 'success' : ownOffer.status === 'declined' ? 'neutral' : 'brand'}
                  label={ownOffer.status === 'accepted' ? 'Accepted' : ownOffer.status === 'declined' ? 'Not selected' : 'Submitted'}
                  size="sm"
                />
              </div>
              <div className="font-display text-[30px] font-semibold leading-9 tabular">
                {pct(ownOffer.math.effectiveAPR)}
              </div>
              <div className="text-[11px] text-ink-3">effective annualised cost as the exporter sees it</div>
              <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-[12px] text-ink-2">
                <RowKV label="Advance" value={inr(ownOffer.math.advance)} />
                <RowKV label="Net cash" value={inr(ownOffer.math.netCash)} />
                <RowKV label="Total fees" value={inr(ownOffer.math.fees)} />
                <RowKV label="Tenure" value={`${ownOffer.tenureDays} days`} />
                <RowKV label="Submitted" value={ownOffer.submittedAt ? dateTime(ownOffer.submittedAt) : '—'} />
              </div>
              {ownOffer.math.hiddenFees.length > 0 && (
                <div className="mt-2 rounded-lg bg-warn-soft px-2.5 py-2 text-[11px] leading-4 text-warn">
                  {inr(ownOffer.math.hiddenFees.reduce((s, f) => s + f.amount, 0))} of your fees were disclosed only in
                  the conditions. The exporter sees them.
                </div>
              )}
              <p className="mt-3 text-[11px] leading-4 text-ink-3">
                Sealed offers cannot be edited after submission. Product changes apply to new offers only.
              </p>
            </section>
          ) : (
            <section className="card p-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="caption">Sealed offer</div>
                <StatusChip status="info" label="One per trade" size="sm" />
              </div>
              <p className="text-[12px] leading-5 text-ink-2">
                Your offer is sealed until the exporter chooses. It is ranked against others by effective cost, never by
                commission.
              </p>

              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Advance %">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={advancePct}
                      onChange={(e) => setAdvancePct(Number(e.target.value))}
                      className="input"
                    />
                  </Field>
                  <Field label="Headline rate % p.a.">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={ratePct}
                      onChange={(e) => setRatePct(Number(e.target.value))}
                      className="input"
                    />
                  </Field>
                  <Field label="Tenure (days)">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={tenureDays}
                      onChange={(e) => setTenureDays(Number(e.target.value))}
                      className="input"
                    />
                  </Field>
                  <Field label="Disbursal (hours)">
                    <input
                      type="number"
                      min={1}
                      value={disbursalHours}
                      onChange={(e) => setDisbursalHours(Number(e.target.value))}
                      className="input"
                    />
                  </Field>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-ink-3">Fees</span>
                    <button
                      type="button"
                      onClick={() =>
                        setFees((f) => [...f, { label: '', kind: 'pctAdvance', value: 0, statedIn: 'headline' }])
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-brand"
                    >
                      <Plus size={12} /> Add fee
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {fees.map((f, i) => (
                      <div key={i} className="rounded-lg border border-line bg-canvas/50 p-2">
                        <div className="flex gap-1.5">
                          <input
                            value={f.label}
                            onChange={(e) => updateFee(i, { label: e.target.value })}
                            placeholder="Fee label"
                            className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-[11px]"
                          />
                          <button
                            type="button"
                            aria-label="Remove fee"
                            onClick={() => setFees((rows) => rows.filter((_, j) => j !== i))}
                            className="rounded-md px-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="mt-1.5 grid grid-cols-[1fr_92px_74px] gap-1.5">
                          <select
                            value={f.kind}
                            onChange={(e) => updateFee(i, { kind: e.target.value as Fee['kind'] })}
                            className="h-8 rounded-md border border-line bg-surface px-1.5 text-[11px]"
                            aria-label="Fee kind"
                          >
                            {FEE_KINDS.map((k) => (
                              <option key={k.value} value={k.value}>
                                {k.label}
                              </option>
                            ))}
                          </select>
                          <div className="relative">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={f.value}
                              onChange={(e) => updateFee(i, { value: Number(e.target.value) })}
                              className="h-8 w-full rounded-md border border-line bg-surface px-2 pr-5 text-[11px] tabular"
                              aria-label="Fee value"
                            />
                            <span className="pointer-events-none absolute right-1.5 top-1.5 text-[10px] text-ink-3">
                              {feeSuffix(f.kind)}
                            </span>
                          </div>
                          <select
                            value={f.statedIn}
                            onChange={(e) => updateFee(i, { statedIn: e.target.value as Fee['statedIn'] })}
                            className={cn(
                              'h-8 rounded-md border px-1.5 text-[10px]',
                              f.statedIn === 'conditions'
                                ? 'border-warn/40 bg-warn-soft text-warn'
                                : 'border-line bg-surface text-ink-3',
                            )}
                            aria-label="Fee disclosure"
                          >
                            <option value="headline">Headline</option>
                            <option value="conditions">Conditions</option>
                          </select>
                        </div>
                      </div>
                    ))}
                    {fees.length === 0 && (
                      <p className="rounded-lg border border-dashed border-line px-2 py-3 text-center text-[11px] text-ink-3">
                        No fees. Add one, or offer at the headline rate.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Recourse">
                    <select
                      value={recourse ? 'yes' : 'no'}
                      onChange={(e) => setRecourse(e.target.value === 'yes')}
                      className="input"
                    >
                      <option value="yes">Recourse</option>
                      <option value="no">Non-recourse</option>
                    </select>
                  </Field>
                  <Field label="Collateral">
                    <input
                      value={collateral}
                      onChange={(e) => setCollateral(e.target.value)}
                      className="input"
                      placeholder="None"
                    />
                  </Field>
                </div>

                <Field label="Conditions shown to the exporter">
                  <textarea
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                    rows={3}
                    className="w-full rounded-input border border-line bg-surface px-3 py-2 text-[11px] leading-5"
                    placeholder="Any condition that changes the real cost belongs here."
                  />
                </Field>

                {preview && (
                  <div className="rounded-lg border border-brand/25 bg-brand-soft/60 p-3">
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-ink-3">
                          Effective cost preview
                        </div>
                        <div className="font-display text-[26px] font-semibold leading-8 tabular text-brand">
                          {pct(preview.effectiveAPR)}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-ink-2">
                        <div className="tabular font-medium">{inr(preview.netCash)}</div>
                        <div className="text-[10px] text-ink-3">net cash</div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 border-t border-brand/15 pt-2 text-[10px] text-ink-2">
                      <div>
                        Advance<div className="tabular text-[11px] font-medium text-ink">{inr(preview.advance)}</div>
                      </div>
                      <div>
                        Interest<div className="tabular text-[11px] font-medium text-ink">{inr(preview.interest)}</div>
                      </div>
                      <div>
                        Fees<div className="tabular text-[11px] font-medium text-ink">{inr(preview.fees)}</div>
                      </div>
                    </div>
                    {hidden > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-warn">
                        <AlertTriangle size={11} /> Includes {inr(hidden)} disclosed only in conditions.
                      </div>
                    )}
                  </div>
                )}

                <Button className="w-full" onClick={submitOffer} loading={submitting} icon={<Send size={15} />}>
                  Seal and submit offer
                </Button>
                <p className="text-center text-[10px] leading-4 text-ink-3">
                  Submitting records an AuditEvent. No money moves and no offer is revealed to another lender.
                </p>
              </div>
            </section>
          )}

          {weighted?.blocking.length ? (
            <div className="rounded-card border border-danger/20 bg-danger-soft px-4 py-3 text-[11px] leading-4 text-danger">
              <div className="mb-0.5 flex items-center gap-1.5 font-semibold">
                <X size={12} /> Blocking check: {weighted.blocking.join(', ')}
              </div>
              The band is capped at Limited regardless of the weighted arithmetic. Price accordingly or decline.
            </div>
          ) : null}

          <div className="card p-5">
            <div className="caption mb-2">Evidence integrity</div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[12px] text-success">
                <CheckCircle2 size={14} /> Bundle hash committed
              </div>
              <HashPill hash={evidence?.bundle?.bundleHash ?? ''} label="Bundle hash" />
              <div className="text-[11px] leading-4 text-ink-3">
                Any later change to a document or result changes the bundle hash. A lender can compare the hash they
                reviewed with the one attached to the accepted offer.
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="caption mb-2">What you do not see</div>
            <ul className="space-y-1.5 text-[12px] leading-5 text-ink-2">
              <li>• Other lenders&apos; offers or pricing.</li>
              <li>• Commission paid by any lender (there is none).</li>
              <li>• Documents the exporter did not share.</li>
              <li>• Another exporter&apos;s registry entries.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function WeightControls({
  weights,
  onChange,
}: {
  weights: [number, number, number, number];
  onChange: (w: [number, number, number, number]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SlidersHorizontal size={14} className="text-ink-3" />
      {COMPONENT_ORDER.map((key, i) => (
        <label key={key} className="flex items-center gap-1 rounded-full border border-line bg-canvas px-2 py-1">
          <span className="text-[10px] text-ink-3">{COMPONENT_LABELS[key]?.label.split(' ')[0]}</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.25}
            value={weights[i]}
            onChange={(e) => {
              const next = [...weights] as [number, number, number, number];
              next[i] = Number(e.target.value);
              onChange(next);
            }}
            className="h-1 w-14 accent-[var(--brand)]"
            aria-label={`${COMPONENT_LABELS[key]?.label} weight`}
          />
          <span className="w-6 text-right font-mono text-[10px] text-ink-2">×{weights[i]}</span>
        </label>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-ink-3">{label}</span>
      {children}
    </label>
  );
}

function RowKV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-ink-3">{label}</span>
      <span className="tabular text-right text-ink">{value}</span>
    </div>
  );
}

function KV({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="text-ink">{value ?? '—'}</dd>
    </div>
  );
}

function statusFor(status: string) {
  if (['NEEDS_INFO', 'REJECTED_VERIFICATION', 'DEFAULTED', 'DISPUTED'].includes(status)) return 'warn';
  if (['VERIFIED', 'FINANCED', 'REPAID', 'CLOSED', 'BUYER_ACCEPTED', 'DELIVERED'].includes(status)) return 'success';
  if (['OFFERS_OPEN', 'OFFER_ACCEPTED', 'CONTRACT_SIGNED', 'SHIPMENT_IN_TRANSIT'].includes(status)) return 'brand';
  return 'neutral';
}
