import React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'buy' | 'sell' | 'purple' | 'amber' | 'blue' | 'neutral' | 'green' | 'red';

const variantClasses: Record<BadgeVariant, string> = {
  buy:     'bg-emerald-500/12 text-emerald-400 border-emerald-500/25',
  sell:    'bg-red-500/12 text-red-400 border-red-500/25',
  purple:  'bg-purple-500/12 text-purple-300 border-purple-500/25',
  amber:   'bg-amber-500/12 text-amber-400 border-amber-500/25',
  blue:    'bg-blue-500/12 text-blue-400 border-blue-500/25',
  neutral: 'bg-white/6 text-slate-300 border-white/10',
  green:   'bg-emerald-500/12 text-emerald-300 border-emerald-500/25',
  red:     'bg-red-500/12 text-red-300 border-red-500/25',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

export function Badge({ variant = 'neutral', children, className, size = 'sm' }: BadgeProps) {
  const sizeClasses = {
    xs: 'text-[9px] px-1.5 py-0.5',
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded font-bold border uppercase tracking-wide',
      sizeClasses[size],
      variantClasses[variant],
      className
    )}>
      {children}
    </span>
  );
}
