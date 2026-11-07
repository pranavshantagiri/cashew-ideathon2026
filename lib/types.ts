export type Role = 'exporter' | 'lender' | 'ops';
export type CheckResult = 'pass' | 'fail' | 'unknown' | 'pending' | 'warn';
export type TradeStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'VERIFYING'
  | 'NEEDS_INFO'
  | 'VERIFIED'
  | 'OFFERS_OPEN'
  | 'OFFER_ACCEPTED'
  | 'CONTRACT_SIGNED'
  | 'FINANCED'
  | 'SHIPMENT_IN_TRANSIT'
  | 'DELIVERED'
  | 'BUYER_ACCEPTED'
  | 'REPAID'
  | 'CLOSED'
  | 'REJECTED_VERIFICATION'
  | 'WITHDRAWN'
  | 'DISPUTED'
  | 'DEFAULTED';

export type DocType = 'po' | 'invoice' | 'packing' | 'shippingBill' | 'bl';

export interface Org {
  id: string;
  type: 'sme' | 'lender' | 'ops';
  legalName: string;
  gstin?: string;
  iec?: string;
  udyam?: string;
  tier?: 0 | 1 | 2 | 3;
  city?: string;
  country?: string;
}

export interface Buyer {
  id: string;
  name: string;
  country: string;
  registrationId: string;
  yearsOfFilings?: number;
  rating?: string;
}

export interface Trade {
  id: string;
  smeId: string;
  buyerId: string;
  corridor: string;
  hsCode: string;
  value: number;
  currency: string;
  fx: number;
  incoterm: string;
  paymentTermsDays: number;
  status: TradeStatus;
  scenario: 'A' | 'B' | 'C';
  flaggedUnknownOrFailed: number[];
  createdAt: string;
  goods?: string;
  sample?: boolean;
}

export interface FieldValue {
  value: string | number | boolean;
  confidence: number;
  unit?: string;
  currency?: string;
}
export type ExtractedFields = Record<string, FieldValue>;

export interface Doc {
  id: string;
  tradeId: string;
  type: DocType;
  sha256: string;
  extracted: { docType: string; fields: ExtractedFields };
  verifiedStatus: CheckResult;
  version: number;
  filename?: string;
  uploadedAt?: string;
}

export interface VerificationCheck {
  id: string;
  tradeId: string;
  checkId: number;
  result: CheckResult;
  line: string;
  source: string;
  evidence: unknown;
  evidenceHash: string;
  runAt: string;
  durationMs: number;
  sequence: number;
}

export interface RiskProfile {
  tradeId: string;
  strength: number;
  band: 'Strong' | 'Moderate' | 'Limited';
  riskBand: 'Low' | 'Medium' | 'High';
  components: Record<string, number>;
  componentMax: Record<string, number>;
  blocking: number[];
  weights: number[];
  ruleVersion: string;
  computedAt: string;
}

export interface LenderProduct {
  id: string;
  lenderId: string;
  name: string;
  type: string;
  minTicket: number;
  maxTicket: number;
  sectors: string[];
  corridors: string[];
  maxTenureDays: number;
  minStrength: number;
  requiredDocs: string[];
  active: boolean;
  pricingModel?: string;
  disbursalHours?: number;
  advancePct?: number;
  ratePct?: number;
  fees?: Fee[];
  conditions?: string;
  validityDays?: number;
  recourse?: boolean;
  collateral?: string;
}

export interface Fee {
  label: string;
  kind: 'pctAdvance' | 'flat' | 'pctInvoice';
  value: number;
  statedIn: 'headline' | 'conditions';
}

export interface Offer {
  id: string;
  tradeId: string;
  lenderId: string;
  advancePct: number;
  ratePct: number;
  tenureDays: number;
  fees: Fee[];
  recourse: boolean;
  collateral: string;
  conditions: string;
  validUntil: string;
  status: 'open' | 'accepted' | 'expired' | 'declined';
  disbursalHours: number;
  submittedAt?: string;
  productType?: string;
}

export interface RegistryEntry {
  position: number;
  fingerprint: string;
  irnFingerprint?: string;
  lenderId: string;
  status: 'FINANCED' | 'SETTLED' | 'RELEASED';
  timestamp: string;
  prevHash: string;
  entryHash: string;
  signature: string;
  supplierId?: string;
  buyerId?: string;
  ref?: string;
  meta?: {
    supplierId: string;
    buyerId: string;
    invoiceNo: string;
    invoiceDate: string;
    amount: number;
    currency: string;
    irn?: string;
  };
}

export interface ConsentArtefact {
  id: string;
  orgId: string;
  scope: string;
  recipientOrgId: string;
  purpose: string;
  expiresAt: string;
  revokedAt?: string;
  tradeId?: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  object: string;
  timestamp: string;
  meta?: unknown;
  tradeId?: string;
}

export interface CheckDef {
  id: number;
  title: string;
  source: string;
  mode: 'staged' | 'real';
  durationMs: number;
  manualFallback: boolean;
  run: (ctx: unknown) => { result: CheckResult; line: string; evidence: unknown };
}

export interface OpsCase {
  id: string;
  tradeId: string;
  orgId: string;
  reason: string;
  detail: string;
  ageHours: number;
  reviewer: string;
  status: 'open' | 'closed';
  decision?: string;
  note?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  kind: 'info' | 'success' | 'warn' | 'offer';
  createdAt: string;
  read?: boolean;
}

export interface TradeHistory {
  id: string;
  smeId: string;
  buyerId: string;
  value: number;
  currency: string;
  completedAt: string;
  deliveredOnTime: boolean;
  repaidOnTime: boolean;
}

export interface ShipmentMilestone {
  key: string;
  label: string;
  at: string;
}

export interface VerificationRun {
  tradeId: string;
  startedAt: string;
  speed: number;
  checkIds: number[];
  schedule: { checkId: number; dueAt: number; durationMs: number }[];
}
