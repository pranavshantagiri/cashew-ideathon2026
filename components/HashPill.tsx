'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/client';

export function shortHash(hash: string, head = 8, tail = 4): string {
  if (!hash) return '—';
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function HashPill({
  hash,
  label,
  full,
  className,
}: {
  hash: string;
  label?: string;
  full?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = full ? hash : shortHash(hash);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(hash);
        } catch {
          /* clipboard can be blocked; the toast still confirms intent */
        }
        setCopied(true);
        toast('Copied', label ?? shortHash(hash), 'success');
        setTimeout(() => setCopied(false), 1400);
      }}
      title={hash}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-canvas px-2 py-1 font-mono text-[12px] leading-4 text-ink-2 transition-colors hover:border-ink-3',
        className,
      )}
    >
      {label && <span className="font-sans text-[11px] text-ink-3">{label}</span>}
      <span className="truncate">{text}</span>
      {copied ? <Check size={12} className="shrink-0 text-success" /> : <Copy size={12} className="shrink-0 text-ink-3" />}
    </button>
  );
}
