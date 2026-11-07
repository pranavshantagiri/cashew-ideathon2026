'use client';

import {
  Anchor,
  ArrowDown,
  CheckCircle2,
  Database,
  Fingerprint,
  Link2,
  Lock,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { api, toast, useApi } from '@/lib/client';
import { Button } from '@/components/Button';
import { StatusChip } from '@/components/StatusChip';
import { HashPill } from '@/components/HashPill';
import { dateTime, timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Entry {
  position: number;
  fingerprint: string;
  status: string;
  lender: string;
  timestamp: string;
  entryHash: string;
  previousHash: string;
}
interface RegistryRes {
  entries: Entry[];
  stats: {
    count: number;
    chainLength: number;
    head: string;
    lastAnchored: string | null;
    anchorHead: string | null;
    intact: boolean;
  };
}
interface VerifyRes {
  verification: {
    intact: boolean;
    entriesVerified: number;
    brokenAt?: number;
    reason?: string;
    head?: string;
  };
}

export default function RegistryPage() {
  const { data, refresh, loading } = useApi<RegistryRes>('/registry/entries', { interval: 5000 });
  const [verifying, setVerifying] = useState(false);
  const [anchoring, setAnchoring] = useState(false);
  const [verified, setVerified] = useState<VerifyRes['verification'] | null>(null);

  const entries = data?.entries ?? [];
  const stats = data?.stats;
  const state = verified ?? (stats ? { intact: stats.intact, entriesVerified: stats.chainLength, head: stats.head } : null);
  const latest = [...entries].sort((a, b) => a.position - b.position).slice(-7);
  const anchored = stats?.lastAnchored
    ? stats.anchorHead === stats.head
      ? 'Head is anchored'
      : 'New entries since anchor'
    : 'Not anchored yet';

  async function verify() {
    setVerifying(true);
    try {
      const res = await api<VerifyRes>('/registry/verify-chain', { method: 'POST', json: {} });
      setVerified(res.verification);
      toast(
        res.verification.intact ? 'Chain verified' : 'Chain is broken',
        res.verification.intact
          ? `${res.verification.entriesVerified} entries verified end to end.`
          : res.verification.reason,
        res.verification.intact ? 'success' : 'danger',
      );
      refresh();
    } catch (e) {
      toast('Verification failed', (e as Error).message, 'danger');
    } finally {
      setVerifying(false);
    }
  }

  async function anchor() {
    setAnchoring(true);
    try {
      await api('/registry/anchor', { method: 'POST', json: {} });
      toast('Chain head published (simulated)', 'An external anchor receipt would be stored here.', 'success');
      refresh();
    } catch (e) {
      toast('Anchoring failed', (e as Error).message, 'danger');
    } finally {
      setAnchoring(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="caption mb-1">Shared infrastructure</div>
          <h1 className="h1">Duplicate-financing registry</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-ink-2">
            One record per financed invoice, stored as a salted fingerprint, a status and a timestamp. No invoice,
            document, buyer or lender identity is exposed by the lookup.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={verify} loading={verifying} icon={<RefreshCw size={15} />}>
            Verify chain
          </Button>
          <Button onClick={anchor} loading={anchoring} icon={<Anchor size={15} />}>
            Anchor head
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Registry entries" value={String(stats?.count ?? '—')} icon={<Database size={16} />} hint="Each entry is one financed invoice" />
        <Stat
          label="Chain integrity"
          value={state ? (state.intact ? 'Intact' : 'Broken') : '—'}
          icon={state?.intact ? <ShieldCheck size={16} /> : <XCircle size={16} />}
          hint={state ? `${state.entriesVerified} entries verified` : 'Checking…'}
          tone={state?.intact ? 'success' : 'danger'}
        />
        <Stat
          label="Chain head"
          value={stats?.head ? short(stats.head) : '—'}
          icon={<Link2 size={16} />}
          hint="SHA-256 over the previous head and this entry"
          mono
        />
        <Stat
          label="External anchor"
          value={anchored}
          icon={<Anchor size={16} />}
          hint={stats?.lastAnchored ? `Last anchored ${timeAgo(stats.lastAnchored)}` : 'Publish the head to an anchor'}
          tone={anchored === 'Head is anchored' ? 'success' : 'neutral'}
        />
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center gap-3 rounded-card border px-4 py-3 text-[12px]',
          state?.intact ? 'border-success/20 bg-success-soft text-success' : 'border-danger/20 bg-danger-soft text-danger',
        )}
      >
        {state?.intact ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
        <span className="font-medium">
          {state?.intact ? 'Every entry’s hash and signature verifies.' : `Chain breaks at entry ${state?.brokenAt ?? '?'}.`}
        </span>
        <span className={cn('text-[11px]', state?.intact ? 'text-[#2f6b52]' : 'text-[#8c2e25]')}>
          {state?.intact
            ? 'Each entry includes the previous hash, so altering any historical entry breaks every later one.'
            : state?.reason}
        </span>
        {state?.head && <span className="ml-auto font-mono text-[10px] opacity-70">head {short(state.head)}</span>}
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-4">
          <div>
            <div className="h3">The chain</div>
            <div className="text-[12px] text-ink-3">Newest seven entries. Lender identities are masked; lookup never returns them.</div>
          </div>
          <span className="text-[11px] text-ink-3">
            {loading ? 'Refreshing…' : `${stats?.chainLength ?? 0} entries total`}
          </span>
        </div>
        <div className="thin-scroll overflow-x-auto px-6 py-5">
          <div className="flex min-w-max items-stretch gap-0">
            {latest.map((entry, i) => (
              <div key={entry.position} className="flex items-stretch">
                {i > 0 && (
                  <div className="flex w-8 items-center justify-center text-line">
                    <ArrowDown size={16} className="-rotate-90" />
                  </div>
                )}
                <div className="w-[188px] rounded-card border border-line bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-ink-3">#{entry.position}</span>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide',
                        entry.status === 'FINANCED'
                          ? 'bg-brand-soft text-brand'
                          : entry.status === 'RELEASED'
                            ? 'bg-warn-soft text-warn'
                            : 'bg-canvas text-ink-3',
                      )}
                    >
                      {entry.status}
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-[10px] leading-4 text-ink-2">{short(entry.fingerprint, 12)}</div>
                  <div className="mt-1 text-[10px] text-ink-3">{entry.lender}</div>
                  <div className="mt-2 border-t border-line pt-2 font-mono text-[9px] text-ink-3">
                    hash {short(entry.entryHash, 8)}
                  </div>
                  <div className="truncate font-mono text-[9px] text-ink-3">prev {short(entry.previousHash, 8)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card overflow-hidden">
          <div className="border-b border-line px-6 py-4">
            <div className="h3">Entries</div>
            <div className="text-[12px] text-ink-3">What a participant can see. Nothing about who financed what.</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="text-left text-[10px] uppercase tracking-wide text-ink-3">
                <tr className="border-b border-line">
                  <th className="px-6 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">Fingerprint</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Lender</th>
                  <th className="px-3 py-2.5 font-medium">Recorded</th>
                  <th className="px-6 py-2.5 font-medium">Entry hash</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.position} className="border-b border-line/70 last:border-b-0">
                    <td className="px-6 py-2.5 font-mono text-ink-2">{e.position}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-ink-2">{short(e.fingerprint, 16)}</td>
                    <td className="px-3 py-2.5">
                      <StatusChip
                        status={e.status === 'FINANCED' ? 'brand' : e.status === 'RELEASED' ? 'warn' : 'neutral'}
                        label={e.status.toLowerCase()}
                        size="sm"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-ink-3">{e.lender}</td>
                    <td className="px-3 py-2.5 text-[11px] text-ink-3">{dateTime(e.timestamp)}</td>
                    <td className="px-6 py-2.5 font-mono text-[10px] text-ink-3">{short(e.entryHash, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="caption mb-2">What is stored</div>
            <div className="space-y-2 text-[12px] leading-5 text-ink-2">
              <div className="flex items-start gap-2">
                <Fingerprint size={14} className="mt-0.5 shrink-0 text-brand" />
                A salted SHA-256 fingerprint of supplier, buyer, invoice number, date, amount and currency.
              </div>
              <div className="flex items-start gap-2">
                <Lock size={14} className="mt-0.5 shrink-0 text-brand" />
                Status, timestamp, a masked lender reference and the hash-chain link. No documents.
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand" />
                An Ed25519 signature per entry, so a forged insert fails verification.
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-line bg-[#fcfaf5] p-2 font-mono text-[9px] leading-4 text-ink-2">
              fp = SHA-256(SALT | supplierId | buyerId | invoiceNo | invoiceDate | amount | currency)
              <br />
              entryHash = SHA-256(prevHash + canonicalJSON(core))
            </div>
          </div>

          <div className="card p-5">
            <div className="caption mb-2">Lookup behaviour</div>
            <ul className="space-y-1.5 text-[12px] leading-5 text-ink-2">
              <li>• Exact fingerprint on a financed invoice is blocked.</li>
              <li>• Same supplier and buyer, similar invoice, Amount or date → review.</li>
              <li>• Similarity at or above 0.80 opens an Ops case.</li>
              <li>• The response never reveals the financing lender.</li>
              <li>• A released entry is treated as free.</li>
            </ul>
          </div>

          <div className="card p-5">
            <div className="caption mb-2">Anchor</div>
            <p className="text-[12px] leading-5 text-ink-2">
              Anchoring publishes the current chain head outside Cashew so later rewriting is detectable. In this
              demo the external anchor is <strong>simulated</strong>; the receipt and hash are real.
            </p>
            <div className="mt-2 space-y-1.5">
              <HashPill hash={stats?.anchorHead ?? ''} label="Anchored head" />
              <div className="text-[11px] text-ink-3">
                {stats?.lastAnchored ? dateTime(stats.lastAnchored) : 'No anchor yet'}
              </div>
            </div>
            <Button className="mt-3 w-full" size="compact" variant="secondary" onClick={anchor} loading={anchoring} icon={<Anchor size={14} />}>
              Publish chain head (simulated)
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  hint,
  tone = 'neutral',
  mono,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
  tone?: 'success' | 'danger' | 'neutral';
  mono?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="caption">{label}</span>
        <span className={cn('text-ink-3', tone === 'success' && 'text-success', tone === 'danger' && 'text-danger')}>
          {icon}
        </span>
      </div>
      <div
        className={cn(
          'h2 truncate',
          mono && 'font-mono !text-[16px] !leading-6',
          tone === 'success' && 'text-success',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] leading-4 text-ink-3">{hint}</div>}
    </div>
  );
}

function short(value?: string, n = 10): string {
  if (!value) return '—';
  if (value.length <= n + 3) return value;
  return `${value.slice(0, n)}…`;
}
