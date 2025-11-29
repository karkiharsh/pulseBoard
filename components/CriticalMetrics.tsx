import React, { useEffect, useRef } from 'react';
import { MetricUpdate, AppSettings } from '../types';
import { AlertTriangle, Activity } from 'lucide-react';
import { clsx } from 'clsx';

interface CriticalMetricsProps {
  data: MetricUpdate | null;
  settings: AppSettings;
}

export const CriticalMetrics: React.FC<CriticalMetricsProps> = ({ data, settings }) => {
  const renderCount = useRef(0);
  
  renderCount.current++;
  

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
      {settings.profileMode && (
        <span className="absolute top-2 right-2 text-[10px] bg-blue-500/20 text-blue-400 px-1.5 rounded">
          Renders: {renderCount.current}
        </span>
      )}
      
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-red-500/10 rounded-lg text-red-500 animate-pulse">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Critical Feed</h2>
          <p className="text-xs text-zinc-500">Real-time unbuffered updates</p>
        </div>
      </div>

      {!data ? (
        <div className="h-24 flex items-center justify-center text-zinc-600 border border-dashed border-zinc-800 rounded-lg">
          <span className="flex items-center gap-2 text-sm">
            <Activity size={14} /> Waiting for critical event...
          </span>
        </div>
      ) : (
        <div key={data.id} className="relative z-10">
          <div className="flex justify-between items-end">
            <div>
              <div className="text-sm text-red-400 font-mono mb-1">{data.label}</div>
              <div className="text-4xl font-bold text-white font-mono tracking-tighter">
                {data.value.toFixed(1)}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">ID</div>
              <div className="text-xs font-mono text-zinc-400">{data.id.slice(0, 8)}...</div>
            </div>
          </div>
          <div className="mt-4 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-500 transition-all duration-300 ease-out"
              style={{ width: `${data.value}%` }}
            />
          </div>
        </div>
      )} 
      
      <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-red-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-red-500/10 transition-colors" />
    </div>
  );
};
