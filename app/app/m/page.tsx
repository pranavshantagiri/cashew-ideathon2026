'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bell,
  ChevronLeft,
  Clock3,
  FileText,
  Home,
  MapPin,
  Package,
  Ship,
  Truck,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { useApi } from '@/lib/client';
import { StatusChip, BandChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { cn } from '@/lib/cn';
import { inr, pct, dateOnly, STATUS_LABELS, usd } from '@/lib/format';
import type { Trade } from '@/lib/types';
import type { EvidenceResponse } from '@/components/VerificationBoard';
import type { OfferWithMath } from '@/components/OfferComparison';

interface TradesRes {
  trades: (Trade & { buyerName: string; strength: number; band: string })[];
}
interface SessionRes {
  org: { legalName: string } | null;
  scenario: string;
}
interface OffersRes {
  offers: OfferWithMath[];
  pending: string[];
}

const TABS = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'offers', label: 'Offers', icon: Wallet },
  { key: 'track', label: 'Track', icon: Package },
] as const;

export default function MobileViewPage() {
  const { data: session } = useApi<SessionRes>('/orgs/me', { interval: 6000 });
  const { data: tradesData } = useApi<TradesRes>('/trades', { interval: 3000 });
  const trades = tradesData?.trades ?? [];
  const active = trades.find((t) => !['REPAID', 'CLOSED', 'WITHDRAWN'].includes(t.status)) ?? trades[0];
  const { data: tradeRes } = useApi<{ trade: Trade; buyer?: { name: string } }>(
    active ? `/trades/${active.id}` : null,
    { interval: 3000 },
  );
  const { data: evidence } = useApi<EvidenceResponse>(
    active ? `/trades/${active.id}/evidence` : null,
    { interval: 3000 },
  );
  const { data: offersData } = useApi<OffersRes>(
    active ? `/trades/${active.id}/offers` : null,
    { interval: 3000 },
  );
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('home');

  const trade = tradeRes?.trade ?? active;
  const offers = offersData?.offers ?? [];
  const strength = evidence?.risk;

  return (
    <div className="space-y-5">
      <div>
        <div className="caption mb-1">Exporter workspace</div>
        <h1 className="h1">Mobile view</h1>
        <p className="mt-1 max-w-xl text-[13px] leading-5 text-ink-2">
          The same verified state, on the phone an exporter actually carries. Nothing here is a separate app: actions
          on the phone and on the desktop read and write one trade state.
        </p>
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* phone */}
        <div className="mx-auto w-full max-w-[420px]">
          <div className="rounded-[42px] border-[9px] border-[#22312a] bg-[#22312a] shadow-md">
            <div className="relative flex h-[780px] flex-col overflow-hidden rounded-[33px] bg-canvas">
              <div className="absolute left-1/2 top-2 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-[#22312a]" />
              <div className="flex items-center justify-between px-6 pb-2 pt-3 text-[11px] text-ink-2">
                <span className="tabular">9:41</span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-4 rounded-sm border border-ink-3" />
                  <span className="h-2.5 w-2 rounded-sm border border-ink-3" />
                </span>
              </div>

              <div className="flex items-center justify-between px-5 pb-3 pt-1">
                <div className="flex items-center gap-2">
                  {tab !== 'home' && (
                    <button
                      type="button"
                      aria-label="Back to home"
                      onClick={() => setTab('home')}
                      className="rounded-full p-1 text-ink-2 hover:bg-surface"
                    >
                      <ChevronLeft size={18} />
                    </button>
                  )}
                  <span className="font-display text-[19px] font-semibold tracking-tight">Cashew</span>
                </div>
                <div className="flex items-center gap-2 text-ink-3">
                  <Bell size={17} />
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                    KT
                  </span>
                </div>
              </div>

              <div className="thin-scroll flex-1 overflow-y-auto px-5 pb-4">
                {tab === 'home' && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-[11px] text-ink-3">Good morning</div>
                      <div className="font-display text-[21px] font-semibold leading-7">
                        {session?.org?.legalName ?? 'Kaveri Textiles'}
                      </div>
                    </div>

                    {trade ? (
                      <>
                        <div className="rounded-card bg-brand p-4 text-[#f7f4ec]">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-[10px] uppercase tracking-wide text-[#c8d8cf]">
                                {STATUS_LABELS[trade.status] ?? trade.status}
                              </div>
                              <div className="mt-1 font-display text-[24px] leading-7 tabular">{inr(trade.value)}</div>
                              <div className="text-[11px] text-[#c8d8cf]">
                                {usd(trade.value / trade.fx)} · {tradeRes?.buyer?.name ?? 'Buyer'}
                              </div>
                            </div>
                            {strength && (
                              <div className="rounded-full bg-white/10 px-2 py-1 text-[11px]">
                                {pct(strength.strength, 1)}
                              </div>
                            )}
                          </div>
                          <div className="mt-3 flex gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span
                                key={i}
                                className={cn(
                                  'h-1 flex-1 rounded-full',
                                  i < milestone(trade.status) ? 'bg-[#e7b780]' : 'bg-white/20',
                                )}
                              />
                            ))}
                          </div>
                          <div className="mt-2 flex justify-between text-[10px] text-[#b9cdc2]">
                            <span>Verified</span>
                            <span>Funded</span>
                            <span>Repaid</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <MiniStat label="Invoice" value={invoiceNo(evidence)} />
                          <MiniStat label="Tenure" value={`${trade.paymentTermsDays} days`} />
                          <MiniStat label="Checks passed" value={`${evidence?.checks.filter((c) => c.result === 'pass').length ?? 0}/14`} />
                          <MiniStat label="Evidence" value={strength ? strength.band : '—'} />
                        </div>

                        <Link href={`/app/trades/${trade.id}`}>
                          <div className="flex items-center justify-between rounded-card border border-line bg-surface px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <FileText size={16} className="text-brand" />
                              <div>
                                <div className="text-[12px] font-medium">Evidence bundle</div>
                                <div className="text-[10px] text-ink-3">14 checks · every source visible</div>
                              </div>
                            </div>
                            <ArrowRight size={15} className="text-ink-3" />
                          </div>
                        </Link>

                        <Link href={`/app/trades/${trade.id}?tab=offers`}>
                          <div className="flex items-center justify-between rounded-card border border-line bg-surface px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <Banknote size={16} className="text-accent" />
                              <div>
                                <div className="text-[12px] font-medium">
                                  {offers.length ? `${offers.length} sealed offers` : 'No offers yet'}
                                </div>
                                <div className="text-[10px] text-ink-3">
                                  {offers.length
                                    ? `Lowest effective cost ${pct(Math.min(...offers.map((o) => o.math.effectiveAPR)))}`
                                    : 'Open the trade to lenders when verified'}
                                </div>
                              </div>
                            </div>
                            <ArrowRight size={15} className="text-ink-3" />
                          </div>
                        </Link>
                      </>
                    ) : (
                      <EmptyState
                        compact
                        title="No trades yet"
                        body="Start on the desktop; this view follows the same state."
                        action="Start a trade"
                        href="/app/trades/new"
                      />
                    )}
                  </div>
                )}

                {tab === 'offers' && (
                  <div className="space-y-3">
                    <div className="font-display text-[20px] font-semibold">Sealed offers</div>
                    <p className="text-[11px] leading-4 text-ink-3">
                      Ranked by effective annualised cost. Headline rates can mislead; the number that matters is the
                      cost of the money.
                    </p>
                    {offers.length ? (
                      [...offers]
                        .sort((a, b) => a.math.effectiveAPR - b.math.effectiveAPR)
                        .map((o, i) => (
                          <div key={o.id} className="rounded-card border border-line bg-surface p-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="text-[13px] font-semibold">{o.lenderName}</div>
                                <div className="text-[10px] text-ink-3">
                                  {o.advancePct}% advance · {o.tenureDays} days
                                </div>
                              </div>
                              {i === 0 && (
                                <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-medium text-success">
                                  Lowest cost
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex items-end justify-between">
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-ink-3">Effective cost</div>
                                <div className="font-display text-[24px] font-semibold leading-7 tabular">
                                  {pct(o.math.effectiveAPR)}
                                </div>
                              </div>
                              <div className="text-right text-[11px] text-ink-2">
                                <div className="tabular font-medium">{inr(o.math.netCash)}</div>
                                <div className="text-[10px] text-ink-3">net cash</div>
                              </div>
                            </div>
                            {o.math.hiddenFees.length > 0 && (
                              <div className="mt-2 rounded-md bg-warn-soft px-2 py-1 text-[10px] text-warn">
                                Includes a fee disclosed only in the conditions.
                              </div>
                            )}
                          </div>
                        ))
                    ) : (
                      <EmptyState
                        compact
                        title="Offers arrive after consent"
                        body="Verify the trade, then open it to lenders. You can compare on this screen."
                      />
                    )}
                    {active && (
                      <Link href={`/app/trades/${active.id}?tab=offers`}>
                        <Button className="w-full" size="compact" variant="secondary">
                          Open full comparison
                        </Button>
                      </Link>
                    )}
                  </div>
                )}

                {tab === 'track' && (
                  <div className="space-y-3">
                    <div className="font-display text-[20px] font-semibold">Shipment</div>
                    <div className="rounded-card border border-line bg-surface p-3">
                      <div className="flex items-center gap-2">
                        <Ship size={17} className="text-brand" />
                        <div>
                          <div className="text-[12px] font-medium">MV Coromandel</div>
                          <div className="text-[10px] text-ink-3">Tuticorin → Felixstowe</div>
                        </div>
                      </div>
                      <div className="mt-3 space-y-0">
                        {[
                          { label: 'Loaded', sub: 'Container stuffed', icon: Package },
                          { label: 'Sailed', sub: 'Departed Tuticorin', icon: Ship },
                          { label: 'Arrived', sub: 'Felixstowe', icon: MapPin },
                          { label: 'Delivered', sub: 'Goods received', icon: Truck },
                        ].map((m, i) => {
                          const current = evidence?.shipmentStage ?? 0;
                          const done = i < current;
                          return (
                            <div key={m.label} className="relative flex gap-2.5 pb-4 last:pb-0">
                              {i < 3 && (
                                <span
                                  className={cn(
                                    'absolute left-[8px] top-5 h-full w-px',
                                    done ? 'bg-brand' : 'bg-line',
                                  )}
                                />
                              )}
                              <span
                                className={cn(
                                  'relative z-10 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border',
                                  done
                                    ? 'border-brand bg-brand text-white'
                                    : 'border-line bg-surface text-ink-3',
                                )}
                              >
                                <m.icon size={9} />
                              </span>
                              <div>
                                <div className={cn('text-[11px]', done ? 'text-ink' : 'text-ink-3')}>{m.label}</div>
                                <div className="text-[10px] text-ink-3">{m.sub}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="rounded-card border border-line bg-surface p-3">
                      <div className="caption mb-1">Buyer confirmation</div>
                      <StatusChip
                        size="sm"
                        status={evidence?.buyerConfirmed ? 'pass' : 'pending'}
                        label={evidence?.buyerConfirmed ? 'Confirmed' : 'Waiting for buyer'}
                      />
                      <p className="mt-2 text-[10px] leading-4 text-ink-3">
                        Staged: use the demo controls to advance the shipment and the buyer link. Check 7 follows the
                        carrier; it never rounds up.
                      </p>
                    </div>
                    <div className="rounded-card border border-line bg-canvas p-3 text-[10px] leading-4 text-ink-3">
                      <Clock3 size={12} className="mr-1 inline" /> Carrier data is simulated. No polling of a live
                      carrier in this demo.
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-line bg-surface px-3 pb-5 pt-2">
                <div className="flex items-center justify-around">
                  {TABS.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={cn(
                          'flex flex-col items-center gap-0.5 rounded-lg px-4 py-1 text-[10px]',
                          tab === t.key ? 'text-brand' : 'text-ink-3',
                        )}
                      >
                        <Icon size={18} strokeWidth={tab === t.key ? 2.2 : 1.7} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* annotation column */}
        <aside className="space-y-4">
          <div className="card p-6">
            <div className="caption mb-2">What this frame shows</div>
            <div className="h3">One state, two screens</div>
            <p className="mt-1 text-[12px] leading-5 text-ink-2">
              The phone is a narrow view of the same exporter workspace. It uses the same API and the same persisted
              store. There is no separate mobile client to drift out of date.
            </p>
            <ul className="mt-3 space-y-2 text-[12px] leading-5 text-ink-2">
              <li className="flex gap-2">
                <BadgeCheck size={15} className="mt-0.5 shrink-0 text-brand" /> Verified evidence and the offer
                comparison are read from the same engine.
              </li>
              <li className="flex gap-2">
                <Clock3 size={15} className="mt-0.5 shrink-0 text-brand" /> Pending offers and shipment stages
                materialise by due time, not by a background worker.
              </li>
              <li className="flex gap-2">
                <Banknote size={15} className="mt-0.5 shrink-0 text-brand" /> Money is shown in both currencies at the
                fixed demo FX of ₹85.00 / USD.
              </li>
            </ul>
          </div>

          <div className="card p-6">
            <div className="caption mb-2">Run of show</div>
            <ol className="space-y-2 text-[12px] leading-5 text-ink-2">
              <li>1. On desktop, open Scenario B and upload the five documents.</li>
              <li>2. Run verification; inspect the check-8 failure and its evidence.</li>
              <li>3. Upload the amended invoice; the board updates here too.</li>
              <li>4. Open to lenders; watch sealed offers arrive in this Offers tab.</li>
              <li>5. Accept and sign; tracking and the Passport follow.</li>
            </ol>
            {active && (
              <Link href={`/app/trades/${active.id}`} className="mt-4 block">
                <Button className="w-full" size="compact" variant="secondary">
                  Open the desktop trade
                </Button>
              </Link>
            )}
          </div>

          <div className="card p-6">
            <div className="caption mb-2">Explicitly staged</div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-ink-2">
              {['Carrier milestones', 'Buyer confirmation', 'SMS preview', 'Lender response timers'].map((x) => (
                <div key={x} className="rounded-lg border border-line bg-canvas px-2 py-1.5">
                  {x}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-4 text-ink-3">
              These are labelled simulated in the interface. The checks that run on your documents are real.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-3">{label}</div>
      <div className="mt-0.5 truncate text-[12px] font-medium text-ink">{value}</div>
    </div>
  );
}

function milestone(status: string): number {
  if (['REPAID', 'CLOSED'].includes(status)) return 5;
  if (['DELIVERED', 'BUYER_ACCEPTED'].includes(status)) return 4;
  if (['SHIPMENT_IN_TRANSIT'].includes(status)) return 3;
  if (['FINANCED', 'CONTRACT_SIGNED'].includes(status)) return 2;
  if (['VERIFIED', 'OFFERS_OPEN', 'OFFER_ACCEPTED'].includes(status)) return 1;
  return 0;
}

function invoiceNo(evidence: EvidenceResponse | null): string {
  const doc = evidence?.docs
    .filter((d) => d.type === 'invoice')
    .sort((a, b) => b.version - a.version)[0];
  return String(doc?.extracted.fields.invoiceNo?.value ?? '—');
}
