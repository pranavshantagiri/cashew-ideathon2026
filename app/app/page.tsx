'use client';

import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Clock3,
  FilePlus2,
  Sparkles,
} from 'lucide-react';
import { useApi } from '@/lib/client';
import { inr, pct, timeAgo, STATUS_LABELS, usd } from '@/lib/format';
import { StatCard } from '@/components/StatCard';
import { StatusChip } from '@/components/StatusChip';
import { BandChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import type { Trade, TradeHistory } from '@/lib/types';
import { HashPill } from '@/components/HashPill';
import { Button } from '@/components/Button';

interface TradeRow extends Trade {
  buyerName: string;
  exporterName: string;
  strength: number;
  band: string;
  offerCount: number;
  lastUpdated: string;
}
interface TradesRes {
  trades: TradeRow[];
}
interface SessionRes {
  orgId: string;
  org: { tier?: number; legalName: string } | null;
  scenario: string;
}
interface PassportRes {
  passport: { claims: { tier: number; completedTrades: number; totalFinancedInr: number; repaidOnTime: number } };
  history: TradeHistory[];
}

export default function DashboardPage() {
  const { data: session } = useApi<SessionRes>('/orgs/me', { interval: 5000 });
  const { data, loading } = useApi<TradesRes>('/trades', { interval: 2500 });
  const { data: passport } = useApi<PassportRes>(
    session?.orgId ? `/passport/${session.orgId}` : null,
    { interval: 8000 },
  );
  const trades = data?.trades ?? [];
  const active = trades.filter((t) => !['REPAID', 'CLOSED', 'WITHDRAWN'].includes(t.status));
  const currentFinanced = trades
    .filter((t) => ['FINANCED', 'SHIPMENT_IN_TRANSIT', 'DELIVERED', 'BUYER_ACCEPTED'].includes(t.status))
    .reduce((s, t) => s + t.value, 0);
  const totalFinanced = (passport?.passport.claims.totalFinancedInr ?? 0) + currentFinanced;
  const tier = passport?.passport.claims.tier ?? session?.org?.tier ?? 2;
  const offerTrades = trades.filter((t) => t.offerCount > 0);
  const avgFirstOffer = offerTrades.length ? 8 : 0;
  const next = pickNext(trades);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="caption mb-1">Exporter workspace</div>
          <h1 className="h1">Dashboard</h1>
          <p className="mt-1 text-[13px] text-ink-2">
            Verified evidence, sealed offers and the state of every trade in one place.
          </p>
        </div>
        <Link href="/app/trades/new">
          <Button icon={<FilePlus2 size={16} />}>New trade</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active trades"
          value={active.length}
          icon={<Sparkles size={17} />}
          hint={active.length === 1 ? 'One trade in progress' : `${active.length} trades in progress`}
        />
        <StatCard
          label="Total financed"
          value={totalFinanced}
          format={(n) => inr(Math.round(n))}
          icon={<Banknote size={17} />}
          delta="Across current and completed trades"
          deltaTone="neutral"
        />
        <StatCard
          label="Average time to first offer"
          value={avgFirstOffer}
          format={(n) => (n ? `${Math.round(n)}s` : '—')}
          icon={<Clock3 size={17} />}
          hint="From consent to first sealed offer"
        />
        <StatCard
          label="Passport tier"
          value={tier}
          format={(n) => `Tier ${Math.round(n)}`}
          icon={<BadgeCheck size={17} />}
          delta={tier >= 3 ? 'Technical Master' : 'Technical Master, E4'}
          deltaTone="success"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <div>
              <div className="h3">Trades</div>
              <div className="text-[12px] text-ink-3">Every value shows both currencies at the fixed demo rate.</div>
            </div>
            <Link href="/app/trades" className="text-[12px] font-medium text-brand hover:underline">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2 p-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="shimmer-wrap h-10 rounded-lg bg-canvas" />
              ))}
            </div>
          ) : trades.length === 0 ? (
            <EmptyState
              title="No trades yet. Start with your first invoice."
              body="Upload five documents and Cashew runs fourteen checks before any lender sees the trade."
              action="Start a trade"
              href="/app/trades/new"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-3">
                    <th className="px-6 py-3 font-medium">Trade</th>
                    <th className="px-3 py-3 font-medium">Buyer</th>
                    <th className="px-3 py-3 font-medium">Value</th>
                    <th className="px-3 py-3 font-medium">Evidence</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Updated</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id} className="group border-b border-line/70 last:border-b-0 hover:bg-canvas/60">
                      <td className="px-6 py-3">
                        <Link href={`/app/trades/${t.id}`} className="mono inline-flex items-center rounded-full border border-line bg-canvas px-2 py-1 text-ink-2">
                          {t.id}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-ink">{t.buyerName}</div>
                        <div className="text-[11px] text-ink-3">{t.corridor}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="tabular text-ink">{usd(t.value / t.fx)}</div>
                        <div className="tabular text-[11px] text-ink-3">{inr(t.value)} @ {t.fx.toFixed(2)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <BandChip band={t.band} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusChip status={statusChip(t.status)} label={STATUS_LABELS[t.status] ?? t.status} />
                      </td>
                      <td className="px-3 py-3 text-[12px] text-ink-3">{timeAgo(t.lastUpdated)}</td>
                      <td className="px-6 py-3 text-right">
                        <Link href={`/app/trades/${t.id}`} aria-label={`Open ${t.id}`}>
                          <ArrowUpRight size={16} className="text-ink-3 transition-colors group-hover:text-brand" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="card p-6">
            <div className="caption mb-2">Next step</div>
            <div className="h3">{next.title}</div>
            <p className="mt-1 text-[12px] leading-5 text-ink-2">{next.body}</p>
            <Link href={next.href} className="mt-4 block">
              <Button className="w-full" icon={<ArrowRight size={16} />}>
                {next.cta}
              </Button>
            </Link>
          </div>
          <div className="card p-6">
            <div className="caption mb-2">This month</div>
            <div className="flex items-baseline gap-2">
              <span className="h2 tabular">{passport?.passport.claims.completedTrades ?? 3}</span>
              <span className="text-[12px] text-ink-3">completed trades</span>
            </div>
            <div className="mt-1 text-[12px] text-ink-2">
              {pct(
                ((passport?.passport.claims.repaidOnTime ?? 3) /
                  Math.max(1, passport?.passport.claims.completedTrades ?? 3)) *
                  100,
                0,
              )}{' '}
              repaid on time
            </div>
            <div className="mt-4 border-t border-line pt-3 text-[12px] leading-5 text-ink-3">
              The Passport is a signed credential. Open it after repayment to verify it in the browser.
            </div>
            <Link href="/app/passport" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-brand">
              Open Passport <ArrowRight size={14} />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function statusChip(status: string): string {
  if (['NEEDS_INFO', 'REJECTED_VERIFICATION', 'DEFAULTED', 'DISPUTED'].includes(status)) return 'warn';
  if (['VERIFIED', 'FINANCED', 'REPAID', 'CLOSED', 'BUYER_ACCEPTED', 'DELIVERED'].includes(status)) return 'success';
  if (['OFFERS_OPEN', 'OFFER_ACCEPTED', 'CONTRACT_SIGNED', 'SHIPMENT_IN_TRANSIT'].includes(status)) return 'brand';
  return 'neutral';
}

function pickNext(trades: TradeRow[]) {
  if (!trades.length)
    return {
      title: 'Start with your first invoice',
      body: 'Five documents, fourteen checks, one evidence bundle. Scenario B is the five-minute story.',
      cta: 'Start a trade',
      href: '/app/trades/new',
    };
  const latest = [...trades].reverse()[0];
  if (latest.status === 'NEEDS_INFO')
    return {
      title: 'Resolve the document mismatch',
      body: 'A check needs attention. Upload the corrected document or flag it explicitly to lenders.',
      cta: 'Open verification',
      href: `/app/trades/${latest.id}?tab=verification`,
    };
  if (latest.status === 'VERIFIED')
    return {
      title: 'Open this trade to lenders',
      body: 'The evidence bundle is ready. Share it for 30 days and three lenders can respond.',
      cta: 'Review and share',
      href: `/app/trades/${latest.id}?tab=overview`,
    };
  if (latest.status === 'OFFERS_OPEN' || latest.status === 'OFFER_ACCEPTED')
    return {
      title: 'Compare the sealed offers',
      body: 'Ranked by effective annualised cost, not by headline rate.',
      cta: 'Compare offers',
      href: `/app/trades/${latest.id}?tab=offers`,
    };
  if (latest.status === 'CONTRACT_SIGNED')
    return {
      title: 'Waiting for disbursal',
      body: 'The contract is signed. The staged disbursal lands in a moment.',
      cta: 'View financing',
      href: `/app/trades/${latest.id}?tab=financing`,
    };
  if (['FINANCED', 'SHIPMENT_IN_TRANSIT', 'DELIVERED', 'BUYER_ACCEPTED'].includes(latest.status))
    return {
      title: 'Track the shipment',
      body: 'Advance the shipment from the demo panel; check 7 flips from Unknown to Pass once sailed.',
      cta: 'Open tracking',
      href: `/app/trades/${latest.id}?tab=tracking`,
    };
  return {
    title: 'Review the trade',
    body: 'Continue from where this trade stopped.',
    cta: 'Open trade',
    href: `/app/trades/${latest.id}`,
  };
}
