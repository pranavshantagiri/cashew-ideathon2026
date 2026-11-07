'use client';

import { AlertTriangle, ArrowDown, ArrowUp, BadgeCheck, ChevronDown, Clock3, Info, Sparkles, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Offer, Trade } from '@/lib/types';
import { Button } from './Button';
import { StatusChip } from './StatusChip';
import { inr, pct, dateOnly } from '@/lib/format';
import { cn } from '@/lib/cn';

export interface OfferWithMath extends Offer {
  math: {
    invoiceValue: number;
    advance: number;
    interest: number;
    fees: number;
    totalCost: number;
    effectiveAPR: number;
    netCash: number;
    feeLines: { label: string; amount: number; statedIn: string }[];
    hiddenFees: { label: string; amount: number }[];
    tenureDays: number;
  };
  lenderName: string;
}

const LENDER_NAMES: Record<string, string> = {
  lender_banyan: 'Banyan Capital',
  lender_tidewater: 'Tidewater Finance',
  lender_meridian: 'Meridian Bank',
};

const WAIT_ORDER: Record<string, number> = {
  lender_tidewater: 0,
  lender_banyan: 1,
  lender_meridian: 2,
};

type SortMode = 'cost' | 'fastest' | 'cash';

export function OfferComparison({
  trade,
  offers,
  pending,
  excluded,
  onAccept,
  onOpen,
  canOpen,
  opening,
}: {
  trade: Trade;
  offers: OfferWithMath[];
  pending: string[];
  excluded: { lenderId: string; reasons: string[] }[];
  onAccept: (offer: OfferWithMath) => void;
  onOpen?: () => void;
  canOpen?: boolean;
  opening?: boolean;
}) {
  const [sort, setSort] = useState<SortMode>('cost');
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const list = [...offers];
    list.sort((a, b) => {
      if (sort === 'fastest') return a.disbursalHours - b.disbursalHours;
      if (sort === 'cash') return b.math.netCash - a.math.netCash;
      return a.math.effectiveAPR - b.math.effectiveAPR;
    });
    return list;
  }, [offers, sort]);

  if (offers.length === 0 && pending.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Sparkles size={18} />
        </div>
        <div className="h3">Sealed offers appear here</div>
        <p className="mx-auto mt-1 max-w-md text-[12px] leading-5 text-ink-2">
          The verified trade has not been opened to lenders yet. Each lender sees the same evidence bundle and submits
          one sealed offer.
        </p>
        {canOpen && onOpen && (
          <Button className="mt-4" onClick={onOpen} loading={opening}>
            Open to lenders
          </Button>
        )}
        {excluded.length > 0 && (
          <p className="mt-4 text-[11px] text-ink-3">
            Excluded by product rules: {excluded.map((e) => LENDER_NAMES[e.lenderId] ?? e.lenderId).join(', ')}.
          </p>
        )}
      </div>
    );
  }

  const lowest = offers.length ? Math.min(...offers.map((o) => o.math.effectiveAPR)) : 0;
  const fastest = offers.length ? Math.min(...offers.map((o) => o.disbursalHours)) : 0;
  const mostCash = offers.length ? Math.max(...offers.map((o) => o.math.netCash)) : 0;

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[...pending].sort((a, b) => (WAIT_ORDER[a] ?? 9) - (WAIT_ORDER[b] ?? 9)).map((lenderId) => (
            <div key={lenderId} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-medium">{LENDER_NAMES[lenderId] ?? lenderId}</div>
                <StatusChip status="running" label="Waiting" size="sm" />
              </div>
              <div className="shimmer-wrap mt-3 h-2 w-3/4 rounded bg-canvas" />
              <div className="shimmer-wrap mt-2 h-2 w-1/2 rounded bg-canvas" />
              <div className="mt-3 text-[11px] text-ink-3">Waiting for {LENDER_NAMES[lenderId] ?? lenderId}…</div>
            </div>
          ))}
        </div>
      )}

      {offers.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
              {(
                [
                  ['cost', 'Lowest cost'],
                  ['fastest', 'Fastest'],
                  ['cash', 'Most cash'],
                ] as [SortMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSort(mode)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-[12px] transition-colors',
                    sort === mode ? 'bg-brand text-white' : 'text-ink-2 hover:bg-canvas',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-ink-3">Offers never change after submission. Sealed until you choose.</div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid gap-3" style={{ gridTemplateColumns: `160px repeat(${sorted.length}, minmax(190px, 1fr))` }}>
                <div />
                {sorted.map((o) => {
                  const hidden = o.math.hiddenFees.reduce((s, f) => s + f.amount, 0);
                  const badges: { label: string; tone: string }[] = [];
                  if (o.math.effectiveAPR === lowest) badges.push({ label: 'Lowest cost', tone: 'bg-success-soft text-success' });
                  if (o.disbursalHours === fastest) badges.push({ label: 'Fastest', tone: 'bg-brand-soft text-brand' });
                  if (o.math.netCash === mostCash) badges.push({ label: 'Most cash upfront', tone: 'bg-accent-soft text-accent' });
                  return (
                    <div key={o.id} className="card overflow-hidden">
                      <div className="border-b border-line px-4 py-3">
                        <div className="text-[14px] font-semibold">{o.lenderName}</div>
                        <div className="text-[11px] text-ink-3">{o.productType ?? 'Export invoice discounting'}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {badges.map((b) => (
                            <span key={b.label} className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', b.tone)}>
                              {b.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="px-4 py-3 text-center">
                        <div className="caption">Effective annualised cost</div>
                        <div
                          className={cn(
                            'font-display text-[30px] font-semibold leading-tight tabular',
                            o.math.effectiveAPR === lowest ? 'text-success' : 'text-ink',
                          )}
                        >
                          {pct(o.math.effectiveAPR)}
                        </div>
                        <div className="text-[11px] text-ink-3">Headline {o.ratePct.toFixed(2)}% p.a.</div>
                      </div>
                      <div className="border-t border-line px-4 py-2.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] text-ink-3">Advance</span>
                          <span className="tabular text-[12px] font-medium">{inr(o.math.advance)}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] text-ink-3">Net cash to you</span>
                          <span className="tabular text-[12px] font-medium">{inr(o.math.netCash)}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] text-ink-3">Total fees</span>
                          <span className="tabular text-[12px]">{inr(o.math.fees)}</span>
                        </div>
                        {hidden > 0 && (
                          <div className="mt-1.5">
                            <StatusChip
                              status="warn"
                              size="sm"
                              label={`Hidden fee found · +${inr(hidden)}`}
                            />
                          </div>
                        )}
                      </div>
                      <div className="px-4 pb-3">
                        <Button size="compact" className="w-full" onClick={() => onAccept(o)}>
                          Accept this offer
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* comparison rows */}
              <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: `160px repeat(${sorted.length}, minmax(190px, 1fr))` }}>
                <RowGroup label="Terms" />
                {sorted.map((o) => (
                  <Cell key={o.id + '-adv'} label="Advance %" value={`${o.advancePct}%`} />
                ))}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: `160px repeat(${sorted.length}, minmax(190px, 1fr))` }}>
                <RowLabel label="Advance amount" />
                {sorted.map((o) => (
                  <Cell key={o.id + '-advamt'} label="" value={inr(o.math.advance)} />
                ))}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: `160px repeat(${sorted.length}, minmax(190px, 1fr))` }}>
                <RowLabel label="Headline rate" />
                {sorted.map((o) => (
                  <Cell key={o.id + '-rate'} label="" value={`${o.ratePct.toFixed(2)}% p.a.`} />
                ))}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: `160px repeat(${sorted.length}, minmax(190px, 1fr))` }}>
                <RowLabel label="Interest over 90 days" />
                {sorted.map((o) => (
                  <Cell key={o.id + '-int'} label="" value={inr(o.math.interest)} />
                ))}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: `160px repeat(${sorted.length}, minmax(190px, 1fr))` }}>
                <RowLabel label="Total fees" />
                {sorted.map((o) => (
                  <Cell
                    key={o.id + '-fees'}
                    label=""
                    value={inr(o.math.fees)}
                    chip={
                      o.math.hiddenFees.length ? (
                        <span
                          className="rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] text-warn"
                          title={`Stated in the conditions, not in the headline fees. +${inr(
                            o.math.hiddenFees.reduce((s, f) => s + f.amount, 0),
                          )}`}
                        >
                          Hidden fee found
                        </span>
                      ) : undefined
                    }
                  />
                ))}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: `160px repeat(${sorted.length}, minmax(190px, 1fr))` }}>
                <RowLabel label="Total cost" />
                {sorted.map((o) => (
                  <Cell key={o.id + '-total'} label="" value={inr(o.math.totalCost)} strong />
                ))}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: `160px repeat(${sorted.length}, minmax(190px, 1fr))` }}>
                <RowLabel label="Net cash to you" />
                {sorted.map((o) => (
                  <Cell key={o.id + '-net'} label="" value={inr(o.math.netCash)} />
                ))}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: `160px repeat(${sorted.length}, minmax(190px, 1fr))` }}>
                <RowLabel label="Disbursal" />
                {sorted.map((o) => (
                  <Cell key={o.id + '-disb'} label="" value={`${o.disbursalHours} h`} />
                ))}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: `160px repeat(${sorted.length}, minmax(190px, 1fr))` }}>
                <RowLabel label="Recourse · collateral" />
                {sorted.map((o) => (
                  <Cell key={o.id + '-rec'} label="" value={`${o.recourse ? 'Recourse' : 'Non-recourse'} · ${o.collateral}`} />
                ))}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: `160px repeat(${sorted.length}, minmax(190px, 1fr))` }}>
                <RowLabel label="Conditions" />
                {sorted.map((o) => (
                  <div key={o.id + '-cond'} className="rounded-lg border border-line bg-surface px-3 py-2 text-[11px] leading-4 text-ink-2">
                    {o.conditions || 'Standard terms.'}
                    {o.math.hiddenFees.map((f) => (
                      <div key={f.label} className="mt-1 flex items-start gap-1 text-warn">
                        <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {f.label} · +{inr(f.amount)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: `160px repeat(${sorted.length}, minmax(190px, 1fr))` }}>
                <RowLabel label="Valid until" />
                {sorted.map((o) => (
                  <Cell key={o.id + '-valid'} label="" value={dateOnly(o.validUntil)} />
                ))}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: `160px repeat(${sorted.length}, minmax(190px, 1fr))` }}>
                <RowLabel label="" />
                {sorted.map((o) => (
                  <div key={o.id + '-calc'} className="px-1">
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-brand"
                    >
                      Show the calculation
                      <ChevronDown size={12} className={cn('transition-transform', expanded === o.id && 'rotate-180')} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] text-ink-2">
            <Info size={13} className="mr-1 inline" />
            Offers are ranked by what they cost you, never by what lenders pay Cashew.
          </p>

          {expanded && (() => {
            const o = sorted.find((x) => x.id === expanded);
            if (!o) return null;
            return (
              <div className="card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="h3">{o.lenderName} · calculation</div>
                  <StatusChip status="info" label="Effective cost arithmetic" size="sm" />
                </div>
                <pre className="thin-scroll overflow-x-auto rounded-lg border border-line bg-[#fcfaf5] p-3 font-mono text-[11px] leading-5 text-ink-2">
{`invoice value V        = ${inr(o.math.invoiceValue)}
advance a              = V × ${o.advancePct}% = ${inr(o.math.advance)}
interest               = advance × ${o.ratePct}% × ${o.tenureDays}/365 = ${inr(o.math.interest)}
${o.math.feeLines.map((f) => `${f.label.padEnd(22)} = ${inr(f.amount)}${f.statedIn === 'conditions' ? '  (conditions)' : ''}`).join('\n')}
total fees             = ${inr(o.math.fees)}
total cost             = interest + fees = ${inr(o.math.totalCost)}
effective APR          = total cost ÷ advance × 365 ÷ ${o.tenureDays} = ${pct(o.math.effectiveAPR)}
net cash               = advance − fees = ${inr(o.math.netCash)}`}
                </pre>
                <p className="mt-2 text-[11px] text-ink-3">
                  Unrounded arithmetic internally; displayed with Indian grouping. Commission is not an input.
                </p>
              </div>
            );
          })()}
        </>
      )}

      {excluded.length > 0 && (
        <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-[11px] leading-4 text-ink-3">
          <span className="font-medium text-ink-2">Why some lenders did not receive this:</span>{' '}
          {excluded.map((e) => `${LENDER_NAMES[e.lenderId] ?? e.lenderId} — ${e.reasons.join(' ')}`).join(' · ')}
        </div>
      )}
    </div>
  );
}

function RowLabel({ label }: { label: string }) {
  return <div className="flex items-center py-1 text-[11px] font-medium text-ink-3">{label}</div>;
}
function Cell({
  label,
  value,
  strong,
  chip,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  chip?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-1.5">
      {label && <div className="text-[10px] uppercase tracking-wide text-ink-3">{label}</div>}
      <div className={cn('tabular text-[12px]', strong ? 'font-semibold text-ink' : 'text-ink-2')}>{value}</div>
      {chip && <div className="mt-0.5">{chip}</div>}
    </div>
  );
}
function Row({ label, value, header }: { label: string; value: string; header?: boolean }) {
  return (
    <div className={cn('py-1 text-[11px]', header ? 'text-ink-3' : 'text-ink-3')}>
      {label}
      {value}
    </div>
  );
}
function RowGroup({ label }: { label: string }) {
  return <div className="pt-2 text-[10px] font-semibold uppercase tracking-widest text-ink-3">{label}</div>;
}
