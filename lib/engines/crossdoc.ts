import type { Doc, DocType, ExtractedFields } from '@/lib/types';

export interface Finding {
  field: string;
  docs: string[];
  values: Record<string, unknown>;
  severity: 'mismatch' | 'note';
  message: string;
}

export interface CompareResult {
  pass: boolean;
  findings: Finding[];
  headline: string;
  notes: Finding[];
}

const LABELS: Record<DocType, string> = {
  po: 'Purchase Order',
  invoice: 'Invoice',
  packing: 'Packing List',
  shippingBill: 'Shipping Bill',
  bl: 'Bill of Lading',
};

function val(fields: ExtractedFields | undefined, key: string): unknown {
  return fields?.[key]?.value;
}
function num(fields: ExtractedFields | undefined, key: string): number | null {
  const v = val(fields, key);
  const n = typeof v === 'string' ? Number(v.replace(/[^0-9.-]/g, '')) : Number(v);
  return Number.isFinite(n) ? n : null;
}
function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}
function days(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}

/** Lowercase, strip punctuation, expand common company suffixes, then compare token sets. */
export function normaliseName(raw: unknown): string {
  if (raw == null) return '';
  let s = String(raw).toLowerCase();
  s = s.replace(/[.,''`]/g, ' ');
  s = s.replace(/\b(private|pvt)\b/g, 'pvt');
  s = s.replace(/\blimited\b/g, 'ltd');
  s = s.replace(/\bllp\b/g, 'llp');
  s = s.replace(/[^a-z0-9 ]/g, ' ');
  return s
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

function partiesMatch(a: unknown, b: unknown): boolean {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (!na || !nb) return true;
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  const union = new Set([...ta, ...tb]);
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter += 1;
  });
  return inter / union.size >= 0.8;
}

function getDoc(docs: Doc[], type: DocType) {
  return docs.filter((d) => d.type === type).sort((a, b) => (b.version || 1) - (a.version || 1))[0];
}

export function compareDocs(docs: Doc[]): CompareResult {
  const po = getDoc(docs, 'po');
  const invoice = getDoc(docs, 'invoice');
  const packing = getDoc(docs, 'packing');
  const sb = getDoc(docs, 'shippingBill');
  const bl = getDoc(docs, 'bl');
  const findings: Finding[] = [];
  if (!invoice) {
    return {
      pass: false,
      findings: [
        {
          field: 'documents',
          docs: [],
          values: {},
          severity: 'mismatch',
          message: 'Commercial Invoice is missing, so the trade cannot be compared.',
        },
      ],
      headline: 'Commercial Invoice is missing, so the trade cannot be compared.',
      notes: [],
    };
  }

  // Quantity — compare invoice against BL, Packing List and Shipping Bill.
  const invQty = num(invoice.extracted.fields, 'quantity');
  const others: [DocType, Doc | undefined][] = [
    ['bl', bl],
    ['packing', packing],
    ['shippingBill', sb],
  ];
  for (const [type, doc] of others) {
    const q = doc ? num(doc.extracted.fields, 'quantity') : null;
    if (invQty != null && q != null && invQty !== q) {
      findings.push({
        field: 'quantity',
        docs: ['invoice', type],
        values: { invoice: invQty, [type]: q },
        severity: 'mismatch',
        message: `${LABELS.invoice} quantity ${fmt(invQty)} does not match ${LABELS[type]} quantity ${fmt(q)}.`,
      });
    }
  }
  const poQty = po ? num(po.extracted.fields, 'quantity') : null;
  const partialAllowed = Boolean(val(po?.extracted.fields, 'partialShipmentsPermitted'));
  if (poQty != null && invQty != null && poQty !== invQty) {
    const clause = partialAllowed && invQty <= poQty;
    findings.push({
      field: 'quantity',
      docs: ['po', 'invoice'],
      values: { po: poQty, invoice: invQty },
      severity: clause ? 'note' : 'mismatch',
      message: clause
        ? `Invoice quantity ${fmt(invQty)} is below the PO quantity ${fmt(poQty)}. Partial shipment, permitted by PO.`
        : `Invoice quantity ${fmt(invQty)} does not match PO quantity ${fmt(poQty)}.`,
    });
  }

  // Amount integrity and shipping-bill value.
  const invAmount = num(invoice.extracted.fields, 'amount');
  const unitPrice = num(invoice.extracted.fields, 'unitPrice');
  if (invQty != null && invAmount != null && unitPrice != null) {
    const expected = invQty * unitPrice;
    if (Math.abs(expected - invAmount) > 1) {
      findings.push({
        field: 'amount',
        docs: ['invoice'],
        values: { quantity: invQty, unitPrice, amount: invAmount },
        severity: 'mismatch',
        message: `Invoice amount ${fmt(invAmount)} does not equal ${fmt(invQty)} × ${unitPrice}.`,
      });
    }
  }
  const sbAmount = sb ? num(sb.extracted.fields, 'fobValue') : null;
  if (invAmount != null && sbAmount != null) {
    const delta = Math.abs(sbAmount - invAmount) / invAmount;
    if (delta > 0.005) {
      findings.push({
        field: 'amount',
        docs: ['shippingBill', 'invoice'],
        values: { shippingBill: sbAmount, invoice: invAmount },
        severity: 'mismatch',
        message: `Shipping Bill FOB value ${fmt(sbAmount)} differs from invoice amount ${fmt(invAmount)} by more than 0.5%.`,
      });
    }
  }

  // Dates.
  const poDate = val(po?.extracted.fields, 'poDate');
  const invDate = val(invoice.extracted.fields, 'invoiceDate');
  const blDate = val(bl?.extracted.fields, 'blDate');
  const sbDate = val(sb?.extracted.fields, 'sbDate');
  if (poDate && invDate && new Date(String(poDate)) > new Date(String(invDate))) {
    findings.push({
      field: 'dates',
      docs: ['po', 'invoice'],
      values: { poDate, invoiceDate: invDate },
      severity: 'mismatch',
      message: 'Purchase Order date is after the Invoice date.',
    });
  }
  if (invDate && blDate && new Date(String(invDate)) > new Date(String(blDate))) {
    findings.push({
      field: 'dates',
      docs: ['invoice', 'bl'],
      values: { invoiceDate: invDate, blDate },
      severity: 'mismatch',
      message: 'Invoice date is after the Bill of Lading date.',
    });
  }
  if (sbDate && blDate && days(String(sbDate), String(blDate)) > 7) {
    findings.push({
      field: 'dates',
      docs: ['shippingBill', 'bl'],
      values: { sbDate, blDate },
      severity: 'mismatch',
      message: 'Shipping Bill date is more than 7 days from the Bill of Lading date.',
    });
  }

  // Parties — normalised token comparison.
  const buyerDocs: [string, unknown][] = [
    ['Invoice', val(invoice.extracted.fields, 'buyer')],
    ['Bill of Lading', val(bl?.extracted.fields, 'buyer')],
    ['Purchase Order', val(po?.extracted.fields, 'buyer')],
  ].filter(([, v]) => v != null) as [string, unknown][];
  for (let i = 1; i < buyerDocs.length; i++) {
    const [la, a] = buyerDocs[0];
    const [lb, b] = buyerDocs[i];
    if (String(a) !== String(b)) {
      if (partiesMatch(a, b)) {
        findings.push({
          field: 'parties',
          docs: ['invoice', 'bl'],
          values: { [la]: a, [lb]: b },
          severity: 'note',
          message: `Buyer names matched after normalising: “${a}” and “${b}”.`,
        });
      } else {
        findings.push({
          field: 'parties',
          docs: ['invoice', 'bl'],
          values: { [la]: a, [lb]: b },
          severity: 'mismatch',
          message: `Buyer “${a}” does not match “${b}”.`,
        });
      }
    }
  }

  // HS code — first six digits.
  const hs = [
    ['invoice', val(invoice.extracted.fields, 'hsCode')],
    ['po', val(po?.extracted.fields, 'hsCode')],
    ['shippingBill', val(sb?.extracted.fields, 'hsCode')],
    ['bl', val(bl?.extracted.fields, 'hsCode')],
  ].filter(([, v]) => v != null) as [string, string][];
  const first = hs[0];
  for (let i = 1; i < hs.length; i++) {
    if (String(first[1]).slice(0, 6) !== String(hs[i][1]).slice(0, 6)) {
      findings.push({
        field: 'hsCode',
        docs: ['invoice', hs[i][0]],
        values: { invoice: first[1], [hs[i][0]]: hs[i][1] },
        severity: 'mismatch',
        message: `HS code ${hs[i][1]} does not match invoice HS code ${first[1]}.`,
      });
    }
  }

  // Ports.
  for (const key of ['portLoading', 'portDischarge']) {
    const ports = [
      ['invoice', val(invoice.extracted.fields, key)],
      ['bl', val(bl?.extracted.fields, key)],
      ['shippingBill', val(sb?.extracted.fields, key)],
    ].filter(([, v]) => v != null) as [string, string][];
    for (let i = 1; i < ports.length; i++) {
      if (String(ports[i][1]).toUpperCase() !== String(ports[0][1]).toUpperCase()) {
        findings.push({
          field: key,
          docs: ['invoice', ports[i][0]],
          values: { invoice: ports[0][1], [ports[i][0]]: ports[i][1] },
          severity: 'mismatch',
          message: `Port ${ports[i][1]} does not match ${ports[0][1]}.`,
        });
      }
    }
  }

  // Currency and Incoterm.
  for (const key of ['currency', 'incoterm']) {
    const a = val(invoice.extracted.fields, key);
    const b = val(sb?.extracted.fields, key);
    if (a != null && b != null && String(a).toUpperCase() !== String(b).toUpperCase()) {
      findings.push({
        field: key,
        docs: ['invoice', 'shippingBill'],
        values: { invoice: a, shippingBill: b },
        severity: 'mismatch',
        message: `${key === 'currency' ? 'Currency' : 'Incoterm'} ${b} does not match ${a} on the invoice.`,
      });
    }
  }

  const mismatches = findings.filter((f) => f.severity === 'mismatch');
  return {
    pass: mismatches.length === 0,
    findings,
    headline: mismatches[0]?.message ?? 'All cross-document fields agree.',
    notes: findings.filter((f) => f.severity === 'note'),
  };
}

export function mismatchSummary(result: CompareResult): string {
  const mismatches = result.findings.filter((f) => f.severity === 'mismatch');
  if (!mismatches.length) {
    return result.notes.length
      ? `All cross-document fields agree. ${result.notes.length} normalisation note${result.notes.length > 1 ? 's' : ''}.`
      : 'All cross-document fields agree.';
  }
  return mismatches[0].message;
}
