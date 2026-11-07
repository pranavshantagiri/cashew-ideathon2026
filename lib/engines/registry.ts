import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { canonicalJSON, sha256 } from './hash';
import type { RegistryEntry } from '@/lib/types';

export const REGISTRY_SALT = 'cashew-demo-registry-salt-v1';
export const CHAIN_GENESIS = 'GENESIS';

/** Deterministic demo signing key, so a persisted chain verifies after a server restart. */
function demoSeed(): Buffer {
  return Buffer.from('cashew-registry-demo-key-seed-0001', 'utf8').subarray(0, 32);
}
let cachedPrivate: KeyObject | null = null;
function privateKey(): KeyObject {
  if (!cachedPrivate) {
    const seed = demoSeed();
    const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
    cachedPrivate = createPrivateKey({
      key: Buffer.concat([prefix, seed]),
      format: 'der',
      type: 'pkcs8',
    });
  }
  return cachedPrivate;
}
export function registryPublicKeyRaw(): Buffer {
  const pub = createPublicKey(privateKey());
  const jwk = pub.export({ format: 'jwk' }) as { x?: string };
  return Buffer.from(jwk.x || '', 'base64url');
}
export function registryPublicKeyBase64(): string {
  return registryPublicKeyRaw().toString('base64');
}
export function signEntryHash(entryHash: string): string {
  return sign(null, Buffer.from(entryHash, 'utf8'), privateKey()).toString('base64');
}
function verifyEntryHash(entryHash: string, signature: string): boolean {
  try {
    return verify(
      null,
      Buffer.from(entryHash, 'utf8'),
      createPublicKey(privateKey()),
      Buffer.from(signature, 'base64'),
    );
  } catch {
    return false;
  }
}

export interface FingerprintInput {
  supplierId: string;
  buyerId: string;
  invoiceNo: string;
  invoiceDate: string;
  amount: number;
  currency: string;
  irn?: string;
}

function norm(v: string | number): string {
  return String(v).trim().toUpperCase();
}

export function fingerprint(input: FingerprintInput): string {
  const canonical = [
    REGISTRY_SALT,
    norm(input.supplierId),
    norm(input.buyerId),
    norm(input.invoiceNo),
    norm(input.invoiceDate),
    Number(input.amount).toFixed(2),
    norm(input.currency),
  ].join('|');
  return sha256(canonical);
}

export function irnFingerprint(irn?: string): string | undefined {
  if (!irn) return undefined;
  return sha256(`${REGISTRY_SALT}|IRN|${norm(irn)}`);
}

export function entryCore(entry: RegistryEntry) {
  return {
    position: entry.position,
    fingerprint: entry.fingerprint,
    ...(entry.irnFingerprint ? { irnFingerprint: entry.irnFingerprint } : {}),
    lenderId: entry.lenderId,
    status: entry.status,
    timestamp: entry.timestamp,
  };
}

export function buildEntry(
  prev: RegistryEntry | undefined,
  input: Omit<RegistryEntry, 'position' | 'prevHash' | 'entryHash' | 'signature'>,
): RegistryEntry {
  const position = (prev?.position ?? 0) + 1;
  const prevHash = prev?.entryHash ?? CHAIN_GENESIS;
  const draft: RegistryEntry = {
    ...input,
    position,
    prevHash,
    entryHash: '',
    signature: '',
  };
  draft.entryHash = sha256(prevHash + canonicalJSON(entryCore(draft)));
  draft.signature = signEntryHash(draft.entryHash);
  return draft;
}

export interface ChainVerification {
  intact: boolean;
  entriesVerified: number;
  brokenAt?: number;
  reason?: string;
  head?: string;
}

export function verifyChain(entries: RegistryEntry[]): ChainVerification {
  const ordered = [...entries].sort((a, b) => a.position - b.position);
  let prevHash = CHAIN_GENESIS;
  for (const entry of ordered) {
    if (entry.prevHash !== prevHash) {
      return { intact: false, entriesVerified: entry.position - 1, brokenAt: entry.position, reason: 'Previous hash does not match.' };
    }
    const expected = sha256(prevHash + canonicalJSON(entryCore(entry)));
    if (expected !== entry.entryHash) {
      return { intact: false, entriesVerified: entry.position - 1, brokenAt: entry.position, reason: 'Entry hash does not match its contents.' };
    }
    if (!verifyEntryHash(entry.entryHash, entry.signature)) {
      return { intact: false, entriesVerified: entry.position - 1, brokenAt: entry.position, reason: 'Signature is invalid.' };
    }
    prevHash = entry.entryHash;
  }
  return { intact: true, entriesVerified: ordered.length, head: ordered.at(-1)?.entryHash ?? CHAIN_GENESIS };
}

export type DuplicateCode = 'NONE' | 'FINANCED_BY_OTHER' | 'POSSIBLE_DUPLICATE' | 'RELEASED';

export interface SimilarityBreakdown {
  invoiceNo: number;
  amount: number;
  date: number;
  currency: number;
  irn: number;
  total: number;
  invoiceDistance: number;
  amountDeltaPct: number;
  dateDeltaDays: number;
}

export interface DuplicateCheck {
  code: DuplicateCode;
  similarity?: number;
  breakdown?: SimilarityBreakdown;
  entry?: { position: number; status: string; timestamp: string; fingerprint: string };
  message: string;
  matchedFingerprint?: string;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export function similarity(
  a: { invoiceNo: string; invoiceDate: string; amount: number; currency: string; irn?: string },
  b: { invoiceNo: string; invoiceDate: string; amount: number; currency: string; irn?: string },
): SimilarityBreakdown {
  const invA = norm(a.invoiceNo);
  const invB = norm(b.invoiceNo);
  const dist = levenshtein(invA, invB);
  const invSim = invA || invB ? 1 - dist / Math.max(invA.length, invB.length) : 0;

  const amountDelta = Math.abs(a.amount - b.amount) / Math.max(a.amount, b.amount);
  const amountSim = amountDelta <= 0.01 ? 1 : amountDelta >= 0.1 ? 0 : 1 - (amountDelta - 0.01) / 0.09;

  const dateDelta = Math.abs(new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime()) / 86_400_000;
  const dateSim = dateDelta === 0 ? 1 : dateDelta >= 14 ? 0 : 1 - dateDelta / 14;

  const currencySim = norm(a.currency) === norm(b.currency) ? 1 : 0;
  const irnSim = a.irn && b.irn && norm(a.irn) === norm(b.irn) ? 1 : 0;

  const total = invSim * 0.3 + amountSim * 0.3 + dateSim * 0.2 + currencySim * 0.1 + irnSim * 0.1;
  return {
    invoiceNo: invSim * 0.3,
    amount: amountSim * 0.3,
    date: dateSim * 0.2,
    currency: currencySim * 0.1,
    irn: irnSim * 0.1,
    total,
    invoiceDistance: dist,
    amountDeltaPct: amountDelta * 100,
    dateDeltaDays: dateDelta,
  };
}

/** Look up a fingerprint against the chain. Never returns the other lender's identity or raw data. */
export function checkDuplicate(
  input: FingerprintInput,
  entries: RegistryEntry[],
  lenderId: string,
): DuplicateCheck {
  const fp = fingerprint(input);
  const irnFp = irnFingerprint(input.irn);
  const active = entries.filter((e) => e.status !== 'SETTLED');

  const exact = active.find((e) => e.fingerprint === fp && e.status === 'FINANCED');
  if (exact) {
    if (exact.status === 'RELEASED') {
      return { code: 'RELEASED', message: 'A matching entry was released, so this invoice is free.', matchedFingerprint: fp };
    }
    return {
      code: 'FINANCED_BY_OTHER',
      message: 'This invoice has already been financed through Cashew. Details of the other lender are not shared.',
      entry: { position: exact.position, status: exact.status, timestamp: exact.timestamp, fingerprint: exact.fingerprint },
      matchedFingerprint: fp,
    };
  }

  const releasedMatch = entries.find((e) => e.fingerprint === fp && e.status === 'RELEASED');
  if (releasedMatch) {
    return { code: 'RELEASED', message: 'A matching entry was released, so this invoice is free.', matchedFingerprint: fp };
  }

  // Fuzzy candidates: same hashed supplier and buyer only.
  const candidates = entries.filter(
    (e) => e.status === 'FINANCED' && e.supplierId === input.supplierId && e.buyerId === input.buyerId,
  );
  let best: { entry: RegistryEntry; breakdown: SimilarityBreakdown } | null = null;
  for (const entry of candidates) {
    if (entry.ref === input.invoiceNo && entry.fingerprint === fp) continue;
    // Reconstruct enough of the candidate for comparison from the fingerprint metadata is impossible;
    // the demo stores a non-sensitive comparison reference (invoice number, date, amount) beside hashes.
    const meta = (entry as RegistryEntry & { meta?: FingerprintInput }).meta;
    if (!meta) continue;
    const bd = similarity(input, meta);
    if (!best || bd.total > best.breakdown.total) best = { entry, breakdown: bd };
  }
  if (best && best.breakdown.total >= 0.8) {
    return {
      code: 'POSSIBLE_DUPLICATE',
      similarity: best.breakdown.total,
      breakdown: best.breakdown,
      entry: {
        position: best.entry.position,
        status: best.entry.status,
        timestamp: best.entry.timestamp,
        fingerprint: best.entry.fingerprint,
      },
      matchedFingerprint: fp,
      message: 'Possible duplicate. This invoice is similar to one already financed through Cashew.',
    };
  }
  return { code: 'NONE', message: 'No match in the duplicate-financing registry.', matchedFingerprint: fp };
}
