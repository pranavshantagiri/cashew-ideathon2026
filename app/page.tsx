'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, ClipboardList, RotateCcw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { api, toast } from '@/lib/client';
import { cn } from '@/lib/cn';

const ROLES = [
  {
    key: 'exporter',
    title: 'Exporter',
    org: 'Kaveri Textiles',
    body: 'Upload documents, run fourteen checks, compare sealed offers and sign.',
    icon: Building2,
    accent: 'bg-brand-soft text-brand',
  },
  {
    key: 'lender',
    title: 'Lender',
    org: 'Banyan Capital',
    body: 'Review consented trades, set your own evidence weights and submit a sealed offer.',
    icon: ShieldCheck,
    accent: 'bg-accent-soft text-accent',
  },
  {
    key: 'ops',
    title: 'Ops',
    org: 'Asha (Cashew Ops)',
    body: 'Work the review queue, check the registry and read the audit trail.',
    icon: ClipboardList,
    accent: 'bg-unknown-soft text-unknown',
  },
] as const;

export default function LandingPage() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function pick(role: string) {
    setBusy(role);
    try {
      await api('/session', { method: 'POST', json: { role } });
      router.push(role === 'exporter' ? '/app' : role === 'lender' ? '/lender' : '/ops');
    } catch {
      toast('Could not set role', 'Try again.', 'danger');
      setBusy(null);
    }
  }

  async function resetDemo() {
    await api('/demo/reset', { method: 'POST', json: {} });
    toast('Demo reset', 'Seed state restored.', 'success');
  }

  return (
    <main className="grid min-h-[calc(100vh-24px)] place-items-center px-6 py-10">
      <div className="w-full max-w-[920px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 3c4.5 0 8 3.4 8 7.7 0 4.6-4 8.6-8 10.3-4-1.7-8-5.7-8-10.3C4 6.4 7.5 3 12 3Z"
                stroke="var(--accent)"
                strokeWidth="1.6"
              />
              <path d="M12 5.5v13.5" stroke="var(--accent)" strokeWidth="1.3" opacity=".55" />
              <path d="M8.4 9.4c1.6-.6 5.6-.6 7.2 0" stroke="var(--accent)" strokeWidth="1" opacity=".6" />
            </svg>
          </div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[11px] text-ink-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Presentation demo · offline
          </div>
          <h1 className="h1 mx-auto max-w-[620px] text-balance">One verified trade. Many lenders.</h1>
          <p className="mx-auto mt-3 max-w-[560px] text-[14px] leading-6 text-ink-2">
            Cashew verifies an export invoice once, shares the evidence with consented lenders, and compares what each
            offer really costs. Pick a role to walk through the five-minute story.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => pick(r.key)}
                disabled={busy !== null}
                className={cn(
                  'card group flex min-h-[196px] flex-col p-6 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60',
                )}
              >
                <span className={cn('mb-4 flex h-10 w-10 items-center justify-center rounded-xl', r.accent)}>
                  <Icon size={20} />
                </span>
                <div className="h3">{r.title}</div>
                <div className="mt-0.5 text-[12px] font-medium text-ink-2">{r.org}</div>
                <p className="mt-2 flex-1 text-[12px] leading-5 text-ink-3">{r.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-brand">
                  Enter as {r.title.toLowerCase()}
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
          <span>No passwords in the demo.</span>
          <span className="text-line">·</span>
          <span>Fixed FX: USD 1 = ₹85.00</span>
          <span className="text-line">·</span>
          <button type="button" onClick={resetDemo} className="inline-flex items-center gap-1 underline hover:text-ink">
            <RotateCcw size={12} /> Reset demo
          </button>
        </div>
      </div>
    </main>
  );
}
