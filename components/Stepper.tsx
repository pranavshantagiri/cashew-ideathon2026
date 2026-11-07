import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Stepper({
  steps,
  current,
  className,
}: {
  steps: string[];
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn('flex items-center', className)} aria-label="Progress">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-semibold',
                  done && 'border-brand bg-brand text-white',
                  active && 'border-brand bg-brand text-white',
                  !done && !active && 'border-line bg-surface text-ink-3',
                )}
              >
                {done ? <Check size={14} /> : i + 1}
              </span>
              <span
                className={cn(
                  'hidden whitespace-nowrap text-[12px] sm:block',
                  active ? 'font-medium text-ink' : done ? 'text-ink-2' : 'text-ink-3',
                )}
              >
                {step}
              </span>
            </div>
            {i < steps.length - 1 && <span className={cn('mx-3 h-px flex-1', done ? 'bg-brand' : 'bg-line')} />}
          </li>
        );
      })}
    </ol>
  );
}
