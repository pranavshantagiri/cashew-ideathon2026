export function inr(n: number, opts: { decimals?: number } = {}): string {
  const d = opts.decimals ?? 0;
  return `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })}`;
}

export function usd(n: number, code = 'USD'): string {
  return `${code} ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function usdInr(amountUsd: number, fx = 85): string {
  return `${usd(amountUsd)} (${inr(amountUsd * fx)} @ ${fx.toFixed(2)})`;
}

export function pct(n: number, digits = 2): string {
  return `${Number(n || 0).toFixed(digits)}%`;
}

export function dateOnly(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${dateOnly(iso)}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export function timeAgo(iso?: string): string {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function titleCase(s: string): string {
  return s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

export const DOC_LABELS: Record<string, string> = {
  po: 'Purchase Order',
  invoice: 'Commercial Invoice',
  packing: 'Packing List',
  shippingBill: 'Shipping Bill',
  bl: 'Bill of Lading',
};

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  VERIFYING: 'Verifying',
  NEEDS_INFO: 'Needs info',
  VERIFIED: 'Verified',
  OFFERS_OPEN: 'Offers open',
  OFFER_ACCEPTED: 'Offer accepted',
  CONTRACT_SIGNED: 'Signed',
  FINANCED: 'Financed',
  SHIPMENT_IN_TRANSIT: 'In transit',
  DELIVERED: 'Delivered',
  BUYER_ACCEPTED: 'Buyer accepted',
  REPAID: 'Repaid',
  CLOSED: 'Closed',
  REJECTED_VERIFICATION: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  DISPUTED: 'Disputed',
  DEFAULTED: 'Defaulted',
};

export function tradeValue(trade: { value: number; currency: string; fx: number }, invoiceUsd?: number): string {
  if (invoiceUsd != null) return usdInr(invoiceUsd, trade.fx);
  return inr(trade.value);
}

export const HORIZON = 85;
