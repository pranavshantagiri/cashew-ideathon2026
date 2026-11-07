'use client';

import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { cn } from '@/lib/cn';

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 480,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="scrim absolute inset-0"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: width }}
            animate={{ x: 0 }}
            exit={{ x: width }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-0 flex h-full flex-col bg-surface shadow-md"
            style={{ width: `min(${width}px, 94vw)` }}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : 'Drawer'}
          >
            <header className="flex items-start justify-between border-b border-line px-6 py-4">
              <div>
                <div className="h3">{title}</div>
                {subtitle && <div className="mt-0.5 text-[12px] leading-4 text-ink-3">{subtitle}</div>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-ink-3 hover:bg-canvas hover:text-ink"
                aria-label="Close drawer"
              >
                <X size={18} />
              </button>
            </header>
            <div className="thin-scroll flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <footer className="border-t border-line px-6 py-4">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="scrim absolute inset-0"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : 'Modal'}
            className={cn('relative flex max-h-[90vh] w-full max-w-[560px] flex-col rounded-card bg-surface shadow-md', className)}
          >
            <header className="flex items-start justify-between border-b border-line px-6 py-4">
              <div>
                <div className="h3">{title}</div>
                {subtitle && <div className="mt-0.5 text-[12px] leading-4 text-ink-3">{subtitle}</div>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-ink-3 hover:bg-canvas hover:text-ink"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </header>
            <div className="thin-scroll flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <footer className="border-t border-line px-6 py-4">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
