import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
  headerClassName?: string;
  closeOnBackdropClick?: boolean;
  showCloseButton?: boolean;
  ariaLabelledby?: string;
}

const maxWidthMap = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
};

/**
 * Reusable Mobile Bottom Sheet & Responsive Modal component.
 * Below `sm` breakpoint: renders as a bottom sheet with a drag handle and safe-area padding.
 * At and above `sm` breakpoint: renders as standard desktop centered dialog, preserving existing layouts.
 */
export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = 'xl',
  className,
  bodyClassName,
  footerClassName,
  headerClassName,
  closeOnBackdropClick = true,
  showCloseButton = true,
  ariaLabelledby,
}) => {
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Background scroll lock and focus restoration
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement | null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the sheet on open for screen readers
    const timer = setTimeout(() => {
      sheetRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);

      // Restore focus to previous element
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-brand-navy/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledby}
      onClick={handleBackdropClick}
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={cn(
          'w-full bg-brand-paper border-t-3 sm:border-2 border-brand-dark shadow-brutal-lg',
          'rounded-t-2xl sm:rounded-none',
          'max-h-[92dvh] sm:max-h-[90vh]',
          'flex flex-col',
          'focus:outline-none',
          'animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 duration-200',
          maxWidthMap[maxWidth],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle Affordance */}
        <div className="w-12 h-1.5 bg-brand-dark/25 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" aria-hidden="true" />

        {/* Sheet / Dialog Header */}
        <div
          className={cn(
            'flex items-center justify-between border-b-2 border-brand-dark px-4 py-3 sm:px-6 sm:py-4 shrink-0 bg-brand-paper',
            headerClassName
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            {icon && <span className="shrink-0">{icon}</span>}
            <div className="min-w-0">
              <h2
                id={ariaLabelledby}
                className="font-heading font-extrabold text-base sm:text-lg text-brand-navy truncate tracking-tight"
              >
                {title}
              </h2>
              {subtitle && (
                <p className="font-mono text-xs text-brand-muted truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] -mr-2 p-2 flex items-center justify-center text-brand-dark/80 hover:text-brand-dark hover:bg-brand-paper-tint border border-transparent hover:border-brand-dark transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sheet Body Content */}
        <div
          className={cn(
            'overflow-y-auto overscroll-contain flex-1 px-4 py-3.5 sm:px-6 sm:py-5 space-y-4 text-brand-dark',
            bodyClassName
          )}
        >
          {children}
        </div>

        {/* Sticky Action Footer */}
        {footer && (
          <div
            className={cn(
              'sticky bottom-0 z-10 bg-brand-paper border-t-2 border-brand-dark/15 px-4 py-3 sm:px-6 sm:py-3.5',
              'pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3.5',
              'flex items-center justify-end gap-2.5 shrink-0 shadow-xs',
              footerClassName
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
