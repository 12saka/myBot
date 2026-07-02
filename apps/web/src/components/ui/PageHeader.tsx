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
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4', className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2.5 rounded-xl" style={{ background: `${iconColor}1a` }}>
            <Icon size={22} style={{ color: iconColor }} />
          </div>
        )}
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
