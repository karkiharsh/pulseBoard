import React, { useRef } from 'react';
import { ComputedMetrics, AppSettings } from '../types';
import { MetricCard } from './MetricCard';
import { BarChart2, Layers, Cpu, Database } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, YAxis, Tooltip } from 'recharts';

interface NonCriticalMetricsProps {
  computed: ComputedMetrics | null;
  settings: AppSettings;
}

export const NonCriticalMetrics: React.FC<NonCriticalMetricsProps> = ({ computed, settings }) => {
  const renderCount = useRef(0);

  if (settings.profileMode) {
    renderCount.current++;
  }

  // Mock data for the chart based on current stats to make it look active
  const chartData = computed ? [
    { name: 'Min', value: computed.min },
    { name: 'Avg', value: computed.average },
    { name: 'Max', value: computed.max },
  ] : [];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative">
      {settings.profileMode && (
        <span className="absolute top-2 right-2 text-[10px] bg-blue-500/20 text-blue-400 px-1.5 rounded">
          Renders: {renderCount.current}
        </span>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
          <Layers size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Aggregated Stream</h2>
          <p className="text-xs text-zinc-500">
            {settings.buffer 
              ? 'Warning: Slow Mode active (No buffering)' 
              : 'Buffered & Batched (500ms intervals)'}
          </p>
        </div>
      </div>

      {!computed ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-zinc-800/50 animate-pulse rounded-xl" />
          <div className="h-24 bg-zinc-800/50 animate-pulse rounded-xl" />
          <div className="h-24 bg-zinc-800/50 animate-pulse rounded-xl" />
          <div className="h-24 bg-zinc-800/50 animate-pulse rounded-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
             <MetricCard 
               title="Batch Size" 
               value={computed.count} 
               subValue="events"
               color="default"
             />
             <MetricCard 
               title="Average Load" 
               value={computed.average} 
               subValue="%"
               color={computed.average > 75 ? 'warning' : 'default'}
             />
             <MetricCard 
               title="Min Value" 
               value={computed.min} 
             />
             <MetricCard 
               title="Max Value" 
               value={computed.max}
               color={computed.max > 90 ? 'danger' : 'default'}
             />
          </div>

          {/* Visualization of the distribution */}
          <div className="h-32 mt-4 bg-zinc-950/30 rounded-lg border border-zinc-800/50 p-2 overflow-hidden relative">
             <div className="absolute top-2 left-2 text-[10px] text-zinc-500 uppercase font-medium">Distribution</div>
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={chartData}>
                 <YAxis hide domain={[0, 100]} />
                 <Tooltip 
                   contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }}
                   itemStyle={{ color: '#e4e4e7' }}
                   cursor={{fill: 'transparent'}}
                 />
                 <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
               </BarChart>
             </ResponsiveContainer>
          </div>
          
          <div className="flex justify-between items-center pt-2 border-t border-zinc-800/50">
             <div className="flex items-center gap-2 text-xs text-zinc-500">
               <Cpu size={12} />
               <span>Processing: {settings.workerOff ? 'Main Thread' : 'Web Worker'}</span>
             </div>
             <div className="text-[10px] font-mono text-zinc-600">
               Last: {new Date(computed.lastProcessedTimestamp).toLocaleTimeString()}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
