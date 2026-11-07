import type {
  AppNotification,
  AuditEvent,
  Buyer,
  ConsentArtefact,
  Doc,
  DocType,
  ExtractedFields,
  LenderProduct,
  OpsCase,
  Org,
  RegistryEntry,
  Trade,
  TradeHistory,
} from '@/lib/types';
import { buildEntry, fingerprint, irnFingerprint } from '@/lib/engines/registry';
import { sha256, canonicalJSON } from '@/lib/engines/hash';

export const FX = 85;
const DAY = 86_400_000;
const ago = (n: number) => new Date(Date.now() - n * DAY);
const iso = (n: number) => ago(n).toISOString();
const date = (n: number) => iso(n).slice(0, 10);

export const ORGS: Org[] = [
  {
    id: 'org_kaveri',
    type: 'sme',
    legalName: 'Kaveri Textiles Pvt Ltd',
    gstin: '33AAAAK0000A1Z5',
    iec: '3300000000',
    udyam: 'UDYAM-TN-19-0000001',
    tier: 2,
    city: 'Tiruppur',
    country: 'IN',
  },
  {
    id: 'org_cks',
    type: 'sme',
    legalName: 'Coimbatore Knit Studio LLP',
    gstin: '33BBBBK0000B1Z2',
    iec: '3300000001',
    udyam: 'UDYAM-TN-19-0000002',
    tier: 1,
    city: 'Coimbatore',
    country: 'IN',
  },
  {
    id: 'lender_banyan',
    type: 'lender',
    legalName: 'Banyan Capital',
    city: 'Mumbai',
    country: 'IN',
  },
  {
    id: 'lender_tidewater',
    type: 'lender',
    legalName: 'Tidewater Finance',
    city: 'Bengaluru',
    country: 'IN',
  },
  {
    id: 'lender_meridian',
    type: 'lender',
    legalName: 'Meridian Bank',
    city: 'Mumbai',
    country: 'IN',
  },
  { id: 'org_ops', type: 'ops', legalName: 'Cashew Ops', country: 'IN' },
];

export const BUYERS: Buyer[] = [
  {
    id: 'buyer_northgate',
    name: 'Northgate Apparel Ltd',
    country: 'GB',
    registrationId: 'GB-00000001',
    yearsOfFilings: 8,
    rating: 'B+',
  },
  {
    id: 'buyer_hartwell',
    name: 'Hartwell & Rowe Retail Ltd',
    country: 'GB',
    registrationId: 'GB-00000002',
    yearsOfFilings: 6,
    rating: 'B',
  },
];

export const LENDER_PRODUCTS: LenderProduct[] = [
  {
    id: 'prod_banyan_inv',
    lenderId: 'lender_banyan',
    name: 'Export invoice discounting',
    type: 'Export invoice discounting',
    minTicket: 500_000,
    maxTicket: 50_000_000,
    sectors: ['textiles', 'engineering', 'chemicals'],
    corridors: ['IN-GB', 'IN-US', 'IN-AE'],
    maxTenureDays: 120,
    minStrength: 55,
    requiredDocs: ['po', 'invoice', 'packing', 'shippingBill', 'bl'],
    active: true,
    pricingModel: 'Advance + discount',
    disbursalHours: 48,
    advancePct: 85,
    ratePct: 11.5,
    validityDays: 7,
    recourse: true,
    collateral: 'None',
    fees: [{ label: 'Processing fee (0.50% of advance)', kind: 'pctAdvance', value: 0.5, statedIn: 'headline' }],
    conditions: 'Standard recourse invoice discounting. No additional charges.',
  },
  {
    id: 'prod_tidewater_inv',
    lenderId: 'lender_tidewater',
    name: 'Export invoice discounting',
    type: 'Export invoice discounting',
    minTicket: 250_000,
    maxTicket: 30_000_000,
    sectors: ['textiles', 'engineering'],
    corridors: ['IN-GB', 'IN-US', 'IN-AE', 'IN-DE'],
    maxTenureDays: 90,
    minStrength: 55,
    requiredDocs: ['po', 'invoice', 'packing', 'shippingBill', 'bl'],
    active: true,
    pricingModel: 'Advance + discount',
    disbursalHours: 24,
    advancePct: 90,
    ratePct: 10.2,
    validityDays: 3,
    recourse: true,
    collateral: 'None',
    fees: [
      { label: 'Processing fee (0.60% of advance)', kind: 'pctAdvance', value: 0.6, statedIn: 'headline' },
      { label: 'Documentation fee', kind: 'flat', value: 3500, statedIn: 'headline' },
      { label: 'FX conversion spread (0.8% of advance)', kind: 'pctAdvance', value: 0.8, statedIn: 'conditions' },
    ],
    conditions:
      'FX conversion spread of 0.8% applies on remittance proceeds. Documentation fee of ₹3,500 applies per drawdown.',
  },
  {
    id: 'prod_meridian_psc',
    lenderId: 'lender_meridian',
    name: 'Post-shipment credit',
    type: 'Post-shipment credit',
    minTicket: 1_000_000,
    maxTicket: 100_000_000,
    sectors: ['textiles', 'engineering', 'chemicals', 'agri'],
    corridors: ['IN-GB', 'IN-US', 'IN-AE', 'IN-EU'],
    maxTenureDays: 180,
    minStrength: 60,
    requiredDocs: ['invoice', 'packing', 'shippingBill', 'bl'],
    active: true,
    pricingModel: 'Advance + discount',
    disbursalHours: 72,
    advancePct: 80,
    ratePct: 10.4,
    validityDays: 7,
    recourse: true,
    collateral: 'None',
    fees: [
      { label: 'Processing fee (0.25% of advance)', kind: 'pctAdvance', value: 0.25, statedIn: 'headline' },
      { label: 'ECGC cover premium (0.30% of invoice)', kind: 'pctInvoice', value: 0.3, statedIn: 'headline' },
    ],
    conditions: 'ECGC cover required. Post-shipment credit, recourse to the exporter.',
  },
];

export const HISTORY: TradeHistory[] = [
  {
    id: 'hist_kaveri_1',
    smeId: 'org_kaveri',
    buyerId: 'buyer_northgate',
    value: 1_020_000,
    currency: 'USD',
    completedAt: iso(210),
    deliveredOnTime: true,
    repaidOnTime: true,
  },
  {
    id: 'hist_kaveri_2',
    smeId: 'org_kaveri',
    buyerId: 'buyer_northgate',
    value: 1_530_000,
    currency: 'USD',
    completedAt: iso(150),
    deliveredOnTime: true,
    repaidOnTime: true,
  },
  {
    id: 'hist_kaveri_3',
    smeId: 'org_kaveri',
    buyerId: 'buyer_northgate',
    value: 1_870_000,
    currency: 'USD',
    completedAt: iso(80),
    deliveredOnTime: true,
    repaidOnTime: true,
  },
  {
    id: 'hist_cks_1',
    smeId: 'org_cks',
    buyerId: 'buyer_hartwell',
    value: 1_190_000,
    currency: 'USD',
    completedAt: iso(180),
    deliveredOnTime: true,
    repaidOnTime: true,
  },
  {
    id: 'hist_cks_2',
    smeId: 'org_cks',
    buyerId: 'buyer_hartwell',
    value: 1_360_000,
    currency: 'USD',
    completedAt: iso(120),
    deliveredOnTime: true,
    repaidOnTime: true,
  },
  {
    id: 'hist_cks_3',
    smeId: 'org_cks',
    buyerId: 'buyer_hartwell',
    value: 1_564_000,
    currency: 'USD',
    completedAt: iso(60),
    deliveredOnTime: false,
    repaidOnTime: true,
  },
];

interface ScenarioSpec {
  id: 'A' | 'B' | 'C';
  tradeId: string;
  smeId: string;
  buyerId: string;
  invoiceNo: string;
  invoiceDate: string;
  blDate: string;
  poDate: string;
  sbDate: string;
  poQty: number;
  invoiceQty: number;
  packingQty: number;
  sbQty: number;
  blQty: number;
  unitPrice: number;
  invoiceAmount: number;
  sbAmount: number;
  partial: boolean;
  buyerOnInvoice: string;
  buyerOnBl: string;
  irn: string;
}

const SCENARIOS: Record<'A' | 'B' | 'C', ScenarioSpec> = {
  A: {
    id: 'A',
    tradeId: 'TRD-A-001',
    smeId: 'org_kaveri',
    buyerId: 'buyer_northgate',
    invoiceNo: 'KT/2627/0198',
    invoiceDate: date(24),
    poDate: date(38),
    blDate: date(20),
    sbDate: date(21),
    poQty: 3000,
    invoiceQty: 3000,
    packingQty: 3000,
    sbQty: 3000,
    blQty: 3000,
    unitPrice: 6.25,
    invoiceAmount: 18_750,
    sbAmount: 18_750,
    partial: false,
    buyerOnInvoice: 'Northgate Apparel Limited',
    buyerOnBl: 'NORTHGATE APPAREL LTD.',
    irn: 'b7e2c4d6a8f0b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1',
  },
  B: {
    id: 'B',
    tradeId: 'TRD-B-001',
    smeId: 'org_kaveri',
    buyerId: 'buyer_northgate',
    invoiceNo: 'KT/2627/0231',
    invoiceDate: date(16),
    poDate: date(30),
    blDate: date(12),
    sbDate: date(13),
    poQty: 4800,
    invoiceQty: 4800,
    packingQty: 4200,
    sbQty: 4200,
    blQty: 4200,
    unitPrice: 6.25,
    invoiceAmount: 30_000,
    sbAmount: 26_250,
    partial: true,
    buyerOnInvoice: 'Northgate Apparel Limited',
    buyerOnBl: 'NORTHGATE APPAREL LTD.',
    irn: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  },
  C: {
    id: 'C',
    tradeId: 'TRD-C-001',
    smeId: 'org_cks',
    buyerId: 'buyer_hartwell',
    invoiceNo: 'CKS/2627/0188',
    invoiceDate: date(50),
    poDate: date(64),
    blDate: date(46),
    sbDate: date(47),
    poQty: 2944,
    invoiceQty: 2944,
    packingQty: 2944,
    sbQty: 2944,
    blQty: 2944,
    unitPrice: 6.25,
    invoiceAmount: 18_400,
    sbAmount: 18_400,
    partial: false,
    buyerOnInvoice: 'Hartwell & Rowe Retail Ltd',
    buyerOnBl: 'HARTWELL & ROWE RETAIL LTD.',
    irn: 'c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8',
  },
};

export const SCENARIO_SPECS = SCENARIOS;

function f(value: string | number | boolean, confidence = 0.97, extra?: { unit?: string; currency?: string }) {
  return { value, confidence, ...(extra ?? {}) };
}

function fieldsFor(spec: ScenarioSpec, type: DocType, version = 1): ExtractedFields {
  const amended = type === 'invoice' && version === 2;
  const invoiceQty = amended ? spec.packingQty : spec.invoiceQty;
  const invoiceAmount = amended ? Math.round(spec.packingQty * spec.unitPrice * 100) / 100 : spec.invoiceAmount;
  const seller = spec.smeId === 'org_cks' ? 'Coimbatore Knit Studio LLP' : 'Kaveri Textiles Pvt Ltd';
  const poPrefix = spec.smeId === 'org_cks' ? 'PO/CKS' : 'PO/NG';
  switch (type) {
    case 'po':
      return {
        poNo: f(`${poPrefix}/${spec.id}${spec.invoiceNo.slice(-4)}`),
        poDate: f(spec.poDate),
        seller: f(seller, 0.99),
        buyer: f(spec.buyerOnInvoice, 0.96),
        hsCode: f('610910'),
        quantity: f(spec.poQty, 0.98, { unit: 'pcs' }),
        unitPrice: f(spec.unitPrice, 0.97, { currency: 'USD' }),
        amount: f(Math.round(spec.poQty * spec.unitPrice * 100) / 100, 0.97, { currency: 'USD' }),
        incoterm: f('FOB', 0.95),
        partialShipmentsPermitted: f(spec.partial, 0.94),
        paymentTermsDays: f(90, 0.93),
      };
    case 'invoice':
      return {
        invoiceNo: f(amended ? spec.invoiceNo : spec.invoiceNo, 0.98),
        invoiceDate: f(amended ? date(12) : spec.invoiceDate, 0.97),
        seller: f(seller, 0.99),
        buyer: f(spec.buyerOnInvoice, 0.95),
        hsCode: f('610910', 0.96),
        quantity: f(invoiceQty, 0.98, { unit: 'pcs' }),
        unitPrice: f(spec.unitPrice, 0.98, { currency: 'USD' }),
        amount: f(invoiceAmount, 0.99, { currency: 'USD' }),
        currency: f('USD', 0.99),
        incoterm: f('FOB', 0.93),
        portLoading: f('INTUT', 0.9),
        portDischarge: f('GBFXT', 0.9),
        irn: f(spec.irn, 0.97),
        amended: f(amended, 0.99),
      };
    case 'packing':
      return {
        packingNo: f(`PK/${spec.invoiceNo.slice(-4)}`),
        packingDate: f(date(14)),
        invoiceNo: f(spec.invoiceNo),
        quantity: f(spec.packingQty, 0.97, { unit: 'pcs' }),
        packages: f(Math.round(spec.packingQty / 20), 0.95),
        grossWeightKg: f(Math.round(spec.packingQty / 4), 0.81, { unit: 'kg' }),
        seller: f(seller, 0.97),
        buyer: f(spec.buyerOnInvoice, 0.94),
        hsCode: f('610910', 0.95),
      };
    case 'shippingBill':
      return {
        sbNo: f(`SB/2627/${spec.invoiceNo.slice(-4)}`),
        sbDate: f(spec.sbDate),
        invoiceNo: f(spec.invoiceNo, 0.96),
        quantity: f(spec.sbQty, 0.97, { unit: 'pcs' }),
        fobValue: f(amended ? invoiceAmount : spec.sbAmount, 0.97, { currency: 'USD' }),
        currency: f('USD', 0.98),
        hsCode: f('610910', 0.96),
        portLoading: f('INTUT', 0.93),
        portDischarge: f('GBFXT', 0.93),
        incoterm: f('FOB', 0.94),
      };
    case 'bl':
      return {
        blNo: f(`BL/2627/${spec.invoiceNo.slice(-4)}`),
        blDate: f(spec.blDate),
        invoiceNo: f(spec.invoiceNo, 0.96),
        quantity: f(spec.blQty, 0.97, { unit: 'pcs' }),
        seller: f(seller, 0.99),
        buyer: f(spec.buyerOnBl, 0.94),
        hsCode: f('610910', 0.96),
        portLoading: f('INTUT', 0.92),
        portDischarge: f('GBFXT', 0.92),
        vessel: f('MV Coromandel', 0.88),
      };
  }
}

let docSeq = 0;
export function makeDoc(tradeId: string, scenario: 'A' | 'B' | 'C', type: DocType, version = 1): Doc {
  docSeq += 1;
  const extracted = { docType: type, fields: fieldsFor(SCENARIOS[scenario], type, version) };
  const sha256Hash = sha256(canonicalJSON({ tradeId, scenario, type, version, extracted }));
  return {
    id: `doc_${tradeId}_${type}_v${version}_${docSeq}`,
    tradeId,
    type,
    sha256: sha256Hash,
    extracted,
    verifiedStatus: 'pending',
    version,
    filename: `${type}-${SCENARIOS[scenario].invoiceNo.replace(/\//g, '-')}${version > 1 ? '-amended' : ''}.pdf`,
    uploadedAt: new Date().toISOString(),
  };
}

export function makeTrade(scenario: 'A' | 'B' | 'C', overrides: Partial<Trade> = {}): Trade {
  const spec = SCENARIOS[scenario];
  return {
    id: spec.tradeId,
    smeId: spec.smeId,
    buyerId: spec.buyerId,
    corridor: 'IN-GB',
    hsCode: '610910',
    value: Math.round(spec.invoiceAmount * FX),
    currency: 'USD',
    fx: FX,
    incoterm: 'FOB',
    paymentTermsDays: 90,
    status: 'DRAFT',
    scenario,
    flaggedUnknownOrFailed: [],
    createdAt: new Date().toISOString(),
    goods: 'Cotton knit T-shirts, 180 GSM, HS 6109',
    sample: true,
    ...overrides,
  };
}

function buildRegistrySeed(): RegistryEntry[] {
  const entries: RegistryEntry[] = [];
  let prev: RegistryEntry | undefined;
  const push = (input: Parameters<typeof buildEntry>[1]) => {
    const entry = buildEntry(prev, input);
    entries.push(entry);
    prev = entry;
  };
  const lenders = ['lender_banyan', 'lender_tidewater', 'lender_meridian'];
  for (let i = 0; i < 13; i++) {
    const supplier = `org_filler_${i}`;
    const buyer = `buyer_filler_${i}`;
    const invoiceNo = `FLT/2627/${String(1000 + i)}`;
    const invoiceDate = date(120 - i * 6);
    const amount = 9000 + i * 1375;
    const currency = 'USD';
    const irn = `f${i.toString(16).padStart(63, '0')}`;
    push({
      fingerprint: fingerprint({ supplierId: supplier, buyerId: buyer, invoiceNo, invoiceDate, amount, currency }),
      irnFingerprint: irnFingerprint(irn),
      lenderId: lenders[i % 3],
      status: i < 10 ? 'SETTLED' : 'FINANCED',
      timestamp: ago(95 - i * 6).toISOString(),
      supplierId: supplier,
      buyerId: buyer,
      ref: invoiceNo,
      meta: { supplierId: supplier, buyerId: buyer, invoiceNo, invoiceDate, amount, currency, irn },
    });
  }
  const c = SCENARIOS.C;
  push({
    fingerprint: fingerprint({
      supplierId: c.smeId,
      buyerId: c.buyerId,
      invoiceNo: c.invoiceNo,
      invoiceDate: c.invoiceDate,
      amount: c.invoiceAmount,
      currency: 'USD',
    }),
    irnFingerprint: irnFingerprint(c.irn),
    lenderId: 'lender_banyan',
    status: 'FINANCED',
    timestamp: ago(48).toISOString(),
    supplierId: c.smeId,
    buyerId: c.buyerId,
    ref: c.invoiceNo,
    meta: {
      supplierId: c.smeId,
      buyerId: c.buyerId,
      invoiceNo: c.invoiceNo,
      invoiceDate: c.invoiceDate,
      amount: c.invoiceAmount,
      currency: 'USD',
      irn: c.irn,
    },
  });
  return entries;
}

export interface SeedDatabase {
  orgs: Org[];
  buyers: Buyer[];
  trades: Trade[];
  docs: Doc[];
  products: LenderProduct[];
  registry: RegistryEntry[];
  consents: ConsentArtefact[];
  audit: AuditEvent[];
  ops: OpsCase[];
  notifications: AppNotification[];
  history: TradeHistory[];
}

export function seedDatabase(scenario: 'A' | 'B' | 'C' = 'B'): SeedDatabase {
  docSeq = 0;
  const trades: Trade[] = [];
  const docs: Doc[] = [];
  const audit: AuditEvent[] = [];
  const notifications: AppNotification[] = [];

  if (scenario === 'A' || scenario === 'B') {
    const stamp = new Date().toISOString();
    audit.push({
      id: 'aud_seed_1',
      actor: 'system',
      action: 'demo.seeded',
      object: `scenario:${scenario}`,
      timestamp: stamp,
      meta: { note: 'Seed state loaded' },
    });
  } else {
    const base = makeTrade('C');
    const exact = { ...base, id: 'TRD-C-001', status: 'SUBMITTED' as const, createdAt: iso(1) };
    const altered = {
      ...base,
      id: 'TRD-C-002',
      status: 'SUBMITTED' as const,
      value: Math.round(18_900 * FX),
      createdAt: iso(1),
    };
    trades.push(exact, altered);
    (['po', 'invoice', 'packing', 'shippingBill', 'bl'] as DocType[]).forEach((t) => {
      docs.push(makeDoc(exact.id, 'C', t));
      const amended = makeDoc(altered.id, 'C', t);
      if (t === 'invoice') {
        amended.extracted.fields.invoiceNo = f('CKS/2627/0188-A', 0.96);
        amended.extracted.fields.invoiceDate = f(date(48), 0.95);
        amended.extracted.fields.quantity = f(3024, 0.97, { unit: 'pcs' });
        amended.extracted.fields.amount = f(18_900, 0.98, { currency: 'USD' });
        amended.extracted.fields.irn = f(SCENARIOS.C.irn, 0.97);
        amended.version = 2;
      }
      if (t === 'po') {
        amended.extracted.fields.quantity = f(3024, 0.96, { unit: 'pcs' });
        amended.extracted.fields.amount = f(18_900, 0.96, { currency: 'USD' });
      }
      if (t === 'packing' || t === 'bl') {
        amended.extracted.fields.quantity = f(3024, 0.96, { unit: 'pcs' });
        amended.extracted.fields.invoiceNo = f('CKS/2627/0188-A', 0.95);
      }
      if (t === 'shippingBill') {
        amended.extracted.fields.quantity = f(3024, 0.96, { unit: 'pcs' });
        amended.extracted.fields.fobValue = f(18_900, 0.96, { currency: 'USD' });
        amended.extracted.fields.invoiceNo = f('CKS/2627/0188-A', 0.95);
      }
      docs.push(amended);
    });
    const stamp = new Date().toISOString();
    audit.push({
      id: 'aud_seed_c',
      actor: 'system',
      action: 'demo.seeded',
      object: 'scenario:C',
      timestamp: stamp,
      meta: { note: 'Duplicate-attempt trades loaded' },
    });
  }

  notifications.push({
    id: 'notif_seed',
    title: 'Demo environment',
    body: 'External data sources are simulated. Press D for demo controls.',
    kind: 'info',
    createdAt: new Date().toISOString(),
  });

  return {
    orgs: ORGS.map((o) => ({ ...o })),
    buyers: BUYERS.map((b) => ({ ...b })),
    trades,
    docs,
    products: LENDER_PRODUCTS.map((p) => ({ ...p, fees: p.fees?.map((f) => ({ ...f })) })),
    registry: buildRegistrySeed(),
    consents: [],
    audit,
    ops: [],
    notifications,
    history: HISTORY.map((h) => ({ ...h })),
  };
}

export function scenarioSummary(scenario: 'A' | 'B' | 'C') {
  const spec = SCENARIOS[scenario];
  return {
    invoiceNo: spec.invoiceNo,
    exchange: FX,
    valueUsd: spec.invoiceAmount,
    valueInr: Math.round(spec.invoiceAmount * FX),
  };
}
