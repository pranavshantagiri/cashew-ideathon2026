'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  FileText,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { StatusChip, SourceChip, BandChip } from '@/components/StatusChip';
import { StatCard } from '@/components/StatCard';
import { HashPill } from '@/components/HashPill';
import { Stepper } from '@/components/Stepper';
import { Timeline, TRADE_MILESTONES, SHIPMENT_MILESTONES } from '@/components/Timeline';
import { CheckRow } from '@/components/CheckRow';
import { DocSlot, type DocSlotState } from '@/components/DocSlot';
import { EmptyState } from '@/components/EmptyState';
import { Drawer, Modal } from '@/components/Overlays';
import { toast } from '@/lib/client';
import { inr } from '@/lib/format';

const TOKENS: { name: string; value: string; className: string; note: string }[] = [
  { name: 'Canvas', value: '#FAF6EF', className: 'bg-canvas', note: 'Page background, warm paper' },
  { name: 'Surface', value: '#FFFFFF', className: 'bg-surface', note: 'Cards, drawers, inputs' },
  { name: 'Ink', value: '#1E2B24', className: 'bg-ink', note: 'Primary text' },
  { name: 'Ink 2', value: '#4B5A52', className: 'bg-ink-2', note: 'Secondary text' },
  { name: 'Line', value: '#E6DECF', className: 'bg-line', note: 'Borders and dividers' },
  { name: 'Brand', value: '#1F4D3A', className: 'bg-brand', note: 'Primary action, confidence' },
  { name: 'Accent', value: '#D9822B', className: 'bg-accent', note: 'Cassia accent, sparing' },
  { name: 'Success', value: '#2E7D5B', className: 'bg-success', note: 'Pass, verified, funded' },
  { name: 'Warn', value: '#B7791F', className: 'bg-warn', note: 'Review, hidden fee, flag' },
  { name: 'Danger', value: '#B93A2E', className: 'bg-danger', note: 'Fail, blocking, danger' },
  { name: 'Unknown', value: '#5B6B8C', className: 'bg-unknown', note: 'Unknown, never rounded up' },
];

const CHECKS: { id: number; title: string; source: string; result: 'pass' | 'fail' | 'unknown' | 'warn' | 'pending'; line: string }[] = [
  { id: 5, title: 'e-Invoice is valid and signed', source: 'e-Invoice', result: 'pass', line: 'IRN active; signed payload matches the invoice.' },
  { id: 7, title: 'Shipment is confirmed by the carrier', source: 'Carrier', result: 'unknown', line: 'No carrier confirmation yet. Unknown is passed to lenders as unknown.' },
  { id: 8, title: 'Documents agree with each other', source: 'Computed', result: 'fail', line: 'Invoice quantity 4,800 does not match Bill of Lading quantity 4,200.' },
  { id: 12, title: 'Invoice is not already financed', source: 'Registry', result: 'warn', line: 'Possible duplicate. This invoice is similar to one already financed through Cashew.' },
  { id: 14, title: 'Buyer confirms the trade', source: 'Buyer link', result: 'pending', line: 'Waiting for the buyer to confirm.' },
];

export default function KitPage() {
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(false);
  const [docState] = useState<DocSlotState>('extracted');

  return (
    <div className="mx-auto max-w-content px-6 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="mb-2 inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink">
            <ArrowLeft size={14} /> Back
          </Link>
          <div className="caption mb-1">Cashew design system</div>
          <h1 className="h1">Component kit</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-ink-2">
            The small set of primitives the demo is built from. Warm paper, deep green, one accent. Status is never
            carried by colour alone: every state has an icon and a word.
          </p>
        </div>
        <Link href="/app">
          <Button icon={<ArrowRight size={15} />}>Open the demo</Button>
        </Link>
      </div>

      <div className="space-y-8">
        <Section title="Colour" body="CSS custom properties exposed as Tailwind tokens. One brand green, one accent used sparingly.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TOKENS.map((t) => (
              <div key={t.name} className="card overflow-hidden">
                <div className={`h-16 ${t.className} border-b border-line`} />
                <div className="p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] font-semibold text-ink">{t.name}</span>
                    <span className="font-mono text-[10px] text-ink-3">{t.value}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] leading-4 text-ink-3">{t.note}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography" body="Fraunces for display and headings, Inter for prose and UI, IBM Plex Mono for identifiers and hashes. All fonts bundled locally.">
          <div className="card space-y-3 p-6">
            <div>
              <div className="caption">Display / Fraunces 600</div>
              <div className="h1">Verified evidence, not a credit score</div>
            </div>
            <div>
              <div className="caption">Section / Fraunces 600</div>
              <div className="h2">Fourteen checks, each with a source</div>
            </div>
            <div>
              <div className="caption">Subsection / Fraunces 600</div>
              <div className="h3">Offer comparison</div>
            </div>
            <div>
              <div className="caption">Body / Inter 400</div>
              <p className="max-w-xl text-[14px] leading-6 text-ink-2">
                The exporter sees the effective annualised cost, every fee and the conditions that change it. Ranking
                never depends on what a lender pays Cashew.
              </p>
            </div>
            <div>
              <div className="caption">Mono / IBM Plex Mono</div>
              <div className="mono text-ink-2">KT/2627/0231 · fp 9f2c…a71b · rules-v0.1</div>
            </div>
          </div>
        </Section>

        <Section title="Buttons" body="One primary action per region. Secondary for adjacent choices, ghost for destruction-free actions.">
          <div className="card flex flex-wrap items-center gap-3 p-6">
            <Button icon={<Plus size={15} />}>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="accent" icon={<Sparkles size={15} />}>Accent</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <Button size="compact">Compact</Button>
            <Button size="sm" variant="secondary">Small</Button>
          </div>
        </Section>

        <Section title="Status" body="Icon, colour and a word. Simulated sources carry a visible label.">
          <div className="card space-y-4 p-6">
            <div className="flex flex-wrap gap-2">
              {['pass', 'fail', 'unknown', 'pending', 'warn', 'running', 'info', 'neutral', 'brand'].map((s) => (
                <StatusChip key={s} status={s} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SourceChip source="MCA" />
              <SourceChip source="Carrier" />
              <SourceChip source="Computed" simulated={false} />
              <BandChip band="Strong" />
              <BandChip band="Moderate" />
              <BandChip band="Limited" />
            </div>
            <div className="flex flex-wrap gap-2">
              <HashPill hash="9f2c1d8e7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d" label="Fingerprint" />
              <HashPill hash="GENESIS" label="Genesis" />
            </div>
          </div>
        </Section>

        <Section title="Checks" body="The verification row is the core unit. A completed row opens its evidence drawer; a pending row has no fabricated result.">
          <div className="card px-4 py-1">
            {CHECKS.map((c) => (
              <CheckRow
                key={c.id}
                id={c.id}
                title={c.title}
                source={c.source}
                result={c.result === 'pending' ? 'idle' : c.result}
                line={c.result === 'pending' ? 'Waiting for the buyer to confirm.' : c.line}
                durationMs={c.result === 'pending' ? undefined : 700}
                simulated={c.id !== 8 && c.id !== 12}
                onClick={c.id === 8 ? () => setDrawer(true) : undefined}
              />
            ))}
          </div>
        </Section>

        <Section title="Documents" body="Four slot states. Scanning is staged and labelled; extraction values are fixtures, not real OCR.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DocSlot label="Commercial invoice" state="empty" />
            <DocSlot label="Packing list" state="scanning" />
            <DocSlot label="Bill of lading" state={docState} fields={9} filename="bl-demo.pdf" />
            <DocSlot label="Purchase order" state="review" fields={8} lowConfidence={2} filename="po-demo.pdf" />
          </div>
        </Section>

        <Section title="Data display" body="Counts animate once on mount, respect reduced motion, and stay tabular. Empty states are written, not decorative.">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active trades" value={1} icon={<Sparkles size={16} />} hint="One trade in progress" />
            <StatCard label="Total financed" value={2550000} format={(n) => inr(Math.round(n))} icon={<Banknote size={16} />} />
            <StatCard label="Avg. first offer" value={8} format={(n) => `${Math.round(n)}s`} icon={<Clock3 size={16} />} />
            <StatCard label="Passed checks" value={12} format={(n) => `${Math.round(n)}/14`} icon={<CheckCircle2 size={16} />} delta="One fail, one unknown" deltaTone="warn" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="card p-6">
              <div className="caption mb-3">Vertical timeline</div>
              <Timeline items={SHIPMENT_MILESTONES} current={1} orientation="vertical" />
            </div>
            <div className="card flex items-center p-6">
              <EmptyState
                compact
                title="No offers yet"
                body="Verified evidence is the precondition. Sealed offers appear after the exporter consents."
                action="Open to lenders"
              />
            </div>
          </div>
        </Section>

        <Section title="Progress and overlays" body="Stepper for a linear wizard, drawer for evidence, modal for a consequential decision. Escape closes both.">
          <div className="card space-y-6 p-6">
            <Stepper steps={['Trade', 'Documents', 'Review', 'Share']} current={1} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setDrawer(true)}>
                Open evidence drawer
              </Button>
              <Button variant="secondary" onClick={() => setModal(true)}>
                Open confirm modal
              </Button>
              <Button variant="ghost" onClick={() => toast('Toast', 'A quiet confirmation, 4 seconds.', 'success')}>
                Toast
              </Button>
              <Button variant="ghost" onClick={() => toast('Cannot continue', 'Check 8 needs an amended invoice or an explicit flag.', 'danger')}>
                Error toast
              </Button>
            </div>
          </div>
        </Section>

        <Section title="Timeline of a trade" body="One linear, honest state machine. Unknown stages are visually distinct from complete ones.">
          <div className="card p-6">
            <Timeline items={TRADE_MILESTONES} current={2} compact />
          </div>
        </Section>
      </div>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Check 8 — evidence"
        subtitle="Documents agree with each other"
        footer={
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setDrawer(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <StatusChip status="fail" label="Fail" />
          <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] leading-6 text-ink">
            Invoice quantity 4,800 does not match Bill of Lading quantity 4,200.
          </div>
          <div>
            <div className="caption mb-1">Evidence</div>
            <pre className="thin-scroll overflow-x-auto rounded-lg border border-line bg-[#fcfaf5] p-3 font-mono text-[10px] leading-4 text-ink-2">{`{
  "source": "Computed",
  "mode": "real",
  "inputs": {
    "invoice.quantity": 4800,
    "packing.quantity": 4200,
    "shippingBill.quantity": 4200,
    "bl.quantity": 4200
  },
  "rule": "invoice.quantity == packing.quantity == bl.quantity"
}`}</pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="compact" icon={<FileText size={14} />}>
              Upload corrected document
            </Button>
            <Button size="compact" variant="ghost">
              Flag to lenders
            </Button>
          </div>
        </div>
      </Drawer>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Accept this offer?"
        subtitle="Meridian Bank · ₹17,85,000 net cash"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setModal(false);
                toast('Offer accepted', 'A simulated OTP is the next step.', 'success');
              }}
            >
              Accept offer
            </Button>
          </div>
        }
      >
        <p className="text-[13px] leading-6 text-ink-2">
          The comparison is ranked by effective cost. The modal restates the real terms, including any fee disclosed
          only in the conditions, before anything is accepted.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-lg border border-line p-3">
            <div className="text-ink-3">Effective cost</div>
            <div className="h3 tabular">12.93%</div>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="text-ink-3">Hidden fee</div>
            <div className="h3 text-warn">₹0</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Section({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <div className="h3">{title}</div>
        <p className="mt-0.5 max-w-2xl text-[12px] leading-5 text-ink-3">{body}</p>
      </div>
      {children}
    </section>
  );
}
