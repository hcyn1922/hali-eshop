import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);
}

function useInitialFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !ref.current) return;
    const target = ref.current.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]), select, textarea');
    (target || ref.current).focus({ preventScroll: true });
  }, [open]);
  return ref;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

/** Centered dialog on desktop, bottom sheet on phones. */
export function Modal({ open, onClose, title, description, icon, footer, size = 'md', children }: ModalProps) {
  useEscape(open, onClose);
  const panelRef = useInitialFocus(open);
  if (!open) return null;
  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <div className="animate-fade-in absolute inset-0 bg-gray-950/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'animate-slide-up relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-surface shadow-xl outline-none sm:rounded-xl',
          widths[size]
        )}
      >
        <div className="flex items-start gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
          {icon && (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-subtle text-fg-2 ring-8 ring-subtle/50">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-fg">{title}</h2>
            {description && <p className="mt-1 text-sm text-fg-3">{description}</p>}
          </div>
          <Button variant="tertiary" size="sm" iconOnly icon={<X className="h-5 w-5" />} onClick={onClose} className="-mr-2 -mt-2">
            Close
          </Button>
        </div>
        {children && <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>}
        {footer && (
          <div className="pb-safe flex flex-col-reverse gap-3 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  width?: 'md' | 'lg';
}

/** Right-hand panel on desktop, full screen on phones. */
export function SlideOver({ open, onClose, title, description, headerExtra, footer, children, width = 'md' }: SlideOverProps) {
  useEscape(open, onClose);
  const panelRef = useInitialFocus(open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div className="animate-fade-in absolute inset-0 bg-gray-950/50 backdrop-blur-[1px]" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'animate-slide-in-right absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-xl outline-none',
          width === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-xl'
        )}
      >
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-fg">{title}</h2>
              {description && <div className="mt-1 text-sm text-fg-3">{description}</div>}
            </div>
            <Button variant="tertiary" size="sm" iconOnly icon={<X className="h-5 w-5" />} onClick={onClose} className="-mr-2">
              Close
            </Button>
          </div>
          {headerExtra && <div className="mt-3">{headerExtra}</div>}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="pb-safe flex flex-wrap justify-end gap-3 border-t border-line px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
