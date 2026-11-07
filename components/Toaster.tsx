'use client';

import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToasts } from '@/lib/client';

const icons = {
  info: Info,
  success: CheckCircle2,
  warn: AlertTriangle,
  danger: XCircle,
};
const colors = {
  info: 'text-unknown',
  success: 'text-success',
  warn: 'text-warn',
  danger: 'text-danger',
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[340px] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const kind = t.kind ?? 'info';
          const Icon = icons[kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-auto flex items-start gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-md"
              role="status"
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${colors[kind]}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-ink">{t.title}</div>
                {t.body && <div className="mt-0.5 text-[12px] leading-4 text-ink-2">{t.body}</div>}
                {t.action && (
                  <button
                    type="button"
                    onClick={t.action.onClick}
                    className="mt-1 text-[12px] font-medium text-brand underline"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded p-0.5 text-ink-3 hover:text-ink"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
