import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface MetricCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'default' | 'danger' | 'success' | 'warning';
  className?: string;
}

export const MetricCard = React.memo(({ 
  title, 
  value, 
  subValue, 
  color = 'default', 
  className 
}: MetricCardProps) => {
  
  const colorStyles = {
    default: 'border-zinc-800 bg-zinc-900/50 text-zinc-100',
    danger: 'border-red-900/50 bg-red-950/30 text-red-200',
    success: 'border-emerald-900/50 bg-emerald-950/30 text-emerald-200',
    warning: 'border-amber-900/50 bg-amber-950/30 text-amber-200',
  };

  return (
    <div className={twMerge(
      'rounded-xl border p-4 backdrop-blur-sm transition-all duration-200',
      colorStyles[color],
      className
    )}>
      <h3 className="text-xs font-medium uppercase tracking-wider opacity-70 mb-1">
        {title}
      </h3>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight font-mono">
          {value}
        </span>
        {subValue && (
          <span className="text-xs opacity-60">
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
});

MetricCard.displayName = 'MetricCard';
