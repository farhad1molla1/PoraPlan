import React from 'react';
import { cn } from '../../lib/utils';
import { Badge } from './Badge';

export interface SectionHeadingProps {
  eyebrow?: string;
  badge?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  eyebrow,
  badge,
  title,
  description,
  align = 'left',
  className,
}) => {
  return (
    <div
      className={cn(
        'mb-10 md:mb-14',
        align === 'center' ? 'text-center mx-auto max-w-2xl' : 'max-w-2xl',
        className
      )}
    >
      {(eyebrow || badge) && (
        <div
          className={cn(
            'flex items-center gap-2 mb-3',
            align === 'center' ? 'justify-center' : 'justify-start'
          )}
        >
          {badge && <Badge variant="teal">{badge}</Badge>}
          {eyebrow && (
            <span className="font-mono text-xs uppercase tracking-widest text-brand-muted font-bold">
              {eyebrow}
            </span>
          )}
        </div>
      )}

      <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight leading-tight">
        {title}
      </h2>

      {description && (
        <p className="mt-3 text-base sm:text-lg text-brand-dark/85 leading-relaxed font-normal">
          {description}
        </p>
      )}
    </div>
  );
};
