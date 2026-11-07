'use client';

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleDot,
  Clock3,
  HelpCircle,
  Info,
  Loader2,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { CheckResult } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/format';

export type ChipStatus =
  | CheckResult
  | 'running'
  | 'info'
  | 'success'
  | 'danger'
  | 'warn'
  | 'neutral'
  | 'brand'
  | string;

const styles: Record<string, string> = {
  pass: 'bg-success-soft text-success',
  fail: 'bg-danger-soft text-danger',
  unknown: 'bg-unknown-soft text-unknown',
  pending: 'bg-warn-soft text-warn',
  warn: 'bg-warn-soft text-warn',
  running: 'bg-brand-soft text-brand',
  info: 'bg-unknown-soft text-unknown',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-canvas text-ink-2 border border-line',
  brand: 'bg-brand-soft text-brand',
};

const icons: Record<string, LucideIcon> = {
  pass: Check,
  fail: X,
  unknown: HelpCircle,
  pending: Clock3,
  warn: AlertTriangle,
  running: Loader2,
  info: Info,
  success: CheckCircle2,
  danger: XCircle,
  neutral: CircleDot,
  brand: CircleDot,
};

const labels: Record<string, string> = {
  pass: 'Pass',
  fail: 'Fail',
  unknown: 'Unknown',
  pending: 'Pending',
  warn: 'Review',
  running: 'Running',
  info: 'Info',
  success: 'Done',
  danger: 'Failed',
  neutral: 'Info',
  brand: 'Active',
};

export function StatusChip({
  status,
  label,
  className,
  size = 'default',
}: {
  status: ChipStatus;
  label?: string;
  className?: string;
  size?: 'default' | 'sm';
}) {
  const key = String(status);
  const Icon = icons[key] ?? CircleDot;
  const text = label ?? labels[key] ?? STATUS_LABELS[key] ?? String(status).replace(/_/g, ' ').toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px] leading-4' : 'px-2.5 py-1 text-[12px] leading-4',
        styles[key] ?? 'bg-canvas text-ink-2 border border-line',
        className,
      )}
    >
      <Icon size={size === 'sm' ? 12 : 14} className={key === 'running' ? 'animate-spin' : undefined} aria-hidden />
      {text}
    </span>
  );
}

export function SourceChip({ source, simulated = true }: { source: string; simulated?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2 py-0.5 text-[11px] leading-4 text-ink-2">
      {source}
      {simulated && <span className="text-ink-3">· simulated</span>}
    </span>
  );
}

export function BandChip({ band }: { band: string }) {
  const status = band === 'Strong' ? 'success' : band === 'Moderate' ? 'warn' : 'danger';
  return <StatusChip status={status} label={`${band} evidence`} />;
}
