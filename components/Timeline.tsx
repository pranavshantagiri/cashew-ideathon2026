import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { TradeStatus } from '@/lib/types';

export interface TimelineItem {
  key: string;
  label: string;
  sub?: string;
}

export function Timeline({
  items,
  current,
  orientation = 'horizontal',
  compact,
}: {
  items: TimelineItem[];
  current: number;
  orientation?: 'horizontal' | 'vertical';
  compact?: boolean;
}) {
  if (orientation === 'vertical') {
    return (
      <ol className="space-y-0" aria-label="Timeline">
        {items.map((item, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={item.key} className="relative flex gap-3 pb-4 last:pb-0">
              {i < items.length - 1 && (
                <span className={cn('absolute left-[9px] top-5 h-full w-px', done ? 'bg-brand' : 'bg-line')} />
              )}
              <span
                className={cn(
                  'relative z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border',
                  done && 'border-brand bg-brand text-white',
                  active && 'border-brand bg-surface text-brand',
                  !done && !active && 'border-line bg-surface text-ink-3',
                )}
              >
                {done ? <Check size={11} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <div className="-mt-0.5">
                <div className={cn('text-[13px]', active ? 'font-medium text-ink' : done ? 'text-ink-2' : 'text-ink-3')}>
                  {item.label}
                </div>
                {item.sub && <div className="text-[12px] leading-4 text-ink-3">{item.sub}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }
  return (
    <ol className="flex items-start" aria-label="Timeline">
      {items.map((item, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={item.key} className="relative flex flex-1 flex-col items-center last:flex-none">
            {i < items.length - 1 && (
              <span className={cn('absolute left-1/2 top-[9px] h-px w-full', done ? 'bg-brand' : 'bg-line')} />
            )}
            <span
              className={cn(
                'relative z-10 flex h-[19px] w-[19px] items-center justify-center rounded-full border',
                done && 'border-brand bg-brand text-white',
                active && 'border-brand bg-surface text-brand',
                !done && !active && 'border-line bg-surface text-ink-3',
              )}
            >
              {done ? <Check size={11} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <span
              className={cn(
                'mt-2 text-center text-[11px] leading-4',
                active ? 'font-medium text-ink' : done ? 'text-ink-2' : 'text-ink-3',
                compact && 'max-w-[62px]',
              )}
            >
              {item.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export const TRADE_MILESTONES: TimelineItem[] = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'verified', label: 'Verified' },
  { key: 'offers', label: 'Offers' },
  { key: 'financed', label: 'Financed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'repaid', label: 'Repaid' },
];

const STATUS_TO_INDEX: Partial<Record<TradeStatus, number>> = {
  DRAFT: 0,
  SUBMITTED: 0,
  VERIFYING: 0,
  NEEDS_INFO: 0,
  VERIFIED: 1,
  OFFERS_OPEN: 2,
  OFFER_ACCEPTED: 2,
  CONTRACT_SIGNED: 3,
  FINANCED: 3,
  SHIPMENT_IN_TRANSIT: 4,
  DELIVERED: 5,
  BUYER_ACCEPTED: 5,
  REPAID: 6,
  CLOSED: 6,
};

export function tradeMilestoneIndex(status: TradeStatus): number {
  return STATUS_TO_INDEX[status] ?? 0;
}

export const SHIPMENT_MILESTONES: TimelineItem[] = [
  { key: 'loaded', label: 'Loaded', sub: 'Container stuffed at Tiruppur' },
  { key: 'sailed', label: 'Sailed', sub: 'MV Coromandel departed Tuticorin' },
  { key: 'arrived', label: 'Arrived', sub: 'Arrived at Felixstowe' },
  { key: 'delivered', label: 'Delivered', sub: 'Goods delivered to buyer' },
];
