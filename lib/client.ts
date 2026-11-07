'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

export interface ApiError extends Error {
  code?: string;
  status?: number;
  payload?: unknown;
}

export async function api<T = unknown>(
  path: string,
  init: (RequestInit & { json?: unknown }) = {},
): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
    ...rest,
    headers: { 'content-type': 'application/json', ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(
      (data as { error?: { message?: string } }).error?.message ?? `Request failed (${res.status})`,
    ) as ApiError;
    e.code = (data as { error?: { code?: string } }).error?.code;
    e.status = res.status;
    e.payload = data;
    throw e;
  }
  return data as T;
}

export function useApi<T = unknown>(
  path: string | null,
  opts: { interval?: number; enabled?: boolean } = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const alive = useRef(true);
  const pathRef = useRef(path);
  const seqRef = useRef(0);
  pathRef.current = path;

  const refresh = useCallback(async () => {
    const requestedPath = pathRef.current;
    if (!requestedPath) return;
    const requestId = ++seqRef.current;
    try {
      const next = await api<T>(requestedPath);
      if (alive.current && requestId === seqRef.current) {
        setData(next);
        setError(null);
      }
    } catch (e) {
      if (alive.current && requestId === seqRef.current) setError(e as ApiError);
    } finally {
      if (alive.current && requestId === seqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    // Any in-flight response from the previous path is now stale.
    seqRef.current += 1;
    setLoading(true);
    refresh();
    let timer: ReturnType<typeof setInterval> | undefined;
    if (opts.interval && opts.enabled !== false) {
      timer = setInterval(refresh, opts.interval);
    }
    const onRefresh = () => refresh();
    window.addEventListener('cashew:refresh', onRefresh);
    return () => {
      alive.current = false;
      if (timer) clearInterval(timer);
      window.removeEventListener('cashew:refresh', onRefresh);
    };
  }, [path, opts.interval, opts.enabled, refresh]);

  return { data, error, loading, refresh, setData };
}

/* ---------------------------------- toasts --------------------------------- */

export interface ToastItem {
  id: string;
  title: string;
  body?: string;
  kind?: 'info' | 'success' | 'warn' | 'danger';
  action?: { label: string; onClick: () => void };
}

interface ToastStore {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

let seq = 0;
export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = `toast_${++seq}`;
    set({ toasts: [...get().toasts, { ...t, id }] });
    setTimeout(() => get().dismiss(id), 4000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

export function toast(title: string, body?: string, kind: ToastItem['kind'] = 'info') {
  useToasts.getState().push({ title, body, kind });
}

/* --------------------------------- ui state -------------------------------- */

interface UiStore {
  demoOpen: boolean;
  notesOn: boolean;
  noteIndex: number;
  setDemoOpen: (v: boolean) => void;
  setNotesOn: (v: boolean) => void;
  nextNote: () => void;
}

export const useUi = create<UiStore>((set, get) => ({
  demoOpen: false,
  notesOn: true,
  noteIndex: 0,
  setDemoOpen: (v) => set({ demoOpen: v }),
  setNotesOn: (v) => set({ notesOn: v }),
  nextNote: () => set({ noteIndex: Math.min(get().noteIndex + 1, PRESENTER_NOTES.length - 1) }),
}));

export const PRESENTER_NOTES = [
  'Meet Kaveri Textiles. One invoice, ₹25 lakh, waiting 90 days to be paid.',
  'Five documents in. We read them in seconds.',
  'Fourteen checks, each against a source. Each result is pass, fail or unknown.',
  'Invoice says 4,800 pieces. The Bill of Lading says 4,200. A lender would have financed goods that never shipped.',
  'Fixed in a minute. The result is an evidence bundle, not a score.',
  'She consents once. Three lenders see the same verified trade.',
  'Sealed offers, normalised into one comparison.',
  'Lowest headline rate, highest real cost. A fee in the small print. We rank by what it costs the SME, never by commission.',
  'Accept, sign, funded. And the invoice is now in the shared registry.',
  'Now someone tries to finance the same invoice with another lender.',
  'Blocked, without revealing who financed it. Even a tweaked copy is caught.',
  'After repayment, her history becomes a signed credential a lender can verify in the browser. Change one number and it breaks.',
  'End. Every result is evidenced, every offer is comparable, every duplicate is caught.',
];
