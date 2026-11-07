'use client';

import { AlertTriangle, Check, ChevronRight, HelpCircle, Loader2, Minus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { CheckResult } from '@/lib/types';
import { SourceChip } from './StatusChip';

export function CheckStatusIcon({ result, size = 24 }: { result: CheckResult | 'running' | 'idle'; size?: number }) {
  const cls = 'flex items-center justify-center rounded-full';
  if (result === 'pass')
    return (
      <span className={cn(cls, 'bg-success-soft text-success')} style={{ width: size, height: size }}>
        <Check size={size * 0.6} strokeWidth={2.5} />
      </span>
    );
  if (result === 'fail')
    return (
      <span className={cn(cls, 'bg-danger-soft text-danger')} style={{ width: size, height: size }}>
        <X size={size * 0.6} strokeWidth={2.5} />
      </span>
    );
  if (result === 'warn')
    return (
      <span className={cn(cls, 'bg-warn-soft text-warn')} style={{ width: size, height: size }}>
        <AlertTriangle size={size * 0.55} />
      </span>
    );
  if (result === 'unknown')
    return (
      <span className={cn(cls, 'bg-unknown-soft text-unknown')} style={{ width: size, height: size }}>
        <HelpCircle size={size * 0.6} />
      </span>
    );
  if (result === 'running')
    return (
      <span className={cn(cls, 'bg-brand-soft text-brand')} style={{ width: size, height: size }}>
        <Loader2 size={size * 0.6} className="animate-spin" />
      </span>
    );
  return (
    <span className={cn(cls, 'border border-line bg-canvas text-ink-3')} style={{ width: size, height: size }}>
      <Minus size={size * 0.5} />
    </span>
  );
}

export function CheckRow({
  id,
  title,
  source,
  result,
  line,
  durationMs,
  simulated = true,
  onClick,
  running,
}: {
  id: number;
  title: string;
  source: string;
  result: CheckResult | 'idle';
  line?: string;
  durationMs?: number;
  simulated?: boolean;
  onClick?: () => void;
  running?: boolean;
}) {
  const shown = running ? 'running' : result;
  const tone =
    shown === 'fail' ? 'text-danger' : shown === 'warn' ? 'text-warn' : shown === 'unknown' ? 'text-unknown' : 'text-ink-2';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group flex min-h-[56px] w-full items-center gap-3 rounded-lg border-b border-line px-1 py-2 text-left transition-colors last:border-b-0',
        onClick && 'hover:bg-canvas/70',
      )}
      aria-label={`Check ${id}: ${title}`}
    >
      <CheckStatusIcon result={shown} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-semibold text-ink">
            <span className="mr-1.5 font-mono text-[12px] font-normal text-ink-3">{String(id).padStart(2, '0')}</span>
            {title}
          </span>
          <SourceChip source={source} simulated={simulated && result !== 'idle'} />
        </div>
        {(line || running) && (
          <div className={cn('mt-0.5 truncate text-[13px] leading-5', tone)}>
            {running ? 'Running check…' : line}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-ink-3">
        {durationMs != null && !running && <span className="tabular text-[11px]">{Math.round(durationMs)} ms</span>}
        {onClick && <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />}
      </div>
    </button>
  );
}
