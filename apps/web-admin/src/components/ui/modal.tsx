'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          'w-full max-w-lg overflow-hidden rounded-2xl border border-border/60 bg-card',
          'shadow-brand-lg animate-fade-in-up my-auto',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border/60 bg-gradient-to-r from-apes-red-light/60 to-transparent px-6 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </h3>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="-mr-1.5 -mt-1 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Đóng"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/40 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmButton({
  message,
  onConfirm,
  className,
  children = 'Xóa',
}: {
  message: string;
  onConfirm: () => Promise<void> | void;
  className?: string;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = React.useState(false);
  const handle = async () => {
    if (!confirm(message)) return;
    setBusy(true);
    try {
      await onConfirm();
    } catch (e: any) {
      alert(`Lỗi: ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={handle}
      disabled={busy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-background px-3 py-1.5',
        'text-xs font-semibold text-destructive transition-all hover:bg-destructive/10',
        'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]',
        className
      )}
    >
      {children}
    </button>
  );
}