'use client';

import { ChevronLeft, ChevronRight, RotateCcw, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, toast, useUi, PRESENTER_NOTES } from '@/lib/client';
import { useApi } from '@/lib/client';
import { Button } from './Button';
import { cn } from '@/lib/cn';

interface DemoState {
  scenario: 'A' | 'B' | 'C';
  speed: number;
  trades: { id: string; status: string; scenario: string; smeId: string }[];
  pendingOffers: number;
  registryCount: number;
}

export function DemoPanel() {
  const router = useRouter();
  const { demoOpen, setDemoOpen, notesOn, setNotesOn, noteIndex, nextNote } = useUi();
  const { data, refresh } = useApi<DemoState>('/demo/state', { interval: 2000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [stagedVisible, setStagedVisible] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('hide-simulated', !stagedVisible);
  }, [stagedVisible]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'Escape') {
        setDemoOpen(false);
        return;
      }
      if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDemoOpen(!useUi.getState().demoOpen);
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        nextNote();
      }
      if (['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        void act('scenario', e.key === '1' ? 'A' : e.key === '2' ? 'B' : 'C');
      }
      if (e.key.toLowerCase() === 'r' && e.shiftKey) {
        e.preventDefault();
        void act('reset');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const activeTrade = data?.trades?.[data.trades.length - 1];

  async function act(kind: string, value?: string) {
    setBusy(kind + (value ?? ''));
    try {
      if (kind === 'scenario') {
        await api('/demo/scenario', { method: 'POST', json: { id: value } });
        toast(`Scenario ${value} loaded`, 'Seed state restored.', 'success');
        router.push('/app');
        window.dispatchEvent(new Event('cashew:refresh'));
      } else if (kind === 'speed') {
        const factor = value === 'instant' ? 'instant' : Number(value);
        await api('/demo/speed', { method: 'POST', json: { factor } });
        toast('Speed updated', value === 'instant' ? 'Animations skipped.' : `${value}× speed.`, 'info');
      } else if (kind === 'respond') {
        await api('/demo/advance', { method: 'POST', json: { what: 'lenders-respond' } });
        toast('Lenders responded', 'All pending offers released.', 'success');
      } else if (kind === 'buyer') {
        await api('/demo/advance', { method: 'POST', json: { what: 'buyer-confirm', tradeId: activeTrade?.id } });
        toast('Buyer confirmed', 'Check 14 will pass.', 'success');
      } else if (kind === 'shipment') {
        await api('/demo/advance', { method: 'POST', json: { what: 'shipment', tradeId: activeTrade?.id } });
        toast('Shipment advanced', undefined, 'info');
      } else if (kind === 'repaid') {
        await api('/demo/advance', { method: 'POST', json: { what: 'repaid', tradeId: activeTrade?.id } });
        toast('Trade repaid', 'The Passport now has one more completed trade.', 'success');
      } else if (kind === 'duplicate-1' || kind === 'duplicate-2') {
        const res = await api<{ url?: string }>('/demo/advance', { method: 'POST', json: { what: kind } });
        toast('Duplicate attempt loaded', 'Run verification to see the registry check.', 'warn');
        if (res.url) router.push(res.url);
        else router.push('/app');
      } else if (kind === 'reset') {
        if (!window.confirm('Reset the demo to seed state?')) return;
        await api('/demo/reset', { method: 'POST', json: {} });
        toast('Demo reset', 'Seed state restored.', 'success');
        router.push('/app');
      }
      window.dispatchEvent(new Event('cashew:refresh'));
      refresh();
    } catch (e) {
      toast('Demo action failed', (e as Error).message, 'danger');
    } finally {
      setBusy(null);
    }
  }

  if (!demoOpen) {
    return (
      <button
        type="button"
        onClick={() => setDemoOpen(true)}
        className="fixed bottom-4 left-4 z-[65] flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-[12px] text-ink-2 shadow-md hover:border-ink-3"
      >
        <Zap size={14} className="text-accent" /> Demo controls <kbd className="mono rounded bg-canvas px-1">D</kbd>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-[65] w-[320px] rounded-card border border-line bg-surface shadow-md">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-2 text-[12px] font-semibold">
          <Zap size={14} className="text-accent" /> Demo controls
        </div>
        <button type="button" onClick={() => setDemoOpen(false)} aria-label="Hide demo controls">
          <X size={16} className="text-ink-3" />
        </button>
      </div>
      <div className="thin-scroll max-h-[70vh] space-y-3 overflow-y-auto p-3">
        <div>
          <div className="caption mb-1">Scenario</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['A', 'B', 'C'] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={data?.scenario === s ? 'primary' : 'secondary'}
                onClick={() => act('scenario', s)}
                loading={busy === 'scenario' + s}
              >
                {s}
              </Button>
            ))}
          </div>
          <div className="mt-1 text-[10px] leading-4 text-ink-3">
            {data?.scenario === 'B' ? 'Inconsistent trade (main story)' : data?.scenario === 'C' ? 'Duplicate attempt' : 'Clean trade'}
          </div>
        </div>

        <div>
          <div className="caption mb-1">Speed</div>
          <div className="grid grid-cols-4 gap-1.5">
            {['0.5', '1', '2', 'instant'].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={(s === 'instant' ? data?.speed === 1000 : data?.speed === Number(s)) ? 'primary' : 'secondary'}
                onClick={() => act('speed', s)}
              >
                {s === 'instant' ? 'Max' : `${s}×`}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => act('respond')} loading={busy === 'respond'}>
            Respond now
          </Button>
          <Button size="sm" variant="secondary" onClick={() => act('buyer')} loading={busy === 'buyer'}>
            Buyer confirms
          </Button>
          <Button size="sm" variant="secondary" onClick={() => act('shipment')} loading={busy === 'shipment'}>
            Advance shipment
          </Button>
          <Button size="sm" variant="secondary" onClick={() => act('repaid')} loading={busy === 'repaid'}>
            Advance to repaid
          </Button>
        </div>

        <div>
          <div className="caption mb-1">Registry</div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => act('duplicate-1')} loading={busy === 'duplicate-1'}>
              Duplicate 1
            </Button>
            <Button size="sm" variant="secondary" onClick={() => act('duplicate-2')} loading={busy === 'duplicate-2'}>
              Duplicate 2
            </Button>
          </div>
        </div>

        <div className="space-y-1.5 border-t border-line pt-3">
          <label className="flex items-center justify-between text-[12px] text-ink-2">
            Presenter notes
            <input
              type="checkbox"
              checked={notesOn}
              onChange={(e) => setNotesOn(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)]"
            />
          </label>
          <label className="flex items-center justify-between text-[12px] text-ink-2">
            Show “simulated” labels
            <input
              type="checkbox"
              checked={stagedVisible}
              onChange={(e) => setStagedVisible(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)]"
            />
          </label>
        </div>

        <div className="rounded-lg bg-canvas px-2 py-1.5 text-[11px] leading-4 text-ink-2">
          <div className="flex items-center justify-between">
            <span>Note {noteIndex + 1}/{PRESENTER_NOTES.length}</span>
            <span className="flex gap-1">
              <button
                type="button"
                aria-label="Previous note"
                onClick={() => useUi.setState({ noteIndex: Math.max(0, noteIndex - 1) })}
              >
                <ChevronLeft size={13} />
              </button>
              <button type="button" aria-label="Next note" onClick={nextNote}>
                <ChevronRight size={13} />
              </button>
            </span>
          </div>
          <div className="mt-1 line-clamp-2 text-ink-3">{PRESENTER_NOTES[noteIndex]}</div>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-3">
          <Button size="sm" variant="ghost" onClick={() => act('reset')} icon={<RotateCcw size={13} />}>
            Reset demo
          </Button>
          <span className="text-[10px] text-ink-3">{data?.registryCount ?? 0} registry entries</span>
        </div>
        <div className="text-[10px] leading-4 text-ink-3">
          <kbd className="mono rounded bg-canvas px-1">D</kbd> panel · <kbd className="mono rounded bg-canvas px-1">N</kbd> next
          note · <kbd className="mono rounded bg-canvas px-1">1-3</kbd> scenario ·{' '}
          <kbd className="mono rounded bg-canvas px-1">Esc</kbd> close
        </div>
      </div>
    </div>
  );
}
