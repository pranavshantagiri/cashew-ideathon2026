'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRESENTER_NOTES, useUi } from '@/lib/client';

export function DemoRibbon() {
  return (
    <div className="fixed inset-x-0 top-0 z-[70]">
      <div className="flex h-6 items-center justify-center gap-2 bg-accent-soft px-4 text-center text-[12px] leading-4 text-[#8a531c]">
        <span className="hidden h-1.5 w-1.5 rounded-full bg-accent sm:inline-block" />
        <span className="truncate">
          <strong className="font-semibold">DEMO ENVIRONMENT.</strong> External data sources are simulated. Press D for
          demo controls.
        </span>
        <Link href="/kit" className="hidden shrink-0 underline decoration-accent/40 underline-offset-2 sm:inline">
          Component kit
        </Link>
      </div>
    </div>
  );
}

export function PresenterNoteBar() {
  const notesOn = useUi((s) => s.notesOn);
  const noteIndex = useUi((s) => s.noteIndex);
  const pathname = usePathname();
  if (!notesOn || pathname === '/') return null;
  return (
    <div className="border-b border-line/80 bg-[#fffaf0] px-4 py-1 text-center text-[11px] leading-4 text-ink-2">
      <span className="font-medium text-ink-3">Presenter:</span> {PRESENTER_NOTES[noteIndex]}
    </div>
  );
}

