import React from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant = 'gold' | 'teal' | 'navy' | 'paper' | 'muted';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'gold',
  size = 'md',
  className,
}) => {
  const baseClasses =
    'inline-flex items-center gap-1.5 font-mono uppercase font-bold tracking-wider border-2 border-brand-dark select-none shadow-brutal-xs';

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const variantClasses: Record<BadgeVariant, string> = {
    gold: 'bg-brand-gold text-brand-dark',
    teal: 'bg-brand-teal text-white',
    navy: 'bg-brand-navy text-brand-bg',
    paper: 'bg-brand-paper text-brand-dark',
    muted: 'bg-brand-paper-tint text-brand-muted',
  };

  return (
    <span className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}>
      {children}
    </span>
  );
};
