'use client';

import { FileText, UploadCloud, Check, AlertTriangle } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export type DocSlotState = 'empty' | 'hover' | 'scanning' | 'extracted' | 'review';

export function DocSlot({
  label,
  state,
  fields,
  lowConfidence,
  onFile,
  onClick,
  filename,
  compact,
}: {
  label: string;
  state: DocSlotState;
  fields?: number;
  lowConfidence?: number;
  onFile?: (file: File) => void;
  onClick?: () => void;
  filename?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const shown = dragging ? 'hover' : state;

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    onFile?.(files[0]);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (onFile) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => (state === 'empty' || state === 'review' ? inputRef.current?.click() : onClick?.())}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          (state === 'empty' || state === 'review' ? inputRef.current?.click() : onClick?.());
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        'relative flex cursor-pointer flex-col rounded-xl border-2 border-dashed bg-surface p-3 text-left transition-colors',
        compact ? 'min-h-[92px]' : 'min-h-[120px]',
        shown === 'empty' && 'border-line hover:border-ink-3',
        shown === 'hover' && 'border-brand bg-brand-soft/30',
        shown === 'scanning' && 'border-brand/45',
        shown === 'extracted' && 'border-success/35 bg-success-soft/25',
        shown === 'review' && 'border-warn/50 bg-warn-soft/25',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={!onFile}
      />
      <div className="flex w-full items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              shown === 'extracted'
                ? 'bg-success-soft text-success'
                : shown === 'review'
                  ? 'bg-warn-soft text-warn'
                  : 'bg-canvas text-ink-2',
            )}
          >
            {shown === 'extracted' ? (
              <Check size={16} />
            ) : shown === 'review' ? (
              <AlertTriangle size={16} />
            ) : shown === 'scanning' ? (
              <FileText size={16} className="animate-pulse" />
            ) : (
              <UploadCloud size={16} />
            )}
          </span>
          <div>
            <div className="text-[13px] font-semibold text-ink">{label}</div>
            <div className="max-w-[170px] truncate text-[11px] leading-4 text-ink-3">
              {filename ?? (shown === 'scanning' ? 'Scanning document…' : 'PDF or image')}
            </div>
          </div>
        </div>
        {shown === 'extracted' && <span className="text-[11px] font-medium text-success">Ready</span>}
        {shown === 'review' && <span className="text-[11px] font-medium text-warn">Review</span>}
      </div>

      {(shown === 'extracted' || shown === 'review' || shown === 'scanning') && (
        <div className="relative mt-3 flex gap-2 overflow-hidden rounded-md border border-line/70 bg-canvas p-2">
          <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded border border-line bg-white">
            <div className="mx-1.5 mt-2 h-1 w-6 rounded bg-line" />
            <div className="mx-1.5 mt-1 h-1 w-7 rounded bg-line" />
            <div className="mx-1.5 mt-1 h-1 w-5 rounded bg-line" />
            <div className="mx-1.5 mt-2 h-1 w-7 rounded bg-line" />
            <div className="mx-1.5 mt-1 h-1 w-6 rounded bg-line" />
            {shown === 'scanning' && (
              <span className="scanline absolute left-0 h-[2px] w-full animate-scan bg-brand/70 shadow-[0_0_6px_rgba(31,77,58,.5)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {shown === 'scanning' ? (
              <div className="space-y-1.5 pt-1">
                <div className="h-1.5 w-4/5 animate-pulse rounded bg-line" />
                <div className="h-1.5 w-3/5 animate-pulse rounded bg-line" />
                <div className="h-1.5 w-2/3 animate-pulse rounded bg-line" />
                <div className="mt-2 h-1.5 w-1/2 animate-pulse rounded bg-line" />
              </div>
            ) : (
              <>
                <div className="text-[11px] font-medium text-ink">
                  {fields ?? 0} fields extracted
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {['No.', 'Date', 'Amount'].map((f) => (
                    <span key={f} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
                      {f}
                    </span>
                  ))}
                </div>
                {shown === 'review' && (
                  <div className="mt-1 text-[11px] leading-4 text-warn">
                    {lowConfidence ?? 1} field needs review
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
