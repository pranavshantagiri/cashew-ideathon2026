import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { canonicalJSON } from './hash';

export interface PassportClaims {
  tier: number;
  entityChecks: Record<string, 'pass' | 'fail' | 'unknown'>;
  completedTrades: number;
  deliveredOnTime: number;
  repaidOnTime: number;
  totalFinancedInr: number;
}

export interface TradePassport {
  type: 'TradePassport';
  id: string;
  issuer: string;
  subject: { orgId: string; legalName: string };
  issuedAt: string;
  expiresAt: string;
  claims: PassportClaims;
  consent: { recipient: string; purpose: string; expiry: string };
  proof: { type: 'Ed25519'; publicKey: string; signature: string };
}

const PASSPORT_SEED = Buffer.from('cashew-passport-demo-key-seed-001', 'utf8').subarray(0, 32);
function passportKey() {
  const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  return createPrivateKey({ key: Buffer.concat([prefix, PASSPORT_SEED]), format: 'der', type: 'pkcs8' });
}

export function passportPublicKeyBase64(): string {
  const pub = createPublicKey(passportKey());
  const jwk = pub.export({ format: 'jwk' }) as { x?: string };
  return Buffer.from(jwk.x || '', 'base64url').toString('base64');
}

export function passportTier(completedTrades: number): 0 | 1 | 2 | 3 {
  if (completedTrades >= 4) return 3;
  if (completedTrades >= 3) return 2;
  if (completedTrades >= 1) return 1;
  return 0;
}

export function signPassport(unsigned: Omit<TradePassport, 'proof'>): TradePassport {
  const message = Buffer.from(canonicalJSON(unsigned), 'utf8');
  const signature = sign(null, message, passportKey()).toString('base64');
  return { ...unsigned, proof: { type: 'Ed25519', publicKey: passportPublicKeyBase64(), signature } };
}

export function verifyPassportOnServer(passport: TradePassport): boolean {
  try {
    const { proof, ...unsigned } = passport;
    const message = Buffer.from(canonicalJSON(unsigned), 'utf8');
    return verify(
      null,
      message,
      createPublicKey(passportKey()),
      Buffer.from(proof.signature, 'base64'),
    );
  } catch {
    return false;
  }
}

export interface PassportBuildInput {
  orgId: string;
  legalName: string;
  history: { value: number; deliveredOnTime: boolean; repaidOnTime: boolean; status?: string }[];
  entityChecks: Record<string, 'pass' | 'fail' | 'unknown'>;
  recipient: string;
  purpose: string;
  now?: Date;
  validityDays?: number;
}

export function buildPassport(input: PassportBuildInput): TradePassport {
  const now = input.now ?? new Date();
  const expires = new Date(now.getTime() + (input.validityDays ?? 30) * 86_400_000);
  const completed = input.history.length;
  const unsigned: Omit<TradePassport, 'proof'> = {
    type: 'TradePassport',
    id: `passport:${input.orgId}:${now.toISOString().slice(0, 10)}`,
    issuer: 'Cashew (demo)',
    subject: { orgId: input.orgId, legalName: input.legalName },
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    claims: {
      tier: passportTier(completed),
      entityChecks: input.entityChecks,
      completedTrades: completed,
      deliveredOnTime: input.history.filter((t) => t.deliveredOnTime).length,
      repaidOnTime: input.history.filter((t) => t.repaidOnTime).length,
      totalFinancedInr: Math.round(input.history.reduce((s, t) => s + t.value, 0)),
    },
    consent: { recipient: input.recipient, purpose: input.purpose, expiry: expires.toISOString().slice(0, 10) },
  };
  return signPassport(unsigned);
}
