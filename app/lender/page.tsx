'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Clock3,
  FileSearch,
  Inbox,
  Lock,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';
import { useApi } from '@/lib/client';
import { StatusChip, BandChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { inr, pct, timeAgo, usd, STATUS_LABELS } from '@/lib/format';
import type { Trade } from '@/lib/types';

interface InboxRow {
  trade: Trade;
  exporter: string;
  buyer: string;
  strength: number;
  band: string;
  offerStatus: string;
  requestedAt: string | null;
}

export default function LenderInboxPage() {
  const { data, error, loading } = useApi<{ inbox: InboxRow[] }>('/lender/inbox', { interval: 2500 });
  const rows = useMemo(() => data?.inbox ?? [], [data]);
  const open = rows.filter((r) => r.offerStatus !== 'Offer sent' && r.offerStatus !== 'Accepted');
  const sent = rows.filter((r) => r.offerStatus === 'Offer sent' || r.offerStatus === 'Accepted');
  const total = rows.reduce((s, r) => s + r.trade.value, 0);

  if (error && (error.code === 'FORBIDDEN' || error.status === 403)) {
    return (
      <div className="card">
        <EmptyState
          title="Lender access only"
          body="Switch the role selector to Lender to open the sealed-offer inbox."
          action="Go to exporter"
          href="/app"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="caption mb-1">Lender portal</div>
          <h1 className="h1">Inbox</h1>
          <p className="mt-1 max-w-xl text-[13px] leading-5 text-ink-2">
            Trades an exporter has explicitly shared with this lender. Every row is the same evidence bundle, verified
            before it arrived.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] text-ink-2">
          <Lock size={13} className="text-brand" /> Sealed offers · consent-scoped
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Consented trades" value={String(rows.length)} icon={<Inbox size={16} />} />
        <Summary label="Awaiting your offer" value={String(open.length)} icon={<Clock3 size={16} />} />
        <Summary label="Offers you submitted" value={String(sent.length)} icon={<FileSearch size={16} />} />
        <Summary label="Shared ticket volume" value={inr(total)} icon={<Users size={16} />} />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-4">
          <div>
            <div className="h3">Shared with you</div>
            <div className="text-[12px] text-ink-3">
              You cannot see offers from other lenders, and they cannot see yours.
            </div>
          </div>
          <StatusChip status="info" label="Consent required · expires in 30 days" size="sm" />
        </div>

        {loading ? (
          <div className="space-y-2 p-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="shimmer-wrap h-12 rounded-lg bg-canvas" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No trades have been shared with this lender"
            body="On the exporter side, verify a trade and choose “Open to lenders”. Consent is per trade, explicit and expiring."
            action="Open exporter workspace"
            href="/app"
          />
        ) : (
          <div className="divide-y divide-line">
            {rows.map((r) => (
              <Link
                key={r.trade.id}
                href={`/lender/trades/${r.trade.id}`}
                className="group flex flex-wrap items-center gap-4 px-6 py-4 transition-colors hover:bg-canvas/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mono rounded-full border border-line bg-canvas px-2 py-0.5 text-ink-2">
                      {r.trade.id}
                    </span>
                    <BandChip band={r.band} />
                    {r.offerStatus === 'Awaiting' && (
                      <StatusChip status="pending" label="Your response is due" size="sm" />
                    )}
                    {r.offerStatus === 'Offer sent' && (
                      <StatusChip status="success" label="Offer sent" size="sm" />
                    )}
                    {r.offerStatus === 'Accepted' && (
                      <StatusChip status="brand" label="Offer accepted" size="sm" />
                    )}
                    {r.offerStatus === 'Declined' && (
                      <StatusChip status="neutral" label="Not selected" size="sm" />
                    )}
                  </div>
                  <div className="mt-1 text-[14px] font-semibold text-ink">{r.exporter}</div>
                  <div className="text-[12px] text-ink-3">
                    {r.buyer} · {r.trade.corridor} · {r.trade.incoterm} · {r.trade.paymentTermsDays} days
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular text-[14px] font-medium text-ink">{inr(r.trade.value)}</div>
                  <div className="tabular text-[11px] text-ink-3">
                    {usd(r.trade.value / r.trade.fx)} @ {r.trade.fx.toFixed(2)}
                  </div>
                </div>
                <div className="w-[120px]">
                  <div className="flex items-baseline justify-between text-[11px] text-ink-3">
                    <span>Strength</span>
                    <span className="tabular text-ink">{pct(r.strength, 1)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.max(0, Math.min(100, r.strength))}%` }}
                    />
                  </div>
                </div>
                <div className="hidden w-[90px] text-right text-[11px] text-ink-3 sm:block">
                  {STATUS_LABELS[r.trade.status] ?? r.trade.status}
                  <div className="text-[10px]">{timeAgo(r.trade.createdAt)}</div>
                </div>
                <ArrowRight size={16} className="text-ink-3 transition-colors group-hover:text-brand" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Info
          icon={<ShieldCheck size={17} />}
          title="Verification already ran"
          body="You receive the 14 check results, the evidence references and the flagged unknowns. You never receive another lender's bid."
        />
        <Info
          icon={<Lock size={17} />}
          title="One sealed offer"
          body="Submit once per trade. The exporter compares offers on effective cost; you can update products, not an already-submitted offer."
        />
        <Info
          icon={<Users size={17} />}
          title="Consent is the gate"
          body="Every row above exists because the exporter granted a scoped consent. Revoking it removes your access immediately."
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 py-4">
        <div className="text-[12px] leading-5 text-ink-2">
          Tune your product once, then respond to shared trades. Changes apply to new offers only.
        </div>
        <Link href="/lender/products">
          <Button size="compact" variant="secondary">
            Lender products
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Summary({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="card flex items-center justify-between p-5">
      <div>
        <div className="caption">{label}</div>
        <div className="h2 tabular">{value}</div>
      </div>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand">{icon}</span>
    </div>
  );
}

function Info({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card p-5">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-canvas text-brand">{icon}</div>
      <div className="text-[13px] font-semibold text-ink">{title}</div>
      <p className="mt-1 text-[12px] leading-5 text-ink-2">{body}</p>
    </div>
  );
}
