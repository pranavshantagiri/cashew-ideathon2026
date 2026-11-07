'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  FileText,
  Info,
  Package,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, toast, useApi } from '@/lib/client';
import { Button } from '@/components/Button';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { inr } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { LenderProduct } from '@/lib/types';

const CORRIDORS = ['IN-GB', 'IN-US', 'IN-AE', 'IN-DE', 'IN-EU'];
const SECTORS = ['textiles', 'engineering', 'chemicals', 'agri'];
const DOCS = [
  ['po', 'Purchase order'],
  ['invoice', 'Commercial invoice'],
  ['packing', 'Packing list'],
  ['shippingBill', 'Shipping bill'],
  ['bl', 'Bill of lading'],
] as const;

export default function LenderProductsPage() {
  const { data, error, refresh } = useApi<{ product?: LenderProduct; products: LenderProduct[] }>('/lender/products', {
    interval: 6000,
  });
  const product = data?.product;

  const [form, setForm] = useState<LenderProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (product && !dirty) setForm({ ...product, fees: product.fees?.map((f) => ({ ...f })) });
  }, [product, dirty]);

  function patch(next: Partial<LenderProduct>) {
    setDirty(true);
    setForm((f) => (f ? { ...f, ...next } : f));
  }

  async function save() {
    if (!form) return;
    if (form.minTicket > form.maxTicket) {
      toast('Ticket range is invalid', 'The minimum must not exceed the maximum.', 'danger');
      return;
    }
    setSaving(true);
    try {
      await api(`/products/${form.id}`, {
        method: 'POST',
        json: {
          active: form.active,
          minTicket: form.minTicket,
          maxTicket: form.maxTicket,
          maxTenureDays: form.maxTenureDays,
          minStrength: form.minStrength,
          corridors: form.corridors,
          sectors: form.sectors,
          requiredDocs: form.requiredDocs,
          advancePct: Number(form.advancePct ?? 85),
          ratePct: Number(form.ratePct ?? 11.5),
          disbursalHours: Number(form.disbursalHours ?? 48),
          validityDays: Number(form.validityDays ?? 7),
          conditions: form.conditions,
        },
      });
      setSaving(false);
      setDirty(false);
      toast('Product updated', 'New offers use these rules. Submitted offers never change.', 'success');
      refresh();
    } catch (e) {
      setSaving(false);
      toast('Could not save the product', (e as Error).message, 'danger');
    }
  }

  if (error) {
    return (
      <div className="card">
        <EmptyState title="Lender access only" body="Switch to a lender role to configure its product." action="Open inbox" href="/lender" />
      </div>
    );
  }

  if (!form) {
    return <div className="card p-10 text-center text-[13px] text-ink-3">Loading product rules…</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/lender" className="mb-2 inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink">
          <ArrowLeft size={14} /> Inbox
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="caption mb-1">Lender portal</div>
            <h1 className="h1">Products</h1>
            <p className="mt-1 max-w-xl text-[13px] leading-5 text-ink-2">
              The product defines which trades reach your inbox. Offer pricing is submitted per trade; these are the
              defaults and the rules.
            </p>
          </div>
          <Button onClick={save} loading={saving} disabled={!dirty} icon={<Save size={15} />}>
            Save product
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={form.active ? 'success' : 'neutral'} label={form.active ? 'Active' : 'Inactive'} />
        <StatusChip status="info" label={form.name} />
        <StatusChip status="neutral" label={form.pricingModel ?? 'Advance + discount'} />
        <span className="text-[11px] text-ink-3">Product id {form.id}</span>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="h3">Eligibility rules</div>
                <div className="text-[12px] text-ink-3">
                  A trade must pass every rule to be shared with you. Reasons for exclusion are shown to the exporter.
                </div>
              </div>
              <SlidersHorizontal size={17} className="text-ink-3" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Minimum ticket (₹)"
                value={form.minTicket}
                onChange={(v) => patch({ minTicket: v })}
                min={0}
                step={50_000}
                hint={inr(form.minTicket)}
              />
              <NumberField
                label="Maximum ticket (₹)"
                value={form.maxTicket}
                onChange={(v) => patch({ maxTicket: v })}
                min={0}
                step={500_000}
                hint={inr(form.maxTicket)}
              />
              <NumberField
                label="Maximum tenure (days)"
                value={form.maxTenureDays}
                onChange={(v) => patch({ maxTenureDays: v })}
                min={1}
                max={365}
                hint={`${form.maxTenureDays} days`}
              />
              <NumberField
                label="Minimum evidence strength"
                value={form.minStrength}
                onChange={(v) => patch({ minStrength: v })}
                min={0}
                max={100}
                hint={`${form.minStrength}/100`}
              />
            </div>

            <div className="mt-5">
              <div className="mb-1 text-[11px] font-medium text-ink-3">Corridors</div>
              <div className="flex flex-wrap gap-1.5">
                {CORRIDORS.map((c) => {
                  const on = form.corridors.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        patch({
                          corridors: on ? form.corridors.filter((x) => x !== c) : [...form.corridors, c],
                        })
                      }
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px]',
                        on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-3',
                      )}
                    >
                      {on && <Check size={11} className="mr-1 inline" />}
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1 text-[11px] font-medium text-ink-3">Sectors</div>
              <div className="flex flex-wrap gap-1.5">
                {SECTORS.map((s) => {
                  const on = form.sectors.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        patch({
                          sectors: on ? form.sectors.filter((x) => x !== s) : [...form.sectors, s],
                        })
                      }
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] capitalize',
                        on ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-3',
                      )}
                    >
                      {on && <Check size={11} className="mr-1 inline" />}
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1 text-[11px] font-medium text-ink-3">Required documents</div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {DOCS.map(([key, label]) => {
                  const on = form.requiredDocs.includes(key);
                  return (
                    <label
                      key={key}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px]',
                        on ? 'border-line bg-surface text-ink' : 'border-line bg-canvas text-ink-3',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          patch({
                            requiredDocs: on
                              ? form.requiredDocs.filter((x) => x !== key)
                              : [...form.requiredDocs, key],
                          })
                        }
                        className="h-3.5 w-3.5 accent-[var(--brand)]"
                      />
                      <FileText size={13} /> {label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-lg border border-line bg-canvas px-3 py-2">
              <div>
                <div className="text-[12px] font-medium text-ink">Product active</div>
                <div className="text-[11px] text-ink-3">Inactive products are excluded with a visible reason.</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.active}
                onClick={() => patch({ active: !form.active })}
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors',
                  form.active ? 'bg-brand' : 'bg-line',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all',
                    form.active ? 'left-[22px]' : 'left-0.5',
                  )}
                />
              </button>
            </div>
          </section>

          <section className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="h3">Pricing defaults</div>
                <div className="text-[12px] text-ink-3">
                  Offer forms start here. The effective cost is always computed from the submitted terms.
                </div>
              </div>
              <Sparkles size={17} className="text-accent" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Advance %" value={form.advancePct ?? 85} onChange={(v) => patch({ advancePct: v })} min={1} max={100} step={1} hint={`${form.advancePct ?? 85}%`} />
              <NumberField
                label="Headline rate % p.a."
                value={form.ratePct ?? 11.5}
                onChange={(v) => patch({ ratePct: v })}
                min={0}
                max={40}
                step={0.1}
                hint={`${form.ratePct ?? 11.5}% p.a.`}
              />
              <NumberField
                label="Disbursal (hours)"
                value={form.disbursalHours ?? 48}
                onChange={(v) => patch({ disbursalHours: v })}
                min={1}
                hint={`${form.disbursalHours ?? 48} hours`}
              />
              <NumberField
                label="Offer validity (days)"
                value={form.validityDays ?? 7}
                onChange={(v) => patch({ validityDays: v })}
                min={1}
                max={30}
                hint={`${form.validityDays ?? 7} days`}
              />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-[11px] font-medium text-ink-3">Default conditions</label>
              <textarea
                value={form.conditions ?? ''}
                onChange={(e) => patch({ conditions: e.target.value })}
                rows={3}
                className="w-full rounded-input border border-line bg-surface px-3 py-2 text-[12px] leading-5"
              />
              <p className="mt-1 text-[11px] leading-4 text-ink-3">
                Fees disclosed here still count. If a fee changes the real cost, enter it as a fee rather than burying
                it in prose.
              </p>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium text-ink-3">Default fee schedule</span>
                <span className="text-[10px] text-ink-3">Referenced by new offers</span>
              </div>
              <div className="space-y-1.5">
                {(form.fees ?? []).map((f, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-[11px]">
                    <span className="text-ink">{f.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular text-ink-2">
                        {f.kind === 'flat' ? inr(f.value) : `${f.value}%`}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[10px]',
                          f.statedIn === 'conditions' ? 'bg-warn-soft text-warn' : 'bg-canvas text-ink-3',
                        )}
                      >
                        {f.statedIn}
                      </span>
                    </span>
                  </div>
                ))}
                {!form.fees?.length && <p className="text-[11px] text-ink-3">No default fees.</p>}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
              <span className="text-[11px] text-ink-3">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
              <Button onClick={save} loading={saving} disabled={!dirty} size="compact" icon={<Save size={14} />}>
                Save product
              </Button>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="caption mb-2">Rule summary</div>
            <div className="space-y-1.5 text-[12px] text-ink-2">
              <Row label="Ticket" value={`${inr(form.minTicket)} – ${inr(form.maxTicket)}`} />
              <Row label="Tenure up to" value={`${form.maxTenureDays} days`} />
              <Row label="Corridors" value={form.corridors.join(', ') || 'None'} />
              <Row label="Sectors" value={form.sectors.join(', ') || 'None'} />
              <Row label="Minimum strength" value={`${form.minStrength}`} />
              <Row label="Required docs" value={`${form.requiredDocs.length}/5`} />
              <Row label="Disbursal" value={`${form.disbursalHours ?? 48} h`} />
            </div>
          </div>

          <div className="card p-5">
            <div className="caption mb-2">When rules change</div>
            <p className="text-[12px] leading-5 text-ink-2">
              Product updates apply to offers generated after the change. Sealed offers already submitted keep their
              original terms, so an exporter is never surprised by a moving quote.
            </p>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-canvas px-2.5 py-2 text-[11px] leading-4 text-ink-3">
              <Info size={13} className="mt-0.5 shrink-0" />
              There is no commission field. Cashew ranks by effective cost only.
            </div>
          </div>

          <div className="card p-5">
            <div className="caption mb-2">All lender products</div>
            <div className="space-y-1.5">
              {(data?.products ?? []).map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-[11px]',
                    p.id === form.id ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink-2',
                  )}
                >
                  <div className="font-medium">{p.name}</div>
                  <div className={cn('text-[10px]', p.id === form.id ? 'text-brand/70' : 'text-ink-3')}>
                    {p.lenderId.replace('lender_', '')} · {p.active ? 'active' : 'inactive'} · min strength {p.minStrength}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-4 text-ink-3">
              You can edit only your own product in the real product; this demo shows the seed set.
            </p>
          </div>

          <div className="card p-5">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-ink">
              <ShieldCheck size={15} className="text-brand" /> Consent remains the gate
            </div>
            <p className="text-[11px] leading-4 text-ink-3">
              Product rules decide who is eligible. Consent decides who can actually see the trade. Both are enforced
              by the API, not by hiding buttons.
            </p>
          </div>
        </aside>
      </div>

      {dirty && (
        <div className="fixed bottom-24 right-4 z-20 hidden items-center gap-3 rounded-full border border-line bg-surface px-4 py-2 text-[12px] shadow-md lg:flex">
          <AlertTriangle size={14} className="text-warn" /> Unsaved product changes
          <Button size="sm" onClick={save} loading={saving}>
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-ink-3">{label}</span>
        {hint && <span className="tabular text-[10px] text-ink-3">{hint}</span>}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 w-full rounded-input border border-line bg-surface px-3 text-[12px] tabular"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-3">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}
