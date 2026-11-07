'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BadgeCheck,
  Building2,
  ChevronDown,
  ClipboardList,
  FileText,
  Inbox,
  LayoutDashboard,
  Package,
  PlusSquare,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import { useEffect } from 'react';
import { api, useApi, toast } from '@/lib/client';
import { cn } from '@/lib/cn';
import { PresenterNoteBar } from './DemoRibbon';
import { DemoPanel } from './DemoPanel';
import { Toaster } from './Toaster';

interface Session {
  role: 'exporter' | 'lender' | 'ops';
  orgId: string;
  org: { legalName: string; id: string } | null;
  scenario: 'A' | 'B' | 'C';
  lenders: { id: string; legalName: string }[];
}

const NAV = {
  exporter: [
    { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/app/trades/new', label: 'New trade', icon: PlusSquare },
    { href: '/app/trades', label: 'Trades', icon: FileText },
    { href: '/app/passport', label: 'Passport', icon: BadgeCheck },
    { href: '/app/m', label: 'Mobile view', icon: Smartphone },
  ],
  lender: [
    { href: '/lender', label: 'Inbox', icon: Inbox },
    { href: '/lender/products', label: 'Products', icon: Package },
    { href: '/registry', label: 'Registry check', icon: ShieldCheck },
  ],
  ops: [
    { href: '/ops', label: 'Review queue', icon: ClipboardList },
    { href: '/ops?tab=audit', label: 'Audit log', icon: FileText },
    { href: '/registry', label: 'Registry', icon: ShieldCheck },
  ],
};

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useApi<Session>('/orgs/me', { interval: 4000 });
  const bare = pathname === '/' || pathname === '/kit';
  const pathRole: 'exporter' | 'lender' | 'ops' | null = pathname.startsWith('/lender')
    ? 'lender'
    : pathname.startsWith('/ops')
      ? 'ops'
      : pathname.startsWith('/app')
        ? 'exporter'
        : null;
  const role = pathRole ?? data?.role ?? 'exporter';
  const nav = bare ? [] : NAV[role];
  const currentRoleForPath = pathRole ?? role;

  useEffect(() => {
    // keep the shell on the role implied by the area the user is viewing
    if (bare) return;
    if (data?.role && currentRoleForPath !== data.role) {
      void api('/session', { method: 'POST', json: { role: currentRoleForPath } }).catch(() => undefined);
    }
  }, [currentRoleForPath, data?.role, bare]);

  async function switchRole(next: string) {
    await api('/session', { method: 'POST', json: { role: next } });
    toast('Role switched', next === 'exporter' ? 'Exporter: Kaveri Textiles' : next === 'lender' ? 'Lender: Banyan Capital' : 'Ops: Asha', 'info');
    router.push(next === 'exporter' ? '/app' : next === 'lender' ? '/lender' : '/ops');
    window.dispatchEvent(new Event('cashew:refresh'));
  }

  async function switchLender(orgId: string) {
    await api('/session', { method: 'POST', json: { role: 'lender', orgId } });
    toast('Lender switched', data?.lenders.find((l) => l.id === orgId)?.legalName ?? orgId, 'info');
    window.dispatchEvent(new Event('cashew:refresh'));
    router.refresh();
  }

  return (
    <div className="relative min-h-screen">
      <PresenterNoteBar />
      {bare ? (
        children
      ) : (
        <div className="flex">
          <aside className="hidden w-[248px] shrink-0 border-r border-line bg-[#fbf8f2] md:block">
            <div className="sticky top-0 flex h-[calc(100vh-24px)] flex-col px-4 py-5">
              <Link href="/" className="mb-6 flex items-center gap-2 px-2" aria-label="Cashew home">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent/10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 3c4.5 0 8 3.4 8 7.7 0 4.6-4 8.6-8 10.3-4-1.7-8-5.7-8-10.3C4 6.4 7.5 3 12 3Z"
                      stroke="var(--accent)"
                      strokeWidth="1.7"
                    />
                    <path d="M12 5.5v13.5" stroke="var(--accent)" strokeWidth="1.3" opacity=".55" />
                  </svg>
                </span>
                <span className="font-display text-[20px] font-semibold leading-none tracking-tight">Cashew</span>
              </Link>
              <nav className="space-y-1">
                {nav.map((item) => {
                  const active =
                    item.href === '/app'
                      ? pathname === '/app'
                      : item.href.includes('?')
                        ? pathname === item.href.split('?')[0]
                        : pathname === item.href || pathname.startsWith(item.href + '/');
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
                        active ? 'bg-brand-soft font-medium text-brand' : 'text-ink-2 hover:bg-canvas hover:text-ink',
                      )}
                    >
                      <Icon size={18} strokeWidth={1.75} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-auto space-y-2 border-t border-line pt-4">
                <div className="flex items-center gap-2 px-2 text-[11px] text-ink-3">
                  <span className={cn('h-1.5 w-1.5 rounded-full', data?.scenario === 'C' ? 'bg-warn' : 'bg-success')} />
                  Scenario {data?.scenario ?? 'B'} <span className="text-line">·</span> Demo
                </div>
                <Link
                  href="/app/m"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-ink-3 hover:bg-canvas hover:text-ink"
                >
                  <Smartphone size={15} /> Mobile frame
                </Link>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="flex h-16 items-center justify-between border-b border-line bg-surface/80 px-6 backdrop-blur">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Building2 size={16} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-ink">
                    {role === data?.role && data?.org?.legalName
                      ? data.org.legalName
                      : role === 'ops'
                        ? 'Cashew'
                        : role === 'lender'
                          ? 'Banyan Capital'
                          : 'Kaveri Textiles Pvt Ltd'}
                  </div>
                  <div className="text-[11px] leading-4 text-ink-3">
                    {role === 'exporter' ? 'Exporter workspace' : role === 'lender' ? 'Lender portal' : 'Cashew operations'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {role === 'lender' && data?.lenders && (
                  <div className="relative hidden sm:block">
                    <select
                      aria-label="Switch lender"
                      value={data.orgId}
                      onChange={(e) => switchLender(e.target.value)}
                      className="h-9 appearance-none rounded-btn border border-line bg-surface pl-3 pr-8 text-[12px] text-ink-2"
                    >
                      {data.lenders.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.legalName}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-2 top-3 text-ink-3" />
                  </div>
                )}
                <div className="relative">
                  <select
                    aria-label="Switch role"
                    value={role}
                    onChange={(e) => switchRole(e.target.value)}
                    className="h-9 appearance-none rounded-btn border border-line bg-surface pl-3 pr-8 text-[12px] text-ink-2"
                  >
                    <option value="exporter">Exporter</option>
                    <option value="lender">Lender</option>
                    <option value="ops">Ops</option>
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2 top-3 text-ink-3" />
                </div>
                <div className="ml-1 hidden items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[11px] text-ink-2 lg:flex">
                  <Users size={12} /> Demo
                </div>
              </div>
            </header>

            <main className="mx-auto w-full max-w-content px-8 py-7">{children}</main>
            {pathname.startsWith('/app/m') && (
              <div className="pointer-events-none fixed bottom-4 right-4 z-10 hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] text-ink-3 shadow-sm lg:flex">
                Phone actions appear on the desktop within 1 second
              </div>
            )}
          </div>
        </div>
      )}
      <Toaster />
      <DemoPanel />
    </div>
  );
}
