'use client';

import {
  BadgeCheck,
  CheckCircle2,
  Copy,
  Download,
  FileJson,
  Fingerprint,
  PencilLine,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, toast, useApi } from '@/lib/client';
import { verifyPassport, type PassportLike, type VerifyResult } from '@/lib/passport-client';
import { Button } from '@/components/Button';
import { StatusChip } from '@/components/StatusChip';
import { HashPill } from '@/components/HashPill';
import { Modal } from '@/components/Overlays';
import { EmptyState } from '@/components/EmptyState';
import { dateOnly, dateTime, inr } from '@/lib/format';
import type { TradeHistory } from '@/lib/types';

interface SessionRes {
  orgId: string;
  org: { id: string; legalName: string; tier?: number } | null;
  scenario: string;
}

interface PassportRes {
  passport: PassportLike & {
    claims: {
      tier: number;
      entityChecks: Record<string, string>;
      completedTrades: number;
      deliveredOnTime: number;
      repaidOnTime: number;
      totalFinancedInr: number;
    };
  };
  history: TradeHistory[];
}

const LENDERS = ['Meridian Bank', 'Banyan Capital', 'Tidewater Finance', 'Northgate Apparel Ltd'];

const TIER_COPY: Record<number, string> = {
  0: 'No completed trades yet',
  1: 'Tier 1 — first trade completed',
  2: 'Tier 2 — repeat exporter',
  3: 'Tier 3 — established track record',
};

export default function PassportPage() {
  const { data: session } = useApi<SessionRes>('/orgs/me', { interval: 6000 });
  const { data, loading, refresh } = useApi<PassportRes>(
    session?.orgId ? `/passport/${session.orgId}` : null,
    { interval: 6000 },
  );

  const [credential, setCredential] = useState<PassportLike | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [tampered, setTampered] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [recipient, setRecipient] = useState(LENDERS[0]);
  const [purpose, setPurpose] = useState('Credit assessment');
  const [sharing, setSharing] = useState(false);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    if (!data?.passport) return;
    const fresh = data.passport as unknown as PassportLike;
    setCredential(fresh);
    setTampered(null);
    setResult(null);
    let alive = true;
    void verifyPassport(fresh).then((r) => {
      if (alive) setResult(r);
    });
    return () => {
      alive = false;
    };
  }, [data?.passport]);

  const claims = credential?.claims as PassportRes['passport']['claims'] | undefined;

  async function verifyNow() {
    if (!credential) return;
    setVerifying(true);
    const r = await verifyPassport(credential);
    setResult(r);
    setVerifying(false);
  }

  function tamper(what: 'trades' | 'financed' | 'tier') {
    if (!credential) return;
    const next = JSON.parse(JSON.stringify(credential)) as PassportLike;
    const c = next.claims as PassportRes['passport']['claims'];
    if (what === 'trades') {
      c.completedTrades += 1;
      setTampered('One extra completed trade added to the claims.');
    } else if (what === 'financed') {
      c.totalFinancedInr += 500_000;
      setTampered('₹5,00,000 added to total financed.');
    } else {
      c.tier = Math.min(3, c.tier + 1);
      setTampered('Passport tier raised by one.');
    }
    setCredential(next);
    setResult(null);
    void verifyPassport(next).then(setResult);
  }

  function restore() {
    if (data?.passport) {
      const fresh = data.passport as unknown as PassportLike;
      setCredential(fresh);
      setTampered(null);
      void verifyPassport(fresh).then(setResult);
    }
  }

  async function share() {
    if (!session?.orgId) return;
    setSharing(true);
    try {
      const res = await api<{ passport: PassportLike }>('/passport/share', {
        method: 'POST',
        json: { orgId: session.orgId, recipient, purpose },
      });
      setCredential(res.passport);
      void verifyPassport(res.passport).then(setResult);
      setShareOpen(false);
      toast('Passport shared', `A signed credential was issued to ${recipient}.`, 'success');
      refresh();
    } catch (e) {
      toast('Could not share the Passport', (e as Error).message, 'danger');
    } finally {
      setSharing(false);
    }
  }

  async function copyJson() {
    if (!credential) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(credential, null, 2));
      toast('Credential JSON copied', 'Paste it into any verifier that carries the demo public key.', 'success');
    } catch {
      setShowJson(true);
      toast('Copy blocked by the browser', 'The raw credential is open below; select and copy it.', 'info');
    }
  }

  function downloadJson() {
    if (!credential) return;
    const blob = new Blob([JSON.stringify(credential, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashew-trade-passport-${session?.orgId ?? 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!session && loading) {
    return <div className="card p-10 text-center text-[13px] text-ink-3">Loading Passport…</div>;
  }

  if (!data || !credential || !claims) {
    return (
      <div className="card">
        <EmptyState
          title="No Passport yet"
          body="Complete and repay one trade. The Passport is a signed credential, not a self-declared profile."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="caption mb-1">Exporter workspace</div>
          <h1 className="h1">Trade Passport</h1>
          <p className="mt-1 max-w-xl text-[13px] leading-5 text-ink-2">
            A portable, signed record of what this business has actually completed. The signature is checked in your
            browser; no server round-trip and no registry lookup are needed.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Send size={15} />} onClick={() => setShareOpen(true)}>
            Share Passport
          </Button>
          <Button variant="secondary" icon={<Download size={15} />} onClick={downloadJson}>
            Download JSON
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* credential card */}
        <div className="space-y-4">
          <section className="relative overflow-hidden rounded-card border border-[#173c2d] bg-brand p-6 text-[#f4f1e8] shadow-md">
            <div className="pointer-events-none absolute inset-0 opacity-25 grid-lines" aria-hidden />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#c8d8cf]">
                    <BadgeCheck size={15} /> Cashew · Trade Passport
                  </div>
                  <div className="mt-2 font-display text-[26px] font-semibold leading-8">
                    {credential.subject.legalName}
                  </div>
                  <div className="text-[12px] text-[#c8d8cf]">
                    {session?.org?.legalName ? session.org.legalName : credential.subject.orgId} · verified exporter
                  </div>
                </div>
                <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-[#c8d8cf]">Tier</div>
                  <div className="font-display text-[24px] leading-7">{claims.tier}</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Claim label="Completed trades" value={String(claims.completedTrades)} />
                <Claim label="Repaid on time" value={`${claims.repaidOnTime}/${claims.completedTrades}`} />
                <Claim label="Delivered on time" value={`${claims.deliveredOnTime}/${claims.completedTrades}`} />
                <Claim label="Total financed" value={inr(claims.totalFinancedInr)} />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {Object.entries(claims.entityChecks).map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#dfe9e3]"
                  >
                    {value === 'pass' ? <CheckCircle2 size={10} /> : <XCircle size={10} />} {key}
                  </span>
                ))}
              </div>

              <div className="mt-5 border-t border-white/15 pt-3 text-[10px] leading-4 text-[#b9cdc2]">
                Issued by {credential.issuer} on {dateOnly(credential.issuedAt)} · expires{' '}
                {dateOnly(credential.expiresAt)}. Consent: {credential.consent.recipient} · {credential.consent.purpose}.
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 font-mono text-[10px] text-[#dfe9e3]">
                  <Fingerprint size={11} /> {credential.proof.type} signature
                </span>
                <span className="font-mono text-[10px] text-[#b9cdc2]">
                  key {shorten(credential.proof.publicKey, 18)}
                </span>
              </div>
            </div>
          </section>

          <section className="card p-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="h3">Track record</div>
                <div className="text-[12px] text-ink-3">Every row is a trade completed through Cashew.</div>
              </div>
              <span className="text-[11px] text-ink-3">{TIER_COPY[claims.tier]}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-left text-[11px] uppercase tracking-wide text-ink-3">
                  <tr>
                    <th className="py-2 font-medium">Completed</th>
                    <th className="py-2 font-medium">Value</th>
                    <th className="py-2 font-medium">Delivered on time</th>
                    <th className="py-2 font-medium">Repaid on time</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.history ?? []).map((h) => (
                    <tr key={h.id} className="border-t border-line">
                      <td className="py-2 text-ink-2">{dateOnly(h.completedAt)}</td>
                      <td className="py-2 tabular text-ink">{inr(h.value)}</td>
                      <td className="py-2">
                        <StatusChip status={h.deliveredOnTime ? 'pass' : 'fail'} label={h.deliveredOnTime ? 'Yes' : 'No'} size="sm" />
                      </td>
                      <td className="py-2">
                        <StatusChip status={h.repaidOnTime ? 'pass' : 'fail'} label={h.repaidOnTime ? 'Yes' : 'No'} size="sm" />
                      </td>
                    </tr>
                  ))}
                  {!data.history?.length && (
                    <tr>
                      <td className="py-4 text-ink-3" colSpan={4}>
                        No completed trades yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] leading-4 text-ink-3">
              {claims.completedTrades >= 4
                ? 'Tier 3 unlocked. The next Passport carries the established-track-record claim.'
                : `${Math.max(0, 4 - claims.completedTrades)} more completed trade(s) unlock Tier 3.`}
            </p>
          </section>

          <section className="card p-6">
            <div className="mb-2 flex items-center justify-between">
              <div className="h3">Consent and reuse</div>
              <StatusChip status="info" label="Scoped, expiring consent" size="sm" />
            </div>
            <p className="text-[12px] leading-5 text-ink-2">
              Sharing issues a fresh signed credential for one recipient and purpose. The recipient can verify the
              signature locally. The Passport does not expose documents, bank details or buyer-level information.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-canvas px-3 py-2">
                <div className="caption">Current consent</div>
                <div className="text-[12px] font-medium text-ink">{credential.consent.recipient}</div>
                <div className="text-[11px] text-ink-3">
                  {credential.consent.purpose} · expires {credential.consent.expiry}
                </div>
              </div>
              <div className="rounded-lg border border-line bg-canvas px-3 py-2">
                <div className="caption">Credential id</div>
                <div className="mono break-all text-[11px] text-ink-2">{credential.id}</div>
              </div>
            </div>
          </section>
        </div>

        {/* verification and sharing */}
        <aside className="space-y-4">
          <section className="card p-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="caption">Verify in this browser</div>
              <StatusChip status="info" label={result?.method ?? 'waiting'} size="sm" />
            </div>
            <VerificationResult result={result} verifying={verifying} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="compact" variant="secondary" onClick={verifyNow} loading={verifying} icon={<RefreshCw size={14} />}>
                Verify again
              </Button>
              {tampered && (
                <Button size="compact" variant="ghost" onClick={restore}>
                  Restore credential
                </Button>
              )}
            </div>
            <div className="mt-4 border-t border-line pt-3">
              <div className="caption mb-1">Tamper test</div>
              <p className="mb-2 text-[11px] leading-4 text-ink-3">
                Change one claim and verify again. The Ed25519 signature covers every claim; any change breaks it.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => tamper('trades')} icon={<PencilLine size={12} />}>
                  Add a trade
                </Button>
                <Button size="sm" variant="secondary" onClick={() => tamper('financed')} icon={<PencilLine size={12} />}>
                  Add ₹5L
                </Button>
                <Button size="sm" variant="secondary" onClick={() => tamper('tier')} icon={<PencilLine size={12} />}>
                  Raise tier
                </Button>
              </div>
              {tampered && <p className="mt-2 text-[11px] leading-4 text-warn">{tampered}</p>}
            </div>
          </section>

          <section className="card p-5">
            <div className="caption mb-2">Proof</div>
            <div className="space-y-2">
              <HashPill hash={credential.proof.publicKey} label="Public key" />
              <HashPill hash={credential.proof.signature} label="Signature" />
            </div>
            <p className="mt-3 text-[11px] leading-4 text-ink-3">
              Ed25519, verified with the Web Crypto API, with a bundled verifier as fallback. The signature is checked
              against the credential as issued; the public key travels inside the credential.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" onClick={copyJson} icon={<Copy size={12} />}>
                Copy JSON
              </Button>
              <Button size="sm" variant="secondary" onClick={downloadJson} icon={<Download size={12} />}>
                Download
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowJson((v) => !v)} icon={<FileJson size={12} />}>
                {showJson ? 'Hide raw' : 'View raw'}
              </Button>
            </div>
            {showJson && (
              <pre className="thin-scroll mt-3 max-h-64 overflow-auto rounded-lg border border-line bg-[#fcfaf5] p-2 font-mono text-[10px] leading-4 text-ink-2">
                {JSON.stringify(credential, null, 2)}
              </pre>
            )}
          </section>

          <section className="card p-5">
            <div className="caption mb-2">What a lender sees</div>
            <ul className="space-y-1.5 text-[12px] leading-5 text-ink-2">
              <li>• The claims above, signed and dated.</li>
              <li>• Entity checks and a tier, not the underlying documents.</li>
              <li>• A validity window and the purpose you consented to.</li>
              <li>• No commission, no ranking and no other lender&apos;s offer.</li>
            </ul>
            <Button className="mt-3 w-full" size="compact" onClick={() => setShareOpen(true)} icon={<Send size={14} />}>
              Share with a lender
            </Button>
          </section>
        </aside>
      </div>

      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share the Trade Passport"
        subtitle="A new credential is signed for this recipient and purpose."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShareOpen(false)}>
              Cancel
            </Button>
            <Button onClick={share} loading={sharing} icon={<Send size={14} />}>
              Sign and share
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-2">Recipient</label>
            <select
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="h-10 w-full rounded-input border border-line bg-surface px-3 text-[13px]"
            >
              {LENDERS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-2">Purpose</label>
            <input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="h-10 w-full rounded-input border border-line bg-surface px-3 text-[13px]"
              placeholder="Credit assessment"
            />
          </div>
          <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-[11px] leading-4 text-ink-3">
            Consent expires after 30 days. Sharing does not expose documents; the recipient receives a signed set of
            claims they can verify offline.
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="caption mb-1">Preview: will be included</div>
            <div className="text-[12px] text-ink-2">
              {claims.completedTrades} completed trades · {inr(claims.totalFinancedInr)} financed · Tier {claims.tier} ·{' '}
              {claims.repaidOnTime} repaid on time
            </div>
          </div>
        </div>
      </Modal>

      {loading && (
        <div className="text-center text-[11px] text-ink-3">Refreshing credential…</div>
      )}
    </div>
  );
}

function VerificationResult({ result, verifying }: { result: VerifyResult | null; verifying: boolean }) {
  if (verifying) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] text-ink-2">
        <RefreshCw size={15} className="animate-spin text-brand" /> Checking the signature…
      </div>
    );
  }
  if (!result) {
    return (
      <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] text-ink-2">
        Checking the credential…
      </div>
    );
  }
  if (result.valid) {
    return (
      <div className="rounded-lg border border-success/20 bg-success-soft px-3 py-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-success">
          <ShieldCheck size={17} /> Valid signature
        </div>
        <div className="mt-0.5 text-[11px] leading-4 text-[#2f6b52]">
          Every claim matches the signature. Verified with {result.method} in this browser.
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-danger">
        <ShieldAlert size={17} /> Signature does not match
      </div>
      <div className="mt-0.5 text-[11px] leading-4 text-[#8c2e25]">
        {result.reason ?? 'One or more claims were changed after the credential was signed.'}
      </div>
    </div>
  );
}

function Claim({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[#b9cdc2]">{label}</div>
      <div className="mt-0.5 font-display text-[18px] leading-6 tabular">{value}</div>
    </div>
  );
}

function shorten(value: string, n: number): string {
  if (!value) return '—';
  return value.length > n ? `${value.slice(0, n / 2)}…${value.slice(-n / 2)}` : value;
}
