import { createHash } from 'node:crypto';

/** Deterministic JSON: object keys sorted at every level. */
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

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function shortHash(hash: string, head = 8, tail = 4): string {
  if (!hash) return '';
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}
