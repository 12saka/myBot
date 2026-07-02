import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  change?: { value: string; positive: boolean };
  icon?: LucideIcon;
  iconColor?: string;
  glowColor?: 'purple' | 'green' | 'red' | 'cyan' | 'amber';
  accentColor?: string;
  className?: string;
}

export function StatCard({
  label, value, subValue, change, icon: Icon, iconColor,
  glowColor, accentColor, className,
}: StatCardProps) {
  return (
    <div className={cn(
      'glass-card rounded-2xl p-5 group',
      glowColor && `hover:glow-${glowColor}`,
      className
    )}>
      {/* Ambient glow blob */}
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500"
        style={{ background: accentColor ?? 'rgba(139,92,246,0.5)' }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">
            {label}
          </div>
          <div className="text-2xl md:text-3xl font-display font-bold text-white leading-none mb-1 truncate">
            {value}
          </div>
          {subValue && (
            <div className="text-xs text-slate-500 mt-1">{subValue}</div>
          )}
          {change && (
            <div className={cn(
              'text-xs font-semibold mt-2 flex items-center gap-1',
              change.positive ? 'text-emerald-400' : 'text-red-400'
            )}>
              <span>{change.positive ? '↑' : '↓'}</span>
              <span>{change.value}</span>
            </div>
          )}
        </div>

        {Icon && (
          <div className="flex-shrink-0 p-3 rounded-xl" style={{ background: `${accentColor ?? 'rgba(139,92,246,0.15)'}` }}>
            <Icon size={22} style={{ color: iconColor ?? '#a78bfa' }} />
          </div>
        )}
      </div>
    </div>
  );
}
