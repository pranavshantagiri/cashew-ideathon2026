'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, toast, useApi } from '@/lib/client';
import { Button } from '@/components/Button';
import { Stepper } from '@/components/Stepper';
import { DocSlot, type DocSlotState } from '@/components/DocSlot';
import { VerificationBoard, type EvidenceResponse } from '@/components/VerificationBoard';
import { StatusChip, BandChip } from '@/components/StatusChip';
import { inr, pct, usd } from '@/lib/format';
import type { Doc, DocType, Trade } from '@/lib/types';

const STEPS = ['Trade details', 'Documents', 'Verification', 'Review and consent'];
const DOC_TYPES: DocType[] = ['po', 'invoice', 'packing', 'shippingBill', 'bl'];
const DOC_LABEL: Record<DocType, string> = {
  po: 'Purchase Order',
  invoice: 'Commercial Invoice',
  packing: 'Packing List',
  shippingBill: 'Shipping Bill',
  bl: 'Bill of Lading',
};

const SAMPLES = {
  A: { buyerId: 'buyer_northgate', goods: 'Cotton knit T-shirts, 180 GSM, HS 6109', hsCode: '610910', valueUsd: 18750, incoterm: 'FOB', paymentTermsDays: 90 },
  B: { buyerId: 'buyer_northgate', goods: 'Cotton knit T-shirts, 180 GSM, HS 6109', hsCode: '610910', valueUsd: 30000, incoterm: 'FOB', paymentTermsDays: 90 },
  C: { buyerId: 'buyer_hartwell', goods: 'Cotton knit polos, 200 GSM, HS 6109', hsCode: '610910', valueUsd: 18400, incoterm: 'FOB', paymentTermsDays: 90 },
};

const sleep = (n: number) => new Promise((r) => setTimeout(r, n));

export default function NewTradePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [scenario, setScenario] = useState<'A' | 'B' | 'C'>('B');
  const [buyerId, setBuyerId] = useState('buyer_northgate');
  const [goods, setGoods] = useState(SAMPLES.B.goods);
  const [hsCode, setHsCode] = useState('610910');
  const [valueUsd, setValueUsd] = useState(30000);
  const [incoterm, setIncoterm] = useState('FOB');
  const [paymentTermsDays, setPaymentTermsDays] = useState(90);
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [scan, setScan] = useState<Record<string, DocSlotState>>({});
  const [filling, setFilling] = useState(false);
  const [consent, setConsent] = useState(false);
  const [opening, setOpening] = useState(false);
  const [flagging, setFlagging] = useState(false);

  const { data: evidence, refresh: refreshEvidence } = useApi<EvidenceResponse>(
    tradeId ? `/trades/${tradeId}/evidence` : null,
    { interval: 500 },
  );
  const docs = evidence?.docs ?? [];
  const latestDoc = (type: DocType) =>
    docs.filter((d) => d.type === type).sort((a, b) => b.version - a.version)[0];
  const haveAll = DOC_TYPES.every((t) => latestDoc(t));

  useEffect(() => {
    const map: Record<string, DocSlotState> = {};
    DOC_TYPES.forEach((t) => {
      const d = latestDoc(t);
      if (d) {
        const low = Object.values(d.extracted.fields).filter((f) => f.confidence < 0.85).length;
        map[t] = low > 0 ? 'review' : 'extracted';
      } else if (!scan[t]) map[t] = 'empty';
      else map[t] = scan[t];
    });
    setScan((prev) => ({ ...map, ...Object.fromEntries(Object.entries(prev).filter(([k, v]) => v === 'scanning')) }));
  }, [docs.length, JSON.stringify(docs.map((d) => [d.type, d.version]))]);

  const formValue = valueUsd;
  const lowCount = (d?: Doc) =>
    d ? Object.values(d.extracted.fields).filter((f) => f.confidence < 0.85).length : 0;

  async function applySample(id: 'A' | 'B' | 'C') {
    setScenario(id);
    const s = SAMPLES[id];
    setBuyerId(s.buyerId);
    setGoods(s.goods);
    setHsCode(s.hsCode);
    setValueUsd(s.valueUsd);
    setIncoterm(s.incoterm);
    setPaymentTermsDays(s.paymentTermsDays);
    if (id === 'C') {
      await api('/demo/scenario', { method: 'POST', json: { id: 'C' } });
      toast('Scenario C loaded', 'The duplicate-attempt scenario uses Coimbatore Knit Studio.', 'warn');
    }
    window.dispatchEvent(new Event('cashew:refresh'));
  }

  async function createTrade() {
    setCreating(true);
    try {
      if (scenario === 'C') {
        await api('/demo/scenario', { method: 'POST', json: { id: 'C' } });
      }
      const res = await api<{ trade: Trade }>('/trades', {
        method: 'POST',
        json: {
          scenario,
          buyerId,
          goods,
          hsCode,
          valueUsd,
          incoterm,
          paymentTermsDays,
        },
      });
      setTradeId(res.trade.id);
      setStep(1);
    } catch (e) {
      toast('Could not create trade', (e as Error).message, 'danger');
    } finally {
      setCreating(false);
    }
  }

  async function uploadDoc(type: DocType, opts: { amended?: boolean; filename?: string } = {}) {
    if (!tradeId) return;
    setScan((s) => ({ ...s, [type]: 'scanning' }));
    try {
      await api(`/trades/${tradeId}/documents`, {
        method: 'POST',
        json: { docType: type, amended: opts.amended, filename: opts.filename },
      });
      await sleep(1600);
      setScan((s) => ({ ...s, [type]: 'extracted' }));
      refreshEvidence();
    } catch (e) {
      setScan((s) => ({ ...s, [type]: 'empty' }));
      toast('Upload failed', (e as Error).message, 'danger');
    }
  }

  async function useSampleDocs() {
    if (!tradeId || filling) return;
    setFilling(true);
    DOC_TYPES.forEach((type, i) => {
      if (latestDoc(type)) return;
      setTimeout(() => {
        void uploadDoc(type, { filename: `${type}-sample.pdf` });
      }, i * 300);
    });
    setTimeout(() => setFilling(false), 2200);
  }

  async function runVerification() {
    if (!tradeId) return;
    try {
      await api(`/trades/${tradeId}/verify`, { method: 'POST', json: {} });
      toast('Verification started', 'Fourteen checks run in sequence.', 'info');
      refreshEvidence();
    } catch (e) {
      toast('Could not start verification', (e as Error).message, 'danger');
    }
  }

  async function uploadAmended() {
    if (!tradeId) return;
    setScan((s) => ({ ...s, invoice: 'scanning' }));
    try {
      const res = await api<{ doc: Doc; trade: Trade }>(`/trades/${tradeId}/documents`, {
        method: 'POST',
        json: { docType: 'invoice', amended: true, filename: 'invoice-amended-sample.pdf' },
      });
      await sleep(1500);
      setValueUsd(Math.round((res.trade.value / 85) * 100) / 100);
      setScan((s) => ({ ...s, invoice: 'extracted' }));
      toast('Amended invoice uploaded', 'Check 8 is re-running with the corrected quantity.', 'success');
      refreshEvidence();
    } catch (e) {
      toast('Upload failed', (e as Error).message, 'danger');
    }
  }

  async function flagFailure() {
    if (!tradeId) return;
    setFlagging(true);
    try {
      await api(`/trades/${tradeId}/flag`, { method: 'POST', json: { checkIds: [8] } });
      setStep(3);
      refreshEvidence();
    } finally {
      setFlagging(false);
    }
  }

  const unresolvedFail = useMemo(() => {
    if (!evidence) return false;
    const flagged = new Set(evidence.flagged ?? []);
    return Object.entries(evidence.results).some(([id, r]) => r === 'fail' && !flagged.has(Number(id)));
  }, [evidence]);
  const complete = Boolean(evidence && !evidence.run && evidence.checks.length >= 14);
  const canContinue = complete && !unresolvedFail;

  async function openToLenders() {
    if (!tradeId) return;
    setOpening(true);
    try {
      const res = await api<{ eligible: string[]; excluded: { lenderId: string }[] }>(
        `/trades/${tradeId}/offer-requests`,
        { method: 'POST', json: {} },
      );
      toast(
        'Trade opened to lenders',
        `${res.eligible.length} lenders received the verified trade.${res.excluded.length ? ` ${res.excluded.length} excluded by product rules.` : ''}`,
        'success',
      );
      router.push(`/app/trades/${tradeId}?tab=offers`);
    } catch (e) {
      toast('Could not open to lenders', (e as Error).message, 'danger');
    } finally {
      setOpening(false);
    }
  }

  const trade = evidence?.trade;
  const displayValue = trade?.value ?? Math.round(formValue * 85);
  const strength = evidence?.risk;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="caption mb-1">Exporter workspace</div>
          <h1 className="h1">New trade</h1>
          <p className="mt-1 text-[13px] text-ink-2">Four steps. No passwords, no waiting for a human.</p>
        </div>
        <div className="flex gap-2">
          {(['A', 'B', 'C'] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={scenario === s ? 'primary' : 'secondary'}
              onClick={() => applySample(s)}
            >
              Use sample {s}
            </Button>
          ))}
        </div>
      </div>

      <div className="card px-6 py-4">
        <Stepper steps={STEPS} current={step} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_336px]">
        <div className="space-y-4">
          {step === 0 && (
            <section className="card p-6">
              <div className="h3 mb-4">Trade details</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-ink-2">Buyer</span>
                  <select
                    value={buyerId}
                    onChange={(e) => setBuyerId(e.target.value)}
                    className="h-10 w-full rounded-input border border-line bg-surface px-3 text-[13px]"
                  >
                    <option value="buyer_northgate">Northgate Apparel Ltd · Manchester, UK</option>
                    <option value="buyer_hartwell">Hartwell &amp; Rowe Retail Ltd · Leeds, UK</option>
                  </select>
                  <span className="mt-1 block text-[11px] text-ink-3">Seeded buyer list. Searchable in the full product.</span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-ink-2">HS code</span>
                  <input
                    value={hsCode}
                    onChange={(e) => setHsCode(e.target.value)}
                    className="h-10 w-full rounded-input border border-line bg-surface px-3 font-mono text-[13px]"
                  />
                  <span className="mt-1 block text-[11px] text-ink-3">Cotton knit T-shirts, HS 6109 · auto-suggested</span>
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[12px] font-medium text-ink-2">Goods description</span>
                  <input
                    value={goods}
                    onChange={(e) => setGoods(e.target.value)}
                    className="h-10 w-full rounded-input border border-line bg-surface px-3 text-[13px]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-ink-2">Value (USD)</span>
                  <input
                    type="number"
                    value={valueUsd}
                    onChange={(e) => setValueUsd(Number(e.target.value))}
                    className="h-10 w-full rounded-input border border-line bg-surface px-3 text-[13px] tabular"
                  />
                  <span className="mt-1 block text-[11px] text-ink-3">₹25,50,000 at 85.00</span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-ink-2">Incoterm</span>
                  <select
                    value={incoterm}
                    onChange={(e) => setIncoterm(e.target.value)}
                    className="h-10 w-full rounded-input border border-line bg-surface px-3 text-[13px]"
                  >
                    <option>FOB</option>
                    <option>CIF</option>
                    <option>CFR</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-ink-2">Payment terms (days)</span>
                  <input
                    type="number"
                    value={paymentTermsDays}
                    onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                    className="h-10 w-full rounded-input border border-line bg-surface px-3 text-[13px] tabular"
                  />
                </label>
                <div className="flex items-end">
                  <Button className="w-full" onClick={createTrade} loading={creating} icon={<ArrowRight size={16} />}>
                    Continue to documents
                  </Button>
                </div>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="card p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="h3">Documents</div>
                  <div className="text-[12px] text-ink-3">Drop files or use the sample set. Extraction is staged.</div>
                </div>
                <Button variant="secondary" size="compact" onClick={useSampleDocs} loading={filling} icon={<Sparkles size={15} />}>
                  Use sample documents
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {DOC_TYPES.map((type) => {
                  const d = latestDoc(type);
                  const low = lowCount(d);
                  return (
                    <DocSlot
                      key={type}
                      label={DOC_LABEL[type]}
                      state={scan[type] ?? (d ? (low ? 'review' : 'extracted') : 'empty')}
                      fields={d ? Object.keys(d.extracted.fields).length : undefined}
                      lowConfidence={low}
                      filename={d?.filename}
                      onFile={(file) => uploadDoc(type, { filename: file.name })}
                      onClick={() => {
                        if (d) {
                          toast(DOC_LABEL[type], `${Object.keys(d.extracted.fields).length} fields extracted · ${low} need review`, low ? 'warn' : 'success');
                        }
                      }}
                    />
                  );
                })}
                <div className="flex min-h-[120px] flex-col justify-center rounded-xl border border-line bg-canvas/60 p-4 text-[12px] leading-5 text-ink-2">
                  <div className="font-medium text-ink">Upload rule</div>
                  Files are hashed and stored in memory. Extraction reads the seeded JSON, never the pixels. Each slot
                  takes 1.5–2.5s to scan.
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                <Button variant="ghost" onClick={() => setStep(0)} icon={<ArrowLeft size={15} />}>
                  Back
                </Button>
                <Button onClick={() => setStep(2)} disabled={!haveAll} icon={<ArrowRight size={15} />}>
                  Continue to verification
                </Button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="card p-6">
              <div className="mb-4">
                <div className="h3">Verification</div>
                <div className="text-[12px] text-ink-3">
                  Fourteen checks, each with a source. Unknown is shown as unknown.
                </div>
              </div>
              {tradeId && (
                <VerificationBoard
                  evidence={evidence}
                  onRun={runVerification}
                  running={Boolean(evidence?.run)}
                  onAmended={uploadAmended}
                  onFlag={flagFailure}
                />
              )}
              <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                <Button variant="ghost" onClick={() => setStep(1)} icon={<ArrowLeft size={15} />}>
                  Back
                </Button>
                <div className="flex items-center gap-3">
                  {!canContinue && (
                    <span className="text-[11px] text-ink-3">
                      {evidence?.run ? 'Checks still running…' : 'Resolve or flag failures to continue.'}
                    </span>
                  )}
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!canContinue}
                    loading={flagging}
                    icon={<ArrowRight size={15} />}
                  >
                    Continue to review
                  </Button>
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="card p-6">
              <div className="h3 mb-4">Review and consent</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-line p-4">
                  <div className="caption mb-2">Trade</div>
                  <dl className="space-y-1.5 text-[13px]">
                    <Row label="Trade ID" value={<span className="mono">{tradeId}</span>} />
                    <Row label="Buyer" value={buyerId === 'buyer_northgate' ? 'Northgate Apparel Ltd' : 'Hartwell & Rowe Retail Ltd'} />
                    <Row label="Invoice value" value={`USD ${valueUsd.toLocaleString('en-IN')} (${inr(valueUsd * 85)} @ 85.00)`} />
                    <Row label="Incoterm" value={incoterm} />
                    <Row label="Terms" value={`${paymentTermsDays} days`} />
                    <Row label="Documents" value={`${docs.length} attached`} />
                  </dl>
                </div>
                <div className="rounded-lg border border-line p-4">
                  <div className="caption mb-2">Evidence strength</div>
                  <div className="flex items-baseline gap-2">
                    <span className="h2 tabular">{pct(strength?.strength ?? 0, 1)}</span>
                    {strength && <BandChip band={strength.band} />}
                  </div>
                  <div className="mt-3 space-y-1.5 text-[12px] text-ink-2">
                    <div className="flex justify-between">
                      <span>Passed</span>
                      <span className="tabular">{evidence?.checks.filter((c) => c.result === 'pass').length ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Unknown</span>
                      <span className="tabular">{evidence?.checks.filter((c) => c.result === 'unknown').length ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Flagged</span>
                      <span className="tabular">{evidence?.flagged.length ?? 0}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] leading-4 text-ink-3">
                    The bundle contains all checks, extracted fields, timestamps and an evidence hash. It is not a
                    score.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-brand/20 bg-brand-soft/50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand" />
                  <div>
                    <div className="text-[13px] font-semibold text-ink">Consent</div>
                    <p className="mt-0.5 text-[12px] leading-5 text-ink-2">
                      Share this trade and its evidence with lenders for 30 days. You can revoke at any time.
                    </p>
                    <label className="mt-3 flex items-start gap-2 text-[12px] text-ink-2">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
                      />
                      I have read the summary and consent to sharing this verified trade with the matched lenders.
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                <Button variant="ghost" onClick={() => setStep(2)} icon={<ArrowLeft size={15} />}>
                  Back
                </Button>
                <Button onClick={openToLenders} disabled={!consent} loading={opening} icon={<ArrowRight size={15} />}>
                  Open to lenders
                </Button>
              </div>
            </section>
          )}
        </div>

        <aside className="hidden xl:block">
          <div className="card sticky top-6 p-5">
            <div className="caption mb-3">Trade summary</div>
            <div className="space-y-3 text-[13px]">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-ink-3">Buyer</div>
                <div className="font-medium">{buyerId === 'buyer_northgate' ? 'Northgate Apparel Ltd' : 'Hartwell & Rowe Retail Ltd'}</div>
                <div className="text-[11px] text-ink-3">Manchester, UK · IN-GB</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-ink-3">Invoice value</div>
                <div className="tabular font-medium">{usd(valueUsd)}</div>
                <div className="tabular text-[11px] text-ink-3">{inr(displayValue)} @ 85.00</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-3">Incoterm</div>
                  <div>{incoterm}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-ink-3">Terms</div>
                  <div>{paymentTermsDays} days</div>
                </div>
              </div>
              <div className="border-t border-line pt-3">
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="text-ink-2">Documents</span>
                  <span className="tabular">{DOC_TYPES.filter((t) => latestDoc(t)).length}/5</span>
                </div>
                <div className="flex gap-1">
                  {DOC_TYPES.map((t) => (
                    <span
                      key={t}
                      className={`h-1.5 flex-1 rounded-full ${latestDoc(t) ? 'bg-success' : 'bg-line'}`}
                      title={DOC_LABEL[t]}
                    />
                  ))}
                </div>
              </div>
              {strength && (
                <div className="border-t border-line pt-3">
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="text-ink-2">Evidence strength</span>
                    <span className="tabular font-medium">{pct(strength.strength, 1)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.min(100, strength.strength)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-ink-3">{strength.band} · {strength.blocking.length ? 'blocking issue' : 'no blocking issue'}</div>
                </div>
              )}
            </div>
            <div className="mt-4 rounded-lg bg-canvas px-3 py-2 text-[11px] leading-4 text-ink-3">
              <FileText size={12} className="mr-1 inline" />
              Export values always show USD and ₹ at the fixed demo rate.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="text-right text-[12px] text-ink">{value}</dd>
    </div>
  );
}
