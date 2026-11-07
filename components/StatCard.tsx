'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export function CountUp({
  value,
  format,
  duration = 600,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(0);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const from = prev.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString('en-IN'));
  return <span className={cn('tabular', className)}>{fmt(display)}</span>;
}

export function StatCard({
  label,
  value,
  format,
  delta,
  deltaTone = 'neutral',
  icon,
  hint,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  delta?: string;
  deltaTone?: 'success' | 'warn' | 'danger' | 'neutral';
  icon?: React.ReactNode;
  hint?: string;
}) {
  const deltaColor =
    deltaTone === 'success'
      ? 'text-success'
      : deltaTone === 'warn'
        ? 'text-warn'
        : deltaTone === 'danger'
          ? 'text-danger'
          : 'text-ink-3';
  return (
    <div className="card p-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="caption">{label}</span>
        {icon && <span className="text-ink-3">{icon}</span>}
      </div>
      <div className="h2 tabular">
        <CountUp value={value} format={format} />
      </div>
      {delta && <div className={cn('mt-1 text-[12px] leading-4', deltaColor)}>{delta}</div>}
      {hint && <div className="mt-1 text-[12px] leading-4 text-ink-3">{hint}</div>}
    </div>
  );
}
