import Link from 'next/link';
import { Button } from './Button';

export function EmptyState({
  title,
  body,
  action,
  href,
  onAction,
  compact,
}: {
  title: string;
  body?: string;
  action?: string;
  href?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-14'}`}>
      <svg width="76" height="76" viewBox="0 0 76 76" fill="none" aria-hidden className="mb-4">
        <path
          d="M38 10c14 0 24 11 24 25 0 15-12 29-24 31-12-2-24-16-24-31 0-14 10-25 24-25Z"
          stroke="var(--line)"
          strokeWidth="1.6"
        />
        <path
          d="M38 18c7 0 14 5 16 13 2 9-5 19-16 26-11-7-18-17-16-26 2-8 9-13 16-13Z"
          stroke="var(--brand)"
          strokeWidth="1.4"
          opacity=".5"
        />
        <path d="M38 18v37" stroke="var(--line)" strokeWidth="1.4" />
        <circle cx="38" cy="28" r="1.6" fill="var(--accent)" />
      </svg>
      <div className="h3">{title}</div>
      {body && <p className="mt-1 max-w-sm text-[13px] leading-5 text-ink-2">{body}</p>}
      {action && (
        <div className="mt-4">
          {href ? (
            <Link href={href}>
              <Button>{action}</Button>
            </Link>
          ) : (
            <Button onClick={onAction}>{action}</Button>
          )}
        </div>
      )}
    </div>
  );
}
