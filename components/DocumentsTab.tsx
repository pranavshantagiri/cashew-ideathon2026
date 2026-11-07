'use client';

import { useState } from 'react';
import type { Doc, DocType } from '@/lib/types';
import { DocSlot } from './DocSlot';
import { Drawer } from './Overlays';
import { StatusChip } from './StatusChip';
import { DOC_LABELS } from '@/lib/format';
import { HashPill } from './HashPill';

const ORDER: DocType[] = ['po', 'invoice', 'packing', 'shippingBill', 'bl'];

export function DocumentsTab({ docs }: { docs: Doc[] }) {
  const [selected, setSelected] = useState<Doc | null>(null);
  const latest = ORDER.map((t) => docs.filter((d) => d.type === t).sort((a, b) => b.version - a.version)[0]).filter(
    Boolean,
  ) as Doc[];
  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="h3">Documents</div>
            <div className="text-[12px] text-ink-3">
              Extraction is staged; the cross-document comparison is computed from these fields.
            </div>
          </div>
          <span className="text-[12px] text-ink-3">{latest.length} documents</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ORDER.map((type) => {
            const d = latest.find((x) => x.type === type);
            if (!d) {
              return <DocSlot key={type} label={DOC_LABELS[type]} state="empty" />;
            }
            const low = Object.values(d.extracted.fields).filter((f) => f.confidence < 0.85).length;
            return (
              <DocSlot
                key={type}
                label={`${DOC_LABELS[type]}${d.version > 1 ? ` · v${d.version}` : ''}`}
                state={low ? 'review' : 'extracted'}
                fields={Object.keys(d.extracted.fields).length}
                lowConfidence={low}
                filename={d.filename}
                onClick={() => setSelected(d)}
                compact
              />
            );
          })}
        </div>
        <p className="mt-4 text-[12px] leading-5 text-ink-2">
          Click a document to see the extracted fields. Confidence below 0.85 is highlighted for review.
        </p>
      </div>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? DOC_LABELS[selected.type] : 'Document'}
        subtitle={selected?.filename}
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={selected.verifiedStatus === 'pass' ? 'pass' : 'info'} label={selected.verifiedStatus} />
              <span className="text-[11px] text-ink-3">Version {selected.version}</span>
              <HashPill hash={selected.sha256} label="SHA-256" />
            </div>
            <div className="flex gap-3">
              <div className="h-40 w-28 shrink-0 rounded-md border border-line bg-white p-2">
                <div className="mx-auto mb-2 h-1.5 w-12 rounded bg-line" />
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className={`mb-1.5 h-1 rounded bg-line ${i % 3 === 0 ? 'w-16' : 'w-20'}`} />
                ))}
                <div className="mt-3 h-1 rounded bg-brand/30" />
              </div>
              <div className="min-w-0 flex-1">
                <table className="w-full text-[12px]">
                  <tbody>
                    {Object.entries(selected.extracted.fields).map(([key, f]) => (
                      <tr key={key} className="border-b border-line/70 last:border-b-0">
                        <td className="py-1.5 pr-2 text-ink-3">{key.replace(/([A-Z])/g, ' $1')}</td>
                        <td className="py-1.5 text-right">
                          <span className="text-ink">{String(f.value)}</span>
                          <span
                            className={`ml-2 rounded px-1 text-[10px] ${
                              f.confidence < 0.85 ? 'bg-warn-soft text-warn' : 'bg-success-soft text-success'
                            }`}
                          >
                            {f.confidence.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {Object.values(selected.extracted.fields).some((f) => f.confidence < 0.85) && (
              <p className="rounded-lg border border-warn/20 bg-warn-soft/50 px-3 py-2 text-[12px] text-warn">
                One or more fields are below 0.85 confidence and need review.
              </p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
