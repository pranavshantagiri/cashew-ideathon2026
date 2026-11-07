'use client';

import { StatusChip, SourceChip } from './StatusChip';
import { Drawer } from './Overlays';
import { HashPill } from './HashPill';
import { CheckStatusIcon } from './CheckRow';
import { dateTime } from '@/lib/format';
import type { VerificationCheck } from '@/lib/types';

interface EvidenceShape {
  mode?: string;
  source?: string;
  compared?: {
    quantity?: Record<string, unknown>;
    amount?: Record<string, unknown>;
  };
  findings?: { field: string; severity: string; message: string; docs: string[] }[];
  notes?: { message: string }[];
  similarity?: Record<string, unknown>;
  result?: string;
  note?: string;
  interpretation?: string;
  matchedEntry?: Record<string, unknown>;
  [k: string]: unknown;
}

const QTY_ROWS: [string, string][] = [
  ['Invoice', 'invoice'],
  ['Packing List', 'packing'],
  ['Shipping Bill', 'shippingBill'],
  ['Bill of Lading', 'bl'],
  ['Purchase Order', 'po'],
];

export function EvidenceDrawer({
  check,
  title,
  onClose,
}: {
  check: VerificationCheck | null;
  title: string;
  onClose: () => void;
}) {
  const evidence = (check?.evidence ?? {}) as EvidenceShape;
  const compared = evidence.compared;
  const mismatched = new Set<string>();
  evidence.findings?.forEach((f) => f.docs?.forEach((d) => mismatched.add(d)));

  return (
    <Drawer
      open={Boolean(check)}
      onClose={onClose}
      title={title}
      subtitle={check ? `Check ${String(check.checkId).padStart(2, '0')} · ${dateTime(check.runAt)}` : undefined}
    >
      {check && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <CheckStatusIcon result={check.result} size={22} />
              <StatusChip status={check.result} />
            </div>
            <SourceChip source={check.source} simulated={String(evidence.mode) !== 'real'} />
            <span className="tabular text-[11px] text-ink-3">{Math.round(check.durationMs)} ms</span>
          </div>

          <div>
            <div className="caption mb-1">Result line</div>
            <p className="text-[13px] leading-5 text-ink">{check.line}</p>
          </div>

          {evidence.interpretation && (
            <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] leading-5 text-ink-2">
              <span className="font-medium text-ink">Interpretation.</span> {evidence.interpretation}
            </div>
          )}

          {compared?.quantity && (
            <div>
              <div className="caption mb-2">Compared fields</div>
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-[12px]">
                  <thead className="bg-canvas text-left text-[11px] text-ink-3">
                    <tr>
                      <th className="px-3 py-2 font-medium">Document</th>
                      <th className="px-3 py-2 font-medium">Quantity</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {QTY_ROWS.map(([label, key]) => {
                      const qty = compared.quantity?.[key];
                      const isMismatch = mismatched.has(key);
                      return (
                        <tr key={key} className={`border-t border-line ${isMismatch ? 'bg-danger-soft/70' : ''}`}>
                          <td className="px-3 py-2 text-ink-2">{label}</td>
                          <td className={`tabular px-3 py-2 ${isMismatch ? 'font-semibold text-danger' : 'text-ink'}`}>
                            {qty != null ? Number(qty).toLocaleString('en-IN') : '—'}
                          </td>
                          <td className="tabular px-3 py-2 text-ink-2">
                            {key === 'invoice' && compared.amount?.invoice != null
                              ? `USD ${Number(compared.amount.invoice).toLocaleString('en-IN')}`
                              : key === 'shippingBill' && compared.amount?.shippingBillFob != null
                                ? `USD ${Number(compared.amount.shippingBillFob).toLocaleString('en-IN')}`
                                : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {Boolean(compared.quantity.partialShipmentsPermitted) && (
                <p className="mt-2 text-[12px] leading-5 text-ink-2">
                  Partial shipment permitted by PO.
                </p>
              )}
            </div>
          )}

          {evidence.findings && evidence.findings.length > 0 && (
            <div>
              <div className="caption mb-2">Findings</div>
              <ul className="space-y-2">
                {evidence.findings.map((f, i) => (
                  <li
                    key={i}
                    className={`rounded-lg border px-3 py-2 text-[12px] leading-5 ${
                      f.severity === 'mismatch' ? 'border-danger/20 bg-danger-soft/40 text-danger' : 'border-line bg-canvas text-ink-2'
                    }`}
                  >
                    {f.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evidence.similarity && (
            <div>
              <div className="caption mb-2">Similarity breakdown</div>
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-[12px]">
                  <tbody>
                    {Object.entries(evidence.similarity).map(([k, v]) => (
                      <tr key={k} className="border-b border-line last:border-b-0">
                        <td className="px-3 py-1.5 capitalize text-ink-2">{k.replace(/([A-Z])/g, ' $1')}</td>
                        <td className="tabular px-3 py-1.5 text-right text-ink">
                          {typeof v === 'number' ? v.toFixed(2) : String(v)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[12px] text-ink-3">Possible duplicate at 0.80 or above.</p>
            </div>
          )}

          {evidence.note && <p className="text-[12px] leading-5 text-ink-2">{String(evidence.note)}</p>}

          <div>
            <div className="caption mb-2">Raw evidence</div>
            <pre className="thin-scroll max-h-[280px] overflow-auto rounded-lg border border-line bg-[#fcfaf5] p-3 font-mono text-[11px] leading-4 text-ink-2">
              {JSON.stringify(check.evidence, null, 2)}
            </pre>
          </div>
        </div>
      )}
      {check && (
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="caption">Evidence reference</span>
          <HashPill hash={check.evidenceHash} />
        </div>
      )}
    </Drawer>
  );
}
