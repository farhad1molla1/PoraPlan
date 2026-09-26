import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import type { ButtonVariant, ButtonSize } from '../../types';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  to?: string;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  to,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}) => {
  const baseClasses = 
    'inline-flex items-center justify-center font-bold font-sans tracking-wide uppercase transition-all duration-100 ease-out border-2 border-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none';

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5 shadow-brutal-xs hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
    md: 'text-sm px-5 py-2.5 gap-2 shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
    lg: 'text-base px-6 py-3.5 gap-2.5 shadow-brutal-lg hover:-translate-x-1 hover:-translate-y-1 active:translate-x-1 active:translate-y-1 active:shadow-none',
  };

  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-brand-gold text-brand-dark hover:bg-[#e59b20]',
    secondary: 'bg-brand-teal text-white hover:bg-[#0995a1]',
    dark: 'bg-brand-navy text-brand-bg hover:bg-[#06213b]',
    outline: 'bg-brand-paper text-brand-dark hover:bg-brand-paper-tint',
    ghost: 'bg-transparent border-transparent shadow-none hover:bg-black/5 hover:border-brand-dark hover:shadow-brutal-xs',
  };

  const combinedClasses = cn(
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    fullWidth ? 'w-full' : '',
    className
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={combinedClasses}>
        {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </Link>
    );
  }

  return (
    <button className={combinedClasses} disabled={disabled} {...props}>
      {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};
