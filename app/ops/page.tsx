'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  Gavel,
  Link2,
  Radio,
  RefreshCw,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, toast, useApi } from '@/lib/client';
import { Button } from '@/components/Button';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { Modal } from '@/components/Overlays';
import { dateTime, timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { AuditEvent, OpsCase } from '@/lib/types';

interface OpsRes {
  queue: OpsCase[];
  audit: AuditEvent[];
  health: { name: string; status: string; fallback: boolean }[];
}

const TABS = [
  ['queue', 'Review queue'],
  ['audit', 'Audit log'],
  ['health', 'Source health'],
] as const;

export default function OpsPage() {
  const router = useRouter();
  const search = useSearchParams();
  const tab = ((search.get('tab') as (typeof TABS)[number][0]) ?? 'queue') as (typeof TABS)[number][0];
  const { data, refresh } = useApi<OpsRes>('/ops/queue', { interval: 3000 });
  const [active, setActive] = useState<OpsCase | null>(null);
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState<'Confirm duplicate' | 'Clear'>('Confirm duplicate');
  const [saving, setSaving] = useState(false);

  const queue = data?.queue ?? [];
  const audit = data?.audit ?? [];
  const open = queue.filter((c) => c.status === 'open');
  const closed = queue.filter((c) => c.status === 'closed');

  const decisions = useMemo(() => audit.filter((e) => e.action === 'ops.decision').length, [audit]);

  function setTab(next: (typeof TABS)[number][0]) {
    router.replace(next === 'queue' ? '/ops' : `/ops?tab=${next}`);
  }

  function decide(c: OpsCase, choice: 'Confirm duplicate' | 'Clear') {
    setActive(c);
    setDecision(choice);
    setNote('');
  }

  async function submitDecision() {
    if (!active) return;
    if (!note.trim()) {
      toast('A note is required', 'Record why this decision was made; the exporter sees it.', 'danger');
      return;
    }
    setSaving(true);
    try {
      await api(`/ops/queue/${active.id}/decision`, {
        method: 'POST',
        json: { decision, note: note.trim() },
      });
      toast('Decision recorded', `${decision} · the case is closed and audited.`, 'success');
      setActive(null);
      refresh();
    } catch (e) {
      toast('Could not record the decision', (e as Error).message, 'danger');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="caption mb-1">Cashew operations</div>
          <h1 className="h1">Review</h1>
          <p className="mt-1 max-w-xl text-[13px] leading-5 text-ink-2">
            Human judgement where the rules say review, not pass. Every decision is an audit event and every source is
            explicitly staged.
          </p>
        </div>
        <Button variant="secondary" onClick={refresh} icon={<RefreshCw size={15} />}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Open cases" value={String(open.length)} icon={<ClipboardList size={16} />} tone={open.length ? 'warn' : 'neutral'} hint="Possible duplicates and manual reviews" />
        <Summary label="Closed cases" value={String(closed.length)} icon={<ShieldCheck size={16} />} hint="Decisions recorded with a note" />
        <Summary label="Audit events" value={String(audit.length)} icon={<FileText size={16} />} hint="Every state change and decision" />
        <Summary label="Ops decisions" value={String(decisions)} icon={<Gavel size={16} />} hint="Newest first in the audit log" />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'relative whitespace-nowrap px-3 py-2.5 text-[13px] transition-colors',
              tab === key ? 'font-medium text-brand' : 'text-ink-2 hover:text-ink',
            )}
          >
            {label}
            {key === 'queue' && open.length > 0 && (
              <span className="ml-1.5 rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] text-warn">{open.length}</span>
            )}
            {tab === key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-brand" />}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <div className="space-y-4">
          {open.length === 0 ? (
            <div className="card">
              <EmptyState
                title="Queue is clear"
                body="Duplicate attempts and manual-review checks land here. Load a duplicate scenario from the demo controls to see one arrive."
              />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {open.map((c) => (
                <section key={c.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-warn-soft text-warn">
                        <AlertTriangle size={16} />
                      </span>
                      <div>
                        <div className="text-[13px] font-semibold text-ink">{c.reason}</div>
                        <div className="text-[11px] text-ink-3">Case {c.id}</div>
                      </div>
                    </div>
                    <StatusChip status="pending" label="Open" size="sm" />
                  </div>
                  <p className="mt-3 text-[12px] leading-5 text-ink-2">{c.detail}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg border border-line bg-canvas px-2.5 py-2">
                      <div className="text-ink-3">Trade</div>
                      <Link href={`/app/trades/${c.tradeId}`} className="mono text-brand hover:underline">
                        {c.tradeId}
                      </Link>
                    </div>
                    <div className="rounded-lg border border-line bg-canvas px-2.5 py-2">
                      <div className="text-ink-3">Exporter</div>
                      <div className="text-ink">{c.orgId}</div>
                    </div>
                    <div className="rounded-lg border border-line bg-canvas px-2.5 py-2">
                      <div className="text-ink-3">Age</div>
                      <div className="text-ink">{c.ageHours < 1 ? 'Less than an hour' : `${Math.round(c.ageHours)} hours`}</div>
                    </div>
                    <div className="rounded-lg border border-line bg-canvas px-2.5 py-2">
                      <div className="text-ink-3">Reviewer</div>
                      <div className="text-ink">{c.reviewer}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="compact" onClick={() => decide(c, 'Confirm duplicate')}>
                      Confirm duplicate
                    </Button>
                    <Button size="compact" variant="secondary" onClick={() => decide(c, 'Clear')}>
                      Clear
                    </Button>
                  </div>
                </section>
              ))}
            </div>
          )}

          {closed.length > 0 && (
            <section className="card overflow-hidden">
              <div className="border-b border-line px-6 py-4">
                <div className="h3">Recently closed</div>
                <div className="text-[12px] text-ink-3">The decision is part of the permanent record.</div>
              </div>
              <div className="divide-y divide-line">
                {closed.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-[12px]">
                    <CheckCircle2 size={15} className="text-success" />
                    <span className="font-medium text-ink">{c.reason}</span>
                    <span className="mono text-[11px] text-ink-3">{c.tradeId}</span>
                    <StatusChip status="success" label={c.decision ?? 'Closed'} size="sm" />
                    <span className="ml-auto text-[11px] text-ink-3">{c.reviewer}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-4">
            <div>
              <div className="h3">Audit log</div>
              <div className="text-[12px] text-ink-3">
                Append-only in behaviour: actions are added, never rewritten. Newest first.
              </div>
            </div>
            <StatusChip status="info" label={`${audit.length} events`} size="sm" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="text-left text-[10px] uppercase tracking-wide text-ink-3">
                <tr className="border-b border-line">
                  <th className="px-6 py-2.5 font-medium">Action</th>
                  <th className="px-3 py-2.5 font-medium">Actor</th>
                  <th className="px-3 py-2.5 font-medium">Object</th>
                  <th className="px-3 py-2.5 font-medium">Trade</th>
                  <th className="px-6 py-2.5 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((e) => (
                  <tr key={e.id} className="border-b border-line/70 last:border-b-0">
                    <td className="px-6 py-2.5">
                      <span className="mono rounded bg-canvas px-1.5 py-0.5 text-[11px] text-ink-2">{e.action}</span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">{e.actor}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-ink-3">{e.object}</td>
                    <td className="px-3 py-2.5">
                      {e.tradeId ? (
                        <Link href={`/app/trades/${e.tradeId}`} className="text-brand hover:underline">
                          {e.tradeId}
                        </Link>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    <td className="px-6 py-2.5 text-[11px] text-ink-3" title={dateTime(e.timestamp)}>
                      {timeAgo(e.timestamp)}
                    </td>
                  </tr>
                ))}
                {!audit.length && (
                  <tr>
                    <td className="px-6 py-8 text-center text-[12px] text-ink-3" colSpan={5}>
                      No audit events yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'health' && (
        <div className="space-y-4">
          <div className="rounded-card border border-line bg-[#fffaf0] px-4 py-3 text-[12px] leading-5 text-ink-2">
            <Radio size={14} className="mr-1.5 inline text-accent" />
            Every external source below is a <strong>staged adapter</strong>. No live API is called. Each check returns
            a source mode and an evidence reference, and an unavailable source degrades to manual review — it never
            silently passes.
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(data?.health ?? []).map((h) => (
              <div key={h.name} className="card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-soft text-success">
                      <Wifi size={15} />
                    </span>
                    <div className="text-[13px] font-semibold text-ink">{h.name}</div>
                  </div>
                  <StatusChip status="success" label="Healthy" size="sm" />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-ink-3">
                  <span>{h.status}</span>
                  <span className="rounded-full bg-canvas px-2 py-0.5">Manual fallback</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full w-[94%] rounded-full bg-success/70" />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-3">
                  <span>Last response 0s ago</span>
                  <span>Simulated</span>
                </div>
              </div>
            ))}
          </div>
          <div className="card p-5">
            <div className="mb-2 flex items-center gap-2">
              <Link2 size={15} className="text-brand" />
              <span className="text-[13px] font-semibold text-ink">Degradation policy</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 text-[12px] leading-5 text-ink-2">
              <div className="rounded-lg border border-line bg-canvas px-3 py-2">
                <div className="font-medium text-ink">Live source answers</div>
                Result is recorded with its source and evidence.
              </div>
              <div className="rounded-lg border border-line bg-canvas px-3 py-2">
                <div className="font-medium text-ink">Source unavailable</div>
                Result is Unknown, never Pass. The lender sees the gap.
              </div>
              <div className="rounded-lg border border-line bg-canvas px-3 py-2">
                <div className="font-medium text-ink">Manual fallback</div>
                Ops can attach a document; the check stays flagged until resolved.
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title="Record a decision"
        subtitle={active ? `${active.reason} · ${active.tradeId}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setActive(null)}>
              Cancel
            </Button>
            <Button onClick={submitDecision} loading={saving} variant={decision === 'Confirm duplicate' ? 'danger' : 'primary'}>
              Record decision
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] leading-5 text-ink-2">
            {active?.detail}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDecision('Confirm duplicate')}
              className={cn(
                'rounded-card border px-3 py-3 text-left text-[12px]',
                decision === 'Confirm duplicate'
                  ? 'border-danger bg-danger-soft text-danger'
                  : 'border-line bg-surface text-ink-2',
              )}
            >
              <div className="font-semibold">Confirm duplicate</div>
              <div className="mt-0.5 text-[11px] opacity-80">Keep the block and record check 12 against the trade.</div>
            </button>
            <button
              type="button"
              onClick={() => setDecision('Clear')}
              className={cn(
                'rounded-card border px-3 py-3 text-left text-[12px]',
                decision === 'Clear' ? 'border-success bg-success-soft text-success' : 'border-line bg-surface text-ink-2',
              )}
            >
              <div className="font-semibold">Clear</div>
              <div className="mt-0.5 text-[11px] opacity-80">Release the case; the evidence remains unchanged.</div>
            </button>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-2">
              Decision note <span className="text-danger">*</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="What did you check, and why is this the right call?"
              className="w-full rounded-input border border-line bg-surface px-3 py-2 text-[12px] leading-5"
            />
            <p className="mt-1 text-[11px] text-ink-3">
              The note is stored with the decision and appears in the audit log. No automated pass is possible here.
            </p>
          </div>
        </div>
      </Modal>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 py-4">
        <div className="flex items-center gap-2 text-[12px] text-ink-2">
          <Clock3 size={15} className="text-ink-3" /> Review SLA: 24 hours. Duplicate blocks stay in place until a
          decision is recorded.
        </div>
        <Link href="/registry" className="text-[12px] font-medium text-brand hover:underline">
          Open registry →
        </Link>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  icon,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
  tone?: 'warn' | 'neutral';
}) {
  return (
    <div className="card p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="caption">{label}</span>
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-full', tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-brand-soft text-brand')}>
          {icon}
        </span>
      </div>
      <div className="h2 tabular">{value}</div>
      {hint && <div className="mt-1 text-[11px] leading-4 text-ink-3">{hint}</div>}
    </div>
  );
}
