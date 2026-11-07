'use client';

import { AlertTriangle, ArrowUpRight, FileUp, Flag, Info, Loader2, Play, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CheckResult, Doc, RiskProfile, Trade, VerificationCheck } from '@/lib/types';
import { Button } from './Button';
import { CheckRow } from './CheckRow';
import { EvidenceDrawer } from './EvidenceDrawer';
import { StatusChip, BandChip } from './StatusChip';
import { cn } from '@/lib/cn';
import { pct } from '@/lib/format';

export interface CheckMeta {
  id: number;
  title: string;
  source: string;
  mode: 'staged' | 'real';
  durationMs: number;
  manualFallback: boolean;
}

export interface EvidenceResponse {
  trade: Trade;
  docs: Doc[];
  checks: VerificationCheck[];
  run: { startedAt: string; pendingCheckIds: number[]; total: number } | null;
  results: Record<number, CheckResult>;
  risk: RiskProfile;
  bundle: { bundleHash: string };
  crossdoc: { pass: boolean; notes: { message: string }[]; findings: { message: string; severity: string }[] };
  flagged: number[];
  checkMeta: CheckMeta[];
  consents?: import('@/lib/types').ConsentArtefact[];
  registryEntry?: import('@/lib/types').RegistryEntry | null;
  shipmentStage?: number;
  buyerConfirmed?: boolean;
}

export function VerificationBoard({
  evidence,
  onRun,
  running,
  onAmended,
  onFlag,
  canAct = true,
  compact,
}: {
  evidence: EvidenceResponse | null;
  onRun: () => void;
  running?: boolean;
  onAmended?: () => void;
  onFlag?: () => void;
  canAct?: boolean;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<VerificationCheck | null>(null);
  const checks = evidence?.checks ?? [];
  const meta = evidence?.checkMeta ?? DEFAULT_META;
  const latest = useMemo(() => {
    const m = new Map<number, VerificationCheck>();
    for (const c of checks) m.set(c.checkId, c);
    return m;
  }, [checks]);
  const pendingIds = evidence?.run?.pendingCheckIds ?? [];
  const runningId = pendingIds.length ? Math.min(...pendingIds) : null;

  const counts = { pass: 0, fail: 0, unknown: 0, pending: 0, warn: 0 };
  meta.forEach((m) => {
    const c = latest.get(m.id);
    if (!c) counts.pending += 1;
    else counts[c.result as keyof typeof counts] += 1;
  });
  const check8 = latest.get(8);
  const flagged = evidence?.flagged ?? [];
  const check8Failed = check8?.result === 'fail';
  const check8Flagged = flagged.includes(8);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-success">
            {counts.pass} passed
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-unknown-soft px-2 py-1 text-unknown">
            {counts.unknown} unknown
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-1 text-danger">
            {counts.fail} failed
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-1 text-warn">
            {counts.warn} review
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2 py-1 text-ink-2">
            {counts.pending} pending
          </span>
        </div>
        {canAct && (
          <Button onClick={onRun} loading={running} icon={running ? undefined : <Play size={15} />} size="compact">
            {running ? 'Running checks…' : checks.length ? 'Re-run verification' : 'Run verification'}
          </Button>
        )}
      </div>

      {evidence && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-canvas/60 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[12px] text-ink-2">
            <ShieldCheck size={14} className="text-brand" /> Evidence strength
          </div>
          <span className="tabular text-[13px] font-semibold text-ink">{pct(evidence.risk.strength, 1)}</span>
          <BandChip band={evidence.risk.band} />
          {evidence.risk.blocking.length > 0 && (
            <StatusChip status="danger" label={`Blocking issue: check ${evidence.risk.blocking.join(', ')}`} size="sm" />
          )}
          <span className="ml-auto text-[11px] text-ink-3">
            Rules {evidence.risk.ruleVersion} · evidence bundle, not a score
          </span>
        </div>
      )}

      {check8Failed && !check8Flagged && (
        <div className="rounded-card border border-warn/30 bg-warn-soft/70 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-ink">A document needs correcting</div>
              <p className="mt-0.5 text-[12px] leading-5 text-ink-2">{check8?.line}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {onAmended && (
                  <Button size="compact" variant="secondary" onClick={onAmended} icon={<FileUp size={15} />}>
                    Upload corrected document
                  </Button>
                )}
                {onFlag && (
                  <Button size="compact" variant="ghost" onClick={onFlag} icon={<Flag size={15} />}>
                    Continue and flag to lenders
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {check8Flagged && (
        <div className="flex items-start gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] text-ink-2">
          <Flag size={14} className="mt-0.5 text-warn" /> Check 8 is flagged to lenders. They will see the failure
          honestly.
        </div>
      )}

      {check8?.result === 'pass' && Boolean(evidence?.crossdoc.notes.length) && (
        <div className="flex items-start gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] leading-5 text-ink-2">
          <Info size={14} className="mt-0.5 shrink-0 text-unknown" />
          {evidence?.crossdoc.notes.map((n) => n.message).join(' ')}
        </div>
      )}

      <div className={cn('card px-4 py-1', compact && 'shadow-none')}>
        {meta.map((m) => {
          const c = latest.get(m.id);
          const isRunning = runningId === m.id;
          return (
            <CheckRow
              key={m.id}
              id={m.id}
              title={m.title}
              source={m.mode === 'real' ? m.source : m.source}
              simulated={m.mode !== 'real'}
              result={c?.result ?? 'pending'}
              line={c?.line}
              durationMs={c?.durationMs}
              running={isRunning}
              onClick={c ? () => setSelected(c) : undefined}
            />
          );
        })}
      </div>

      {evidence?.run && (
        <div className="flex items-center gap-2 text-[11px] text-ink-3">
          <Loader2 size={12} className="animate-spin" /> Checks run in sequence, about 12 seconds at 1× speed.
        </div>
      )}

      <EvidenceDrawer
        check={selected}
        title={selected ? meta.find((m) => m.id === selected.checkId)?.title ?? 'Evidence' : 'Evidence'}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

export const DEFAULT_META: CheckMeta[] = [
  { id: 1, title: 'Entity is registered and active', source: 'MCA', mode: 'staged', durationMs: 600, manualFallback: true },
  { id: 2, title: 'Importer-Exporter Code is active', source: 'IEC', mode: 'staged', durationMs: 500, manualFallback: true },
  { id: 3, title: 'Promoter identity matches', source: 'PAN', mode: 'staged', durationMs: 450, manualFallback: true },
  { id: 4, title: 'GST registration and filing history', source: 'GST', mode: 'staged', durationMs: 700, manualFallback: true },
  { id: 5, title: 'e-Invoice is valid and signed', source: 'e-Invoice', mode: 'staged', durationMs: 800, manualFallback: true },
  { id: 6, title: 'Export documents are lodged', source: 'Customs', mode: 'staged', durationMs: 550, manualFallback: true },
  { id: 7, title: 'Shipment is confirmed by the carrier', source: 'Carrier', mode: 'staged', durationMs: 650, manualFallback: true },
  { id: 8, title: 'Documents agree with each other', source: 'Computed', mode: 'real', durationMs: 1800, manualFallback: false },
  { id: 9, title: 'Buyer is registered and rated', source: 'Buyer registry', mode: 'staged', durationMs: 850, manualFallback: true },
  { id: 10, title: 'No sanctions or adverse media', source: 'Screening', mode: 'staged', durationMs: 700, manualFallback: true },
  { id: 11, title: 'No related-party overlap', source: 'Related party', mode: 'staged', durationMs: 600, manualFallback: false },
  { id: 12, title: 'Invoice is not already financed', source: 'Registry', mode: 'real', durationMs: 900, manualFallback: false },
  { id: 13, title: 'Bank account name matches', source: 'Penny-drop', mode: 'staged', durationMs: 700, manualFallback: true },
  { id: 14, title: 'Buyer confirms the trade', source: 'Buyer link', mode: 'staged', durationMs: 1000, manualFallback: true },
];
