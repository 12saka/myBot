import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, icon: Icon, iconColor = '#a78bfa', children, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4', className)}>
      <div className="flex items-center gap-2.5 sm:gap-3">
        {Icon && (
          <div className="p-2 rounded-lg shrink-0" style={{ background: `${iconColor}1a` }}>
            <Icon size={18} style={{ color: iconColor }} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white truncate">{title}</h1>
          {subtitle && <p className="text-slate-400 text-xs sm:text-sm mt-0.5 line-clamp-1 sm:line-clamp-none">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">{children}</div>}
    </div>
  );
}
