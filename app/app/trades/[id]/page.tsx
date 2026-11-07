'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Check,
  CheckCircle2,
  Clock3,
  FileSignature,
  Flag,
  Landmark,
  PencilLine,
  ShieldCheck,
  Smartphone,
  Truck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, toast, useApi } from '@/lib/client';
import { Button } from '@/components/Button';
import { StatusChip, BandChip, SourceChip } from '@/components/StatusChip';
import { HashPill } from '@/components/HashPill';
import { Timeline, TRADE_MILESTONES, tradeMilestoneIndex, SHIPMENT_MILESTONES } from '@/components/Timeline';
import { VerificationBoard, type EvidenceResponse } from '@/components/VerificationBoard';
import { DocumentsTab } from '@/components/DocumentsTab';
import { OfferComparison, type OfferWithMath } from '@/components/OfferComparison';
import { EmptyState } from '@/components/EmptyState';
import { Modal } from '@/components/Overlays';
import { inr, usd, dateOnly, dateTime, pct, timeAgo, STATUS_LABELS } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { AuditEvent, ConsentArtefact, RiskProfile, Trade } from '@/lib/types';

interface TradeRes {
  trade: Trade;
  buyer: { name: string; country: string; registrationId: string; rating?: string };
  exporter: { legalName: string };
  risk: RiskProfile;
}
interface OffersRes {
  offers: OfferWithMath[];
  pending: string[];
  request: { requestedAt: string; eligible: string[]; excluded: { lenderId: string; reasons: string[] }[] } | null;
  trade: Trade;
}
interface AuditRes {
  events: AuditEvent[];
}

const TABS = [
  ['overview', 'Overview'],
  ['documents', 'Documents'],
  ['verification', 'Verification'],
  ['offers', 'Offers'],
  ['financing', 'Financing'],
  ['tracking', 'Tracking'],
  ['activity', 'Activity'],
] as const;

export default function TradeWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const tab = (search.get('tab') as (typeof TABS)[number][0]) ?? 'overview';
  const { data: tradeRes, refresh: refreshTrade } = useApi<TradeRes>(id ? `/trades/${id}` : null, { interval: 1500 });
  const { data: evidence, refresh: refreshEvidence } = useApi<EvidenceResponse>(id ? `/trades/${id}/evidence` : null, {
    interval: tab === 'verification' ? 500 : 1200,
  });
  const { data: offersData, refresh: refreshOffers } = useApi<OffersRes>(id ? `/trades/${id}/offers` : null, {
    interval: 1000,
  });
  const { data: audit, refresh: refreshAudit } = useApi<AuditRes>(id ? `/audit?tradeId=${id}` : null, {
    interval: 2500,
  });

  const [accepting, setAccepting] = useState<OfferWithMath | null>(null);
  const [phase, setPhase] = useState<'confirm' | 'otp' | 'done'>('confirm');
  const [agreed, setAgreed] = useState(false);
  const [otp, setOtp] = useState('');
  const [sms, setSms] = useState<{ text: string } | null>(null);
  const [opening, setOpening] = useState(false);

  const trade = tradeRes?.trade ?? evidence?.trade;
  const offers = offersData?.offers ?? [];
  const accepted = offers.find((o) => o.status === 'accepted');
  const excluded = offersData?.request?.excluded ?? [];

  const strength = evidence?.risk ?? tradeRes?.risk;
  const next = trade ? nextStep(trade, offers.length, evidence) : null;

  useEffect(() => {
    if (trade?.status === 'FINANCED' && accepting) {
      // keep the success modal visible; nothing else to do
    }
  }, [trade?.status, accepting]);

  function setTab(nextTab: string) {
    router.replace(`/app/trades/${id}?tab=${nextTab}`);
  }

  async function runVerification() {
    try {
      await api(`/trades/${id}/verify`, { method: 'POST', json: {} });
      toast('Verification started', 'Fourteen checks run in sequence.', 'info');
      refreshEvidence();
    } catch (e) {
      toast('Could not start verification', (e as Error).message, 'danger');
    }
  }

  async function uploadAmended() {
    try {
      await api(`/trades/${id}/documents`, {
        method: 'POST',
        json: { docType: 'invoice', amended: true, filename: 'invoice-amended-sample.pdf' },
      });
      toast('Amended invoice uploaded', 'Check 8 is re-running.', 'success');
      refreshEvidence();
      refreshTrade();
    } catch (e) {
      toast('Upload failed', (e as Error).message, 'danger');
    }
  }

  async function flagCheck() {
    await api(`/trades/${id}/flag`, { method: 'POST', json: { checkIds: [8] } });
    toast('Flagged to lenders', 'The failure will be shown honestly.', 'warn');
    refreshEvidence();
    refreshTrade();
  }

  async function openToLenders() {
    setOpening(true);
    try {
      const res = await api<{ eligible: string[] }>(`/trades/${id}/offer-requests`, { method: 'POST', json: {} });
      toast('Trade opened to lenders', `${res.eligible.length} lenders received the verified trade.`, 'success');
      refreshOffers();
      refreshTrade();
      refreshEvidence();
      setTab('offers');
    } catch (e) {
      toast('Could not open to lenders', (e as Error).message, 'danger');
    } finally {
      setOpening(false);
    }
  }

  async function confirmAccept() {
    if (!accepting) return;
    try {
      await api(`/offers/${accepting.id}/accept`, { method: 'POST', json: {} });
      setPhase('otp');
      refreshOffers();
      refreshTrade();
      refreshAudit();
    } catch (e) {
      toast('Could not accept offer', (e as Error).message, 'danger');
    }
  }

  async function sign() {
    if (!accepting || otp.length < 6) return;
    try {
      await api(`/offers/${accepting.id}/sign`, { method: 'POST', json: { otp } });
      setPhase('done');
      setSms({
        text: `${trade?.smeId === 'org_cks' ? 'Coimbatore Knit Studio' : 'Kaveri Textiles'}: ${inr(
          accepting.math.netCash,
        )} disbursed against INV ${invoiceNo(evidence)}. Repayment due in ${accepting.tenureDays} days.`,
      });
      toast('Signed and sent to the lender', 'The staged disbursal lands in 2 seconds.', 'success');
      refreshOffers();
      refreshTrade();
      refreshEvidence();
      refreshAudit();
      setTimeout(() => {
        refreshTrade();
        refreshEvidence();
        refreshOffers();
      }, 2300);
      setTimeout(() => setTab('financing'), 2400);
    } catch (e) {
      toast('Could not sign', (e as Error).message, 'danger');
    }
  }

  if (!trade) {
    return (
      <div className="card p-10 text-center text-[13px] text-ink-3">
        {tradeRes ? 'Trade not found or no consent.' : 'Loading trade…'}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/app/trades" className="mb-2 inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink">
            <ArrowLeft size={14} /> Trades
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="h2 mono !font-mono !text-[20px]">{trade.id}</h1>
            <StatusChip status={statusChip(trade.status)} label={STATUS_LABELS[trade.status] ?? trade.status} />
            {strength && <BandChip band={strength.band} />}
          </div>
          <div className="mt-1 text-[13px] text-ink-2">
            {tradeRes?.buyer?.name ?? 'Buyer'} · {trade.goods} · <span className="tabular">{usd(trade.value / trade.fx)}</span>{' '}
            <span className="text-ink-3">({inr(trade.value)} @ {trade.fx.toFixed(2)})</span>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <HashPill hash={evidence?.bundle.bundleHash ?? ''} label="Evidence" />
        </div>
      </div>

      <div className="card px-6 py-4">
        <Timeline items={TRADE_MILESTONES} current={tradeMilestoneIndex(trade.status)} compact />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'relative whitespace-nowrap px-3 py-2.5 text-[13px] transition-colors',
              tab === key ? 'font-medium text-brand' : 'text-ink-2 hover:text-ink',
            )}
          >
            {label}
            {key === 'offers' && offers.length > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] text-brand">{offers.length}</span>
            )}
            {tab === key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-brand" />}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <section className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="h3">Trade summary</div>
                <span className="text-[11px] text-ink-3">Scenario {trade.scenario}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <dl className="space-y-2 text-[13px]">
                  <KV label="Exporter" value={tradeRes?.exporter?.legalName} />
                  <KV label="Buyer" value={`${tradeRes?.buyer?.name ?? '—'} · ${tradeRes?.buyer?.country ?? 'GB'}`} />
                  <KV label="Buyer registration" value={tradeRes?.buyer?.registrationId} />
                  <KV label="Corridor" value={trade.corridor} />
                  <KV label="HS code" value={trade.hsCode} />
                </dl>
                <dl className="space-y-2 text-[13px]">
                  <KV label="Invoice value" value={`${usd(trade.value / trade.fx)} (${inr(trade.value)} @ ${trade.fx.toFixed(2)})`} />
                  <KV label="Incoterm" value={trade.incoterm} />
                  <KV label="Payment terms" value={`${trade.paymentTermsDays} days`} />
                  <KV label="Documents" value={`${evidence?.docs.length ?? 0} attached`} />
                  <KV label="Flagged to lenders" value={evidence?.flagged.length ? `Checks ${evidence.flagged.join(', ')}` : 'None'} />
                </dl>
              </div>
            </section>

            <section className="card p-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="h3">Consent and evidence</div>
                {trade.status === 'VERIFIED' && (
                  <Button size="compact" onClick={openToLenders} loading={opening}>
                    Open to lenders
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {(evidence as EvidenceResponse & { consents?: ConsentArtefact[] })?.consents?.length ? (
                  (evidence as EvidenceResponse & { consents?: ConsentArtefact[] }).consents!.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                      <div className="text-[12px]">
                        <span className="font-medium text-ink">{c.recipientOrgId.replace('lender_', '')}</span>
                        <span className="text-ink-3"> · {c.purpose}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-ink-3">
                        <StatusChip status={c.revokedAt ? 'warn' : 'pass'} label={c.revokedAt ? 'Revoked' : 'Active'} size="sm" />
                        Expires {dateOnly(c.expiresAt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-ink-3">No consent yet. Verification must complete first.</p>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            {next && (
              <div className="card p-5">
                <div className="caption mb-2">Next step</div>
                <div className="text-[15px] font-semibold">{next.title}</div>
                <p className="mt-1 text-[12px] leading-5 text-ink-2">{next.body}</p>
                <Button
                  className="mt-3 w-full"
                  size="compact"
                  variant={next.action === 'open' ? 'primary' : 'secondary'}
                  onClick={() => {
                    if (next.action === 'open') void openToLenders();
                    else if (next.action === 'verify') setTab('verification');
                    else if (next.action === 'offers') setTab('offers');
                    else if (next.action === 'financing') setTab('financing');
                    else if (next.action === 'tracking') setTab('tracking');
                    else if (next.action === 'passport') router.push('/app/passport');
                    else setTab('verification');
                  }}
                  loading={next.action === 'open' && opening}
                >
                  {next.cta}
                </Button>
              </div>
            )}
            <StrengthCard strength={strength} />
          </aside>
        </div>
      )}

      {tab === 'documents' && <DocumentsTab docs={evidence?.docs ?? []} />}

      {tab === 'verification' && (
        <div className="card p-6">
          <div className="mb-4">
            <div className="h3">Verification</div>
            <div className="text-[12px] text-ink-3">
              Every check has a source and an evidence reference. Click a completed row to inspect it.
            </div>
          </div>
          <VerificationBoard
            evidence={evidence}
            onRun={runVerification}
            running={Boolean(evidence?.run)}
            onAmended={uploadAmended}
            onFlag={flagCheck}
            canAct={trade.status !== 'REPAID'}
          />
        </div>
      )}

      {tab === 'offers' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="h3">Offers</div>
              <div className="text-[12px] text-ink-3">
                Three lenders, one evidence bundle, sealed offers normalised into a single comparison.
              </div>
            </div>
            {offersData?.request?.requestedAt && (
              <span className="text-[11px] text-ink-3">Requested {timeAgo(offersData.request.requestedAt)}</span>
            )}
          </div>
          <OfferComparison
            trade={trade}
            offers={offers}
            pending={offersData?.pending ?? []}
            excluded={excluded}
            onAccept={(o) => {
              setAccepting(o);
              setPhase('confirm');
              setAgreed(false);
              setOtp('');
            }}
            onOpen={openToLenders}
            canOpen={trade.status === 'VERIFIED'}
            opening={opening}
          />
        </div>
      )}

      {tab === 'financing' && (
        <FinancingTab
          trade={trade}
          offer={accepted}
          evidence={evidence}
          onSign={() => {
            const o = accepted;
            if (o) {
              setAccepting(o);
              setPhase('otp');
              setAgreed(true);
              setOtp('');
            }
          }}
          onOpenOffers={() => setTab('offers')}
        />
      )}

      {tab === 'tracking' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="h3">Shipment tracking</div>
                <div className="text-[12px] text-ink-3">Staged milestones, advanced from the DemoPanel.</div>
              </div>
              <SourceChip source="Carrier" simulated />
            </div>
            <Timeline
              items={SHIPMENT_MILESTONES}
              current={evidence?.shipmentStage ?? 0}
              orientation="vertical"
            />
            <div className="mt-5 rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] leading-5 text-ink-2">
              Check 7 is <strong>Unknown</strong> until the shipment is sailed. Unknown is passed to lenders as unknown,
              never rounded up to pass.
            </div>
          </div>
          <aside className="space-y-4">
            <div className="card p-5">
              <div className="caption mb-2">Buyer confirmation</div>
              <div className="flex items-center gap-2">
                <StatusChip
                  status={evidence?.buyerConfirmed ? 'pass' : 'pending'}
                  label={evidence?.buyerConfirmed ? 'Confirmed' : 'Pending'}
                />
              </div>
              <p className="mt-2 text-[12px] leading-5 text-ink-2">
                {evidence?.buyerConfirmed
                  ? 'The buyer confirmed the trade and its value.'
                  : 'We sent the buyer a link. Use “Buyer confirms” in the demo controls to trigger it.'}
              </p>
            </div>
            <div className="card p-5">
              <div className="caption mb-2">Milestones</div>
              <div className="space-y-1 text-[12px] text-ink-2">
                <div>Loaded · Container stuffed at Tiruppur</div>
                <div>Sailed · MV Coromandel departed Tuticorin</div>
                <div>Arrived · Felixstowe</div>
                <div>Delivered · Goods received by buyer</div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {tab === 'activity' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="card overflow-hidden">
            <div className="border-b border-line px-6 py-4">
              <div className="h3">Activity</div>
              <div className="text-[12px] text-ink-3">Every state change is an AuditEvent, newest first.</div>
            </div>
            <div className="divide-y divide-line">
              {(audit?.events ?? []).map((e) => (
                <div key={e.id} className="flex items-start gap-3 px-6 py-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="mono text-[12px] text-ink">{e.action}</span>
                      <span className="text-[11px] text-ink-3">{dateTime(e.timestamp)}</span>
                    </div>
                    <div className="text-[12px] text-ink-3">
                      {e.actor} · {e.object}
                    </div>
                  </div>
                </div>
              ))}
              {!audit?.events.length && <div className="px-6 py-8 text-center text-[12px] text-ink-3">No events yet.</div>}
            </div>
          </div>
          <aside className="card h-fit p-5">
            <div className="caption mb-2">Consent artefacts</div>
            {(evidence as EvidenceResponse & { consents?: ConsentArtefact[] })?.consents?.length ? (
              <div className="space-y-2">
                {(evidence as EvidenceResponse & { consents?: ConsentArtefact[] }).consents!.map((c) => (
                  <div key={c.id} className="rounded-lg border border-line px-3 py-2 text-[12px]">
                    <div className="font-medium">{c.recipientOrgId.replace('lender_', '')}</div>
                    <div className="text-[11px] text-ink-3">
                      {c.purpose} · expires {dateOnly(c.expiresAt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-ink-3">None yet.</p>
            )}
          </aside>
        </div>
      )}

      <Modal
        open={Boolean(accepting)}
        onClose={() => {
          if (phase !== 'done') setAccepting(null);
        }}
        title={phase === 'done' ? 'Signed and sent' : phase === 'otp' ? 'Sign with OTP' : 'Accept this offer'}
        subtitle={accepting ? `${accepting.lenderName} · ${inr(accepting.math.netCash)} net cash` : undefined}
        footer={
          phase === 'confirm' ? (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAccepting(null)}>
                Cancel
              </Button>
              <Button onClick={confirmAccept} disabled={!agreed}>
                Accept offer
              </Button>
            </div>
          ) : phase === 'otp' ? (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAccepting(null)}>
                Later
              </Button>
              <Button onClick={sign} disabled={otp.length < 6} icon={<FileSignature size={15} />}>
                Sign with OTP
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setSms(null);
                  setAccepting(null);
                  setTab('financing');
                }}
              >
                View financing
              </Button>
            </div>
          )
        }
      >
        {accepting && phase !== 'done' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-line p-4">
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <KV label="Advance" value={inr(accepting.math.advance)} />
                <KV label="Headline rate" value={`${accepting.ratePct}% p.a.`} />
                <KV label="Tenure" value={`${accepting.tenureDays} days`} />
                <KV label="Effective cost" value={pct(accepting.math.effectiveAPR)} />
                <KV label="Total fees" value={inr(accepting.math.fees)} />
                <KV label="Net cash" value={inr(accepting.math.netCash)} />
              </div>
              {accepting.math.hiddenFees.length > 0 && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-warn">
                  <Flag size={12} /> Includes {inr(accepting.math.hiddenFees.reduce((s, f) => s + f.amount, 0))} stated
                  only in the conditions.
                </div>
              )}
            </div>
            {phase === 'confirm' ? (
              <label className="flex items-start gap-2 text-[12px] leading-5 text-ink-2">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
                />
                I have read the offer, its conditions and the effective cost, and I agree to these terms.
              </label>
            ) : (
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-2">One-time password</label>
                <div className="flex gap-2">
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6 digits"
                    className="h-10 w-40 rounded-input border border-line bg-surface px-3 font-mono text-[15px] tracking-[0.2em]"
                  />
                  <Button variant="secondary" onClick={() => setOtp('123456')}>
                    Autofill
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-ink-3">Any six digits work. This is a simulated OTP, not a real signature.</p>
              </div>
            )}
          </div>
        )}
        {phase === 'done' && (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
              <Check size={28} />
            </div>
            <div className="h3">Contract signed</div>
            <p className="mt-1 text-[12px] leading-5 text-ink-2">
              The staged disbursal lands in 2 seconds. The invoice is then recorded in the shared registry.
            </p>
          </div>
        )}
      </Modal>

      {sms && (
        <div className="fixed bottom-4 right-4 z-40 w-[340px] animate-slideIn rounded-card border border-line bg-surface p-4 shadow-md">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-3">
              <Smartphone size={13} /> Simulated message
            </div>
            <button type="button" onClick={() => setSms(null)} className="text-[11px] text-ink-3 underline">
              Dismiss
            </button>
          </div>
          <div className="rounded-lg bg-[#eef6f1] px-3 py-2 text-[12px] leading-5 text-ink">{sms.text}</div>
          <div className="mt-1 text-[10px] text-ink-3">WhatsApp/SMS preview. No message is sent.</div>
        </div>
      )}
    </div>
  );
}

function StrengthCard({ strength }: { strength?: RiskProfile }) {
  if (!strength) return null;
  return (
    <div className="card p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="caption">Evidence strength</div>
        <BandChip band={strength.band} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="h2 tabular">{pct(strength.strength, 1)}</span>
        <span className="text-[11px] text-ink-3">not a score</span>
      </div>
      <div className="mt-3 space-y-2">
        {Object.entries(strength.components).map(([key, earned]) => {
          const max = strength.componentMax[key] ?? 1;
          const width = Math.min(100, (earned / max) * 100);
          const labels: Record<string, string> = {
            entity: 'Entity health',
            txn: 'Transaction authenticity',
            buyer: 'Buyer risk',
            structure: 'Structure',
          };
          return (
            <div key={key}>
              <div className="flex justify-between text-[11px] text-ink-2">
                <span>{labels[key] ?? key}</span>
                <span className="tabular">
                  {Math.round(earned)}/{max}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {strength.blocking.length > 0 && (
        <div className="mt-3 rounded-lg bg-danger-soft px-2.5 py-2 text-[11px] text-danger">
          Blocking issue: check {strength.blocking.join(', ')}. Band capped at Limited.
        </div>
      )}
      <p className="mt-3 text-[11px] leading-4 text-ink-3">
        Rules {strength.ruleVersion}. Lender weights can change this view; the underlying checks do not change.
      </p>
    </div>
  );
}

function FinancingTab({
  trade,
  offer,
  evidence,
  onSign,
  onOpenOffers,
}: {
  trade: Trade;
  offer?: OfferWithMath;
  evidence: EvidenceResponse | null;
  onSign: () => void;
  onOpenOffers: () => void;
}) {
  const receipt = (evidence as EvidenceResponse & {
    registryEntry?: { position: number; fingerprint: string; timestamp: string; entryHash: string } | null;
  })?.registryEntry;
  if (!offer) {
    return (
      <EmptyState
        title="No accepted offer yet"
        body="Accept one of the sealed offers and sign with the demo OTP. The financing and registry receipt appear here."
        action="Open offers"
        onAction={onOpenOffers}
      />
    );
  }
  const signed = ['CONTRACT_SIGNED', 'FINANCED', 'SHIPMENT_IN_TRANSIT', 'DELIVERED', 'BUYER_ACCEPTED', 'REPAID', 'CLOSED'].includes(
    trade.status,
  );
  const due = new Date(Date.now() + offer.tenureDays * 86_400_000).toISOString();
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="h3">Financing</div>
            <StatusChip status={trade.status === 'FINANCED' || trade.status === 'REPAID' ? 'pass' : 'brand'} label={STATUS_LABELS[trade.status]} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-line p-4">
              <div className="caption mb-2">Accepted offer</div>
              <div className="text-[14px] font-semibold">{offer.lenderName}</div>
              <div className="mt-1 text-[12px] text-ink-2">
                {offer.advancePct}% advance · {offer.ratePct}% p.a. · {offer.tenureDays} days
              </div>
              <div className="mt-3 text-[12px] text-ink-2">
                Advance <span className="tabular font-medium text-ink">{inr(offer.math.advance)}</span>
                <br />
                Net cash <span className="tabular font-medium text-ink">{inr(offer.math.netCash)}</span>
                <br />
                Effective cost <span className="tabular font-medium text-ink">{pct(offer.math.effectiveAPR)}</span>
              </div>
            </div>
            <div className="rounded-lg border border-line p-4">
              <div className="caption mb-2">E-sign</div>
              <div className="flex items-center gap-2">
                <StatusChip status={signed ? 'pass' : 'pending'} label={signed ? 'Signed' : 'Awaiting signature'} />
              </div>
              <p className="mt-2 text-[12px] leading-5 text-ink-2">
                {signed
                  ? 'OTP signature recorded (simulated). Contract event is in the audit log.'
                  : 'Sign the accepted offer to trigger the staged disbursal.'}
              </p>
              {!signed && (
                <Button className="mt-3" size="compact" onClick={onSign} icon={<FileSignature size={15} />}>
                  Sign with OTP
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="card p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="h3">Repayment schedule</div>
            <span className="text-[11px] text-ink-3">Staged</span>
          </div>
          <table className="w-full text-[12px]">
            <thead className="text-left text-[11px] uppercase tracking-wide text-ink-3">
              <tr>
                <th className="py-2 font-medium">Event</th>
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <td className="py-2 text-ink">Disbursal to exporter</td>
                <td className="py-2 text-ink-2">{dateOnly(offer.submittedAt)}</td>
                <td className="py-2 text-right tabular text-ink">{inr(offer.math.netCash)}</td>
              </tr>
              <tr className="border-t border-line">
                <td className="py-2 text-ink">Buyer pays into escrow</td>
                <td className="py-2 text-ink-2">{dateOnly(due)}</td>
                <td className="py-2 text-right tabular text-ink">{usd(trade.value / trade.fx)}</td>
              </tr>
              <tr className="border-t border-line">
                <td className="py-2 text-ink">Lender recovers advance + interest</td>
                <td className="py-2 text-ink-2">{dateOnly(due)}</td>
                <td className="py-2 text-right tabular text-ink">{inr(offer.math.advance + offer.math.interest)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-ink-3">
            Indicative only. No money moves in this demo; FX is fixed at {trade.fx.toFixed(2)}.
          </p>
        </section>
      </div>

      <aside className="space-y-4">
        <div className="card p-5">
          <div className="caption mb-2">Registry receipt</div>
          {receipt ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] text-success">
                <CheckCircle2 size={15} /> Recorded in the duplicate-financing registry
              </div>
              <HashPill hash={receipt.fingerprint} label="Fingerprint" />
              <div className="text-[11px] text-ink-3">
                Position #{receipt.position} · {dateTime(receipt.timestamp)}
              </div>
              <HashPill hash={receipt.entryHash} label="Entry hash" />
              <p className="text-[11px] leading-4 text-ink-3">
                Only the fingerprint, status and timestamp are stored. No documents or personal data.
              </p>
            </div>
          ) : (
            <p className="text-[12px] leading-5 text-ink-2">
              The registry entry is appended when the disbursal completes.
            </p>
          )}
        </div>
        <div className="card p-5">
          <div className="caption mb-2">Next</div>
          <p className="text-[12px] leading-5 text-ink-2">
            Advance the shipment from the demo controls. Check 7 flips to Pass when the carrier confirms the goods are
            on board.
          </p>
        </div>
      </aside>
    </div>
  );
}

function KV({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="text-ink">{value ?? '—'}</dd>
    </div>
  );
}

function statusChip(status: string) {
  if (['NEEDS_INFO', 'REJECTED_VERIFICATION', 'DEFAULTED', 'DISPUTED'].includes(status)) return 'warn';
  if (['VERIFIED', 'FINANCED', 'REPAID', 'CLOSED', 'BUYER_ACCEPTED', 'DELIVERED'].includes(status)) return 'success';
  if (['OFFERS_OPEN', 'OFFER_ACCEPTED', 'CONTRACT_SIGNED', 'SHIPMENT_IN_TRANSIT'].includes(status)) return 'brand';
  return 'neutral';
}

function nextStep(trade: Trade, offerCount: number, evidence: EvidenceResponse | null) {
  if (trade.status === 'DRAFT' || trade.status === 'SUBMITTED')
    return { title: 'Upload documents', body: 'Add the five export documents.', cta: 'Documents', action: 'documents' };
  if (trade.status === 'NEEDS_INFO')
    return {
      title: 'Resolve the failed check',
      body: evidence?.checks.some((c) => c.checkId === 8 && c.result === 'fail')
        ? 'Upload the amended invoice or flag the failure to lenders.'
        : 'Review the failed check and decide.',
      cta: 'Open verification',
      action: 'verify',
    };
  if (trade.status === 'VERIFIED')
    return {
      title: 'Open to lenders',
      body: 'Share the evidence bundle for 30 days. Three lenders are eligible.',
      cta: 'Open to lenders',
      action: 'open',
    };
  if (trade.status === 'OFFERS_OPEN' && offerCount === 0)
    return { title: 'Offers are arriving', body: 'Wait for the sealed offers, then compare effective cost.', cta: 'Watch offers', action: 'offers' };
  if ((trade.status === 'OFFERS_OPEN' || trade.status === 'OFFER_ACCEPTED') && offerCount > 0)
    return { title: 'Compare and accept', body: 'Ranked by what they cost you, never commission.', cta: 'Compare offers', action: 'offers' };
  if (trade.status === 'CONTRACT_SIGNED')
    return { title: 'Disbursal in progress', body: 'The staged disbursal completes in a moment.', cta: 'View financing', action: 'financing' };
  if (['FINANCED', 'SHIPMENT_IN_TRANSIT', 'DELIVERED', 'BUYER_ACCEPTED'].includes(trade.status))
    return { title: 'Track the shipment', body: 'Advance the shipment; check 7 follows the carrier.', cta: 'Open tracking', action: 'tracking' };
  if (['REPAID', 'CLOSED'].includes(trade.status))
    return { title: 'Repaid — Passport updated', body: 'This trade now counts toward the signed Passport.', cta: 'Open Passport', action: 'passport' };
  return { title: 'Review the trade', body: 'Inspect the evidence.', cta: 'Open verification', action: 'verify' };
}

function invoiceNo(evidence: EvidenceResponse | null): string {
  const doc = evidence?.docs.filter((d) => d.type === 'invoice').sort((a, b) => b.version - a.version)[0];
  return String(doc?.extracted.fields.invoiceNo?.value ?? '—');
}
