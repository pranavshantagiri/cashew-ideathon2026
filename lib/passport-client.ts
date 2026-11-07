'use client';

/**
 * Browser-side Trade Passport verification.
 * The credential carries its Ed25519 public key, so no API call is needed to verify.
 * WebCrypto is the fast path; tweetnacl is the fallback for browsers without Ed25519.
 */

export function canonicalJSON(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = norm((v as Record<string, unknown>)[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(norm(value));
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface PassportLike {
  type: string;
  id: string;
  issuer: string;
  subject: { orgId: string; legalName: string };
  issuedAt: string;
  expiresAt: string;
  claims: Record<string, unknown>;
  consent: { recipient: string; purpose: string; expiry: string };
  proof: { type: string; publicKey: string; signature: string };
}

export interface VerifyResult {
  valid: boolean;
  method: 'WebCrypto' | 'tweetnacl' | 'none';
  reason?: string;
}

export async function verifyPassport(passport: PassportLike): Promise<VerifyResult> {
  const { proof, ...unsigned } = passport;
  if (!proof?.signature || !proof?.publicKey) {
    return { valid: false, method: 'none', reason: 'The credential has no proof block.' };
  }
  const message = new TextEncoder().encode(canonicalJSON(unsigned));
  const signature = base64ToBytes(proof.signature);
  const publicKey = base64ToBytes(proof.publicKey);

  try {
    if (globalThis.crypto?.subtle) {
      const key = await globalThis.crypto.subtle.importKey(
        'raw',
        publicKey as unknown as BufferSource,
        { name: 'Ed25519' } as unknown as AlgorithmIdentifier,
        false,
        ['verify'],
      );
      const ok = await globalThis.crypto.subtle.verify(
        { name: 'Ed25519' } as unknown as AlgorithmIdentifier,
        key,
        signature as unknown as BufferSource,
        message as unknown as BufferSource,
      );
      return { valid: ok, method: 'WebCrypto', reason: ok ? undefined : 'The signature does not match the claims.' };
    }
  } catch {
    // fall through to tweetnacl
  }

  try {
    const nacl = (await import('tweetnacl')).default;
    const ok = nacl.sign.detached.verify(message, signature, publicKey);
    return { valid: ok, method: 'tweetnacl', reason: ok ? undefined : 'The signature does not match the claims.' };
  } catch (e) {
    return { valid: false, method: 'none', reason: 'This browser cannot verify Ed25519 signatures.' };
  }
}
