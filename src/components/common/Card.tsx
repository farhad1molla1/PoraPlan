import React from 'react';
import { cn } from '../../lib/utils';
import type { CardVariant } from '../../types';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  headerBar?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'paper',
  shadow = 'md',
  hoverable = false,
  headerBar,
  className,
  ...props
}) => {
  const baseClasses = 'relative border-2 border-brand-dark transition-all duration-150';

  const shadowClasses = {
    none: '',
    sm: 'shadow-brutal-sm',
    md: 'shadow-brutal',
    lg: 'shadow-brutal-lg',
  };

  const hoverClasses = hoverable
    ? 'hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-lg cursor-pointer'
    : '';

  const variantClasses: Record<CardVariant, string> = {
    default: 'bg-brand-paper text-brand-dark',
    paper: 'bg-brand-paper text-brand-dark',
    navy: 'bg-brand-navy text-brand-bg',
    gold: 'bg-brand-gold text-brand-dark',
    teal: 'bg-brand-teal text-white',
  };

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        shadowClasses[shadow],
        hoverClasses,
        className
      )}
      {...props}
    >
      {headerBar && (
        <div className="border-b-2 border-brand-dark px-4 py-2 bg-black/5 flex items-center justify-between font-mono text-xs uppercase tracking-wider">
          {headerBar}
        </div>
      )}
      <div className={headerBar ? 'p-5' : 'p-6'}>{children}</div>
    </div>
  );
};
