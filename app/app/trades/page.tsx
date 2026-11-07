'use client';

import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApi } from '@/lib/client';
import { Button } from '@/components/Button';
import { StatusChip, BandChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { inr, timeAgo, usd, STATUS_LABELS } from '@/lib/format';
import type { Trade } from '@/lib/types';

interface TradeRow extends Trade {
  buyerName: string;
  strength: number;
  band: string;
  offerCount: number;
  lastUpdated: string;
}

export default function TradesPage() {
  const { data, loading } = useApi<{ trades: TradeRow[] }>('/trades', { interval: 3000 });
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const trades = data?.trades ?? [];
  const filtered = useMemo(
    () =>
      trades.filter((t) => {
        const matchQ =
          !q ||
          t.id.toLowerCase().includes(q.toLowerCase()) ||
          t.buyerName.toLowerCase().includes(q.toLowerCase());
        const matchF =
          filter === 'all'
            ? true
            : filter === 'active'
              ? !['REPAID', 'CLOSED', 'WITHDRAWN'].includes(t.status)
              : ['REPAID', 'CLOSED'].includes(t.status);
        return matchQ && matchF;
      }),
    [trades, q, filter],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="caption mb-1">Exporter workspace</div>
          <h1 className="h1">Trades</h1>
          <p className="mt-1 text-[13px] text-ink-2">Every trade, its evidence and where it stopped.</p>
        </div>
        <Link href="/app/trades/new">
          <Button icon={<Plus size={16} />}>New trade</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-2.5 text-ink-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search trade or buyer"
            className="h-9 w-[240px] rounded-btn border border-line bg-surface pl-9 pr-3 text-[13px]"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
          {[
            ['all', 'All'],
            ['active', 'Active'],
            ['done', 'Completed'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-md px-3 py-1 text-[12px] ${
                filter === key ? 'bg-brand text-white' : 'text-ink-2 hover:bg-canvas'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="shimmer-wrap h-11 rounded-lg bg-canvas" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={trades.length ? 'No trades match that filter' : 'No trades yet'}
            body={trades.length ? 'Clear the search or switch filter.' : 'Start with one invoice. Scenario B is the five-minute story.'}
            action={trades.length ? undefined : 'Start a trade'}
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
                  <th className="px-3 py-3 font-medium">Offers</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-line/70 hover:bg-canvas/60 last:border-b-0">
                    <td className="px-6 py-3">
                      <Link href={`/app/trades/${t.id}`} className="mono rounded-full border border-line bg-canvas px-2 py-1 text-ink-2">
                        {t.id}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{t.buyerName}</div>
                      <div className="text-[11px] text-ink-3">{t.corridor}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="tabular">{usd(t.value / t.fx)}</div>
                      <div className="tabular text-[11px] text-ink-3">{inr(t.value)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <BandChip band={t.band} />
                    </td>
                    <td className="px-3 py-3 tabular text-ink-2">{t.offerCount}</td>
                    <td className="px-3 py-3">
                      <StatusChip status={chip(t.status)} label={STATUS_LABELS[t.status] ?? t.status} />
                    </td>
                    <td className="px-3 py-3 text-[12px] text-ink-3">{timeAgo(t.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function chip(status: string) {
  if (['NEEDS_INFO', 'REJECTED_VERIFICATION', 'DEFAULTED', 'DISPUTED'].includes(status)) return 'warn';
  if (['VERIFIED', 'FINANCED', 'REPAID', 'CLOSED', 'BUYER_ACCEPTED', 'DELIVERED'].includes(status)) return 'success';
  if (['OFFERS_OPEN', 'OFFER_ACCEPTED', 'CONTRACT_SIGNED', 'SHIPMENT_IN_TRANSIT'].includes(status)) return 'brand';
  return 'neutral';
}
