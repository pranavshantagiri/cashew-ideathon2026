import type { CheckResult, Doc, RegistryEntry, Trade } from '@/lib/types';
import { compareDocs } from './crossdoc';
import { checkDuplicate, fingerprint, irnFingerprint } from './registry';
import { sha256, canonicalJSON } from './hash';

export interface VerificationContext {
  trade: Trade;
  docs: Doc[];
  scenario: 'A' | 'B' | 'C';
  buyerConfirmed: boolean;
  shipmentStage: number;
  registryEntries: RegistryEntry[];
  priorResults: Record<number, CheckResult>;
}

export interface CheckEvaluation {
  result: CheckResult;
  line: string;
  evidence: unknown;
}

export interface CheckMeta {
  id: number;
  title: string;
  source: string;
  mode: 'staged' | 'real';
  durationMs: number;
  manualFallback: boolean;
}

export const CHECK_META: CheckMeta[] = [
  { id: 1, title: 'Entity is registered and active', source: 'MCA', mode: 'staged', durationMs: 600, manualFallback: true },
  { id: 2, title: 'Importer-Exporter Code is active', source: 'IEC', mode: 'staged', durationMs: 500, manualFallback: true },
  { id: 3, title: 'Promoter identity matches', source: 'PAN', mode: 'staged', durationMs: 450, manualFallback: true },
  { id: 4, title: 'GST registration and filing history', source: 'GST', mode: 'staged', durationMs: 700, manualFallback: true },
  { id: 5, title: 'e-Invoice is valid and signed', source: 'e-Invoice', mode: 'staged', durationMs: 800, manualFallback: true },
  { id: 6, title: 'Export documents are lodged', source: 'Customs', mode: 'staged', durationMs: 550, manualFallback: true },
  { id: 7, title: 'Shipment is confirmed by the carrier', source: 'Carrier', mode: 'staged', durationMs: 650, manualFallback: true },
  { id: 8, title: 'Documents agree with each other', source: 'Computed', mode: 'real', durationMs: 1800, manualFallback: false },
  { id: 9, title: 'Buyer is registered and rated', source: 'Buyer registry', mode: 'staged', durationMs: 850, manualFallback: true },
  { id: 10, title: 'No sanctions or adverse media', source: 'Screening', mode: 'staged', durationMs: 700, manualFallback: true },
  { id: 11, title: 'No related-party overlap', source: 'Related party', mode: 'staged', durationMs: 600, manualFallback: false },
  { id: 12, title: 'Invoice is not already financed', source: 'Registry', mode: 'real', durationMs: 900, manualFallback: false },
  { id: 13, title: 'Bank account name matches', source: 'Penny-drop', mode: 'staged', durationMs: 700, manualFallback: true },
  { id: 14, title: 'Buyer confirms the trade', source: 'Buyer link', mode: 'staged', durationMs: 1000, manualFallback: true },
];

export const CHECK_DEFS = CHECK_META;

const SEEDED_LINES: Record<number, { title: string; source: string; line: string; payload: Record<string, unknown> }> = {
  1: {
    title: 'Entity is registered and active',
    source: 'MCA',
    line: 'MCA: active, incorporated 2016. Udyam registered.',
    payload: { cin: 'U17111TZ2016PTC000000', status: 'ACTIVE', incorporated: '2016-04-18', udyam: 'UDYAM-TN-19-0000001' },
  },
  2: {
    title: 'Importer-Exporter Code is active',
    source: 'IEC',
    line: 'IEC active, no restrictions.',
    payload: { iec: '3300000000', status: 'ACTIVE', restrictions: [] },
  },
  3: {
    title: 'Promoter identity matches',
    source: 'PAN',
    line: 'Promoter PAN matches name (consented KYC).',
    payload: { pan: 'AAAPK0000A', nameMatch: true, kycConsent: true },
  },
  4: {
    title: 'GST registration and filing history',
    source: 'GST',
    line: 'GSTIN active, last 12 returns filed (11 on time).',
    payload: { gstin: '33AAAAK0000A1Z5', status: 'ACTIVE', returnsFiled: 12, onTime: 11 },
  },
  5: {
    title: 'e-Invoice is valid and signed',
    source: 'e-Invoice',
    line: 'e-Invoice IRN found, signed QR valid.',
    payload: { irn: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', qrValid: true },
  },
  6: {
    title: 'Export documents are lodged',
    source: 'Customs',
    line: 'Shipping Bill and Bill of Lading both present.',
    payload: { shippingBill: 'SB/2627/0000001', billOfLading: 'BL/2627/0000001', lodged: true },
  },
  9: {
    title: 'Buyer is registered and rated',
    source: 'Buyer registry',
    line: 'Buyer registered, 8 years of filings, rating B+. No platform payment history yet.',
    payload: { registration: 'GB-00000001', yearsOfFilings: 8, rating: 'B+', platformPayments: 0 },
  },
  10: {
    title: 'No sanctions or adverse media',
    source: 'Screening',
    line: 'No matches on 3 screening lists.',
    payload: { lists: ['UN', 'OFAC', 'UK HMT'], matches: 0 },
  },
  11: {
    title: 'No related-party overlap',
    source: 'Related party',
    line: 'No name, address, director or bank overlap.',
    payload: { name: false, address: false, director: false, bank: false },
  },
  13: {
    title: 'Bank account name matches',
    source: 'Penny-drop',
    line: 'Penny-drop name match: KAVERI TEXTILES PVT LTD.',
    payload: { accountName: 'KAVERI TEXTILES PVT LTD', matched: true, method: 'penny-drop' },
  },
};

export function invoiceFields(docs: Doc[]) {
  const invoice = docs
    .filter((d) => d.type === 'invoice')
    .sort((a, b) => (b.version || 1) - (a.version || 1))[0];
  const f = invoice?.extracted.fields ?? {};
  return {
    invoiceNo: String(f.invoiceNo?.value ?? ''),
    invoiceDate: String(f.invoiceDate?.value ?? ''),
    amount: Number(f.amount?.value ?? 0),
    currency: String(f.currency?.value ?? 'USD'),
    irn: f.irn?.value ? String(f.irn.value) : undefined,
    invoice,
  };
}

export function evaluateCheck(id: number, ctx: VerificationContext): CheckEvaluation {
  const { trade, docs, scenario } = ctx;

  if (id === 8) {
    const result = compareDocs(docs);
    const invoice = docs.filter((d) => d.type === 'invoice').sort((a, b) => (b.version || 1) - (a.version || 1))[0];
    const byType = (t: string) => {
      const d = docs.filter((x) => x.type === t).sort((a, b) => (b.version || 1) - (a.version || 1))[0];
      return d?.extracted.fields;
    };
    return {
      result: result.pass ? 'pass' : 'fail',
      line: result.headline,
      evidence: {
        mode: 'real',
        source: 'Computed',
        computedAt: new Date().toISOString(),
        findings: result.findings,
        notes: result.notes,
        compared: {
          quantity: {
            invoice: byType('invoice')?.quantity?.value,
            packing: byType('packing')?.quantity?.value,
            shippingBill: byType('shippingBill')?.quantity?.value,
            bl: byType('bl')?.quantity?.value,
            po: byType('po')?.quantity?.value,
            partialShipmentsPermitted: byType('po')?.partialShipmentsPermitted?.value,
          },
          amount: {
            invoice: byType('invoice')?.amount?.value,
            unitPrice: byType('invoice')?.unitPrice?.value,
            shippingBillFob: byType('shippingBill')?.fobValue?.value,
          },
        },
        interpretation: result.pass
          ? 'Every compared field agrees, after normalising names.'
          : interpretQuantity(result.findings),
        documentHashes: docs.map((d) => ({ type: d.type, version: d.version, sha256: d.sha256 })),
        rules: 'crossdoc-v0.1',
        invoiceVersion: invoice?.version,
      },
    };
  }

  if (id === 12) {
    const { invoiceNo, invoiceDate, amount, currency, irn } = invoiceFields(docs);
    const dup = checkDuplicate(
      {
        supplierId: trade.smeId,
        buyerId: trade.buyerId,
        invoiceNo,
        invoiceDate,
        amount,
        currency,
        irn,
      },
      ctx.registryEntries,
      'cashew-demo',
    );
    const result: CheckResult =
      dup.code === 'FINANCED_BY_OTHER' ? 'fail' : dup.code === 'POSSIBLE_DUPLICATE' ? 'warn' : 'pass';
    return {
      result,
      line: dup.message,
      evidence: {
        mode: 'real',
        source: 'Registry',
        checkedAt: new Date().toISOString(),
        fingerprint: fingerprint({
          supplierId: trade.smeId,
          buyerId: trade.buyerId,
          invoiceNo,
          invoiceDate,
          amount,
          currency,
        }),
        irnFingerprint: irnFingerprint(irn),
        result: dup.code,
        similarity: dup.breakdown,
        matchedEntry: dup.entry,
        note: 'Registry reads never reveal the identity of another lender.',
      },
    };
  }

  if (id === 14) {
    return {
      result: ctx.buyerConfirmed ? 'pass' : 'pending',
      line: ctx.buyerConfirmed
        ? 'Buyer confirmed the trade and its value.'
        : 'Buyer has not yet confirmed. We sent a link.',
      evidence: {
        mode: 'simulated',
        source: 'Buyer link',
        sentAt: new Date(Date.now() - 30 * 60_000).toISOString(),
        confirmed: ctx.buyerConfirmed,
        channel: 'email link (simulated)',
      },
    };
  }

  if (id === 7) {
    if (ctx.shipmentStage >= 1) {
      return {
        result: 'pass',
        line: 'Carrier confirms the shipment is on board.',
        evidence: {
          mode: 'simulated',
          source: 'Carrier',
          carrier: 'Maersk (simulated)',
          status: 'ON_BOARD',
          vessel: 'MV Coromandel',
          fetchedAt: new Date().toISOString(),
        },
      };
    }
    return {
      result: 'unknown',
      line: 'Carrier tracking not yet available. Forwarder confirmation requested.',
      evidence: {
        mode: 'simulated',
        source: 'Carrier',
        status: 'NO_DATA',
        requestedAt: new Date().toISOString(),
        forwarder: 'Bluewave Logistics',
        note: 'Unknown is a valid result and is passed to lenders as unknown.',
      },
    };
  }

  const seeded = SEEDED_LINES[id];
  if (seeded) {
    const payload = { ...seeded.payload };
    if (id === 9) {
      payload.registration = trade.buyerId === 'buyer_hartwell' ? 'GB-00000002' : 'GB-00000001';
    }
    if (id === 5) {
      payload.irn = invoiceFields(docs).irn ?? payload.irn;
    }
    let line = scenario === 'C' && id === 1 ? 'MCA: active, incorporated 2019. Udyam registered.' : seeded.line;
    if (id === 13) {
      const invoice = docs.filter((d) => d.type === 'invoice').sort((a, b) => (b.version || 1) - (a.version || 1))[0];
      const accountName = String(invoice?.extracted.fields.seller?.value ?? 'Kaveri Textiles Pvt Ltd').toUpperCase();
      payload.accountName = accountName;
      line = `Penny-drop name match: ${accountName}.`;
    }
    return {
      result: 'pass',
      line,
      evidence: {
        mode: 'simulated',
        source: seeded.source,
        fetchedAt: new Date().toISOString(),
        payload,
      },
    };
  }

  return {
    result: 'unknown',
    line: 'No adapter configured for this check.',
    evidence: { mode: 'simulated', source: 'Unknown', note: 'Adapter missing' },
  };
}

function interpretQuantity(findings: { field: string; severity: string; values: Record<string, unknown> }[]): string {
  const q = findings.find((f) => f.field === 'quantity' && f.severity === 'mismatch');
  if (!q) return 'No material mismatch found.';
  const inv = Number(q.values.invoice ?? 0);
  const other = Number(Object.entries(q.values).find(([k]) => k !== 'invoice')?.[1] ?? 0);
  if (!inv || !other) return 'Quantities differ across documents.';
  const missing = Math.abs(inv - other);
  const unit = 6.25;
  return `${missing.toLocaleString('en-IN')} pcs were not shipped. The invoice may overstate the goods by USD ${(missing * unit).toLocaleString('en-IN')}.`;
}

export function evidenceHash(evidence: unknown): string {
  return sha256(canonicalJSON(evidence));
}

export function buildEvidenceBundle(
  trade: Trade,
  checks: { checkId: number; result: CheckResult; evidence: unknown; runAt: string }[],
  docs: Doc[],
) {
  const bundle = {
    tradeId: trade.id,
    generatedAt: new Date().toISOString(),
    checks: checks.map((c) => ({
      checkId: c.checkId,
      result: c.result,
      runAt: c.runAt,
      evidenceHash: evidenceHash(c.evidence),
    })),
    documents: docs.map((d) => ({ type: d.type, version: d.version, sha256: d.sha256, fields: d.extracted.fields })),
    note: 'Evidence bundle, not a score. Simulated sources are labelled.',
  };
  return { ...bundle, bundleHash: sha256(canonicalJSON(bundle)) };
}
