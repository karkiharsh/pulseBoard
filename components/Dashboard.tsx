import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSystemInfo } from '../api/systemInfo';
import { useSocketData } from '../hooks/useSocketData';
import { usePerformanceWorker } from '../hooks/usePerformanceWorker';
import { AppSettings } from '../types';
import { CriticalMetrics } from './CriticalMetrics';
import { NonCriticalMetrics } from './NonCriticalMetrics';
import { Controls } from './Controls';
import { Server, Wifi, WifiOff, Clock } from 'lucide-react';
import { clsx } from 'clsx';

export const Dashboard: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    buffer: false,
    workerOff: false,
    profileMode: false,
  });

  const { data: systemInfo, isLoading } = useQuery({
    queryKey: ['systemInfo'],
    queryFn: fetchSystemInfo,
  });

  // 1. Setup Computation Worker (receives batches)
  const { computedResult, processBatch } = usePerformanceWorker(settings.workerOff);

  // 2. Setup Data Stream (generates metrics + buffering)
  const { criticalMetric, isConnected } = useSocketData({
    onFlushBatch: processBatch,
    buffer: settings.buffer,
  });

  const toggleSetting = (key: keyof AppSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-zinc-900">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
              Pulse<span className="text-indigo-500">Board</span>
            </h1>
            <p className="text-zinc-400 text-sm">High-Performance React Architecture Demo</p>
          </div>
          
          <div className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
            <div className={clsx("flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium", isConnected ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
              {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
              {isConnected ? 'Socket Connected' : 'Disconnected'}
            </div>
            
            <div className="h-4 w-px bg-zinc-800" />
            
            <div className="flex items-center gap-2 text-xs text-zinc-400 px-2">
              <Server size={14} />
              {isLoading ? '...' : systemInfo?.region}
            </div>

             <div className="flex items-center gap-2 text-xs text-zinc-400 px-2">
              <Clock size={14} />
              {isLoading ? '...' : `${Math.floor((systemInfo?.uptimeSeconds || 0) / 3600)}h Uptime`}
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Col: Controls & Settings */}
          <div className="lg:col-span-1 space-y-6">
             <Controls settings={settings} onToggle={toggleSetting} />
             
             {/* System Status Card */}
             <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
               <h3 className="text-sm font-medium text-zinc-400 mb-4">System Health</h3>
               <div className="flex items-center justify-between">
                 <span className="text-2xl font-bold text-white">
                   {isLoading ? 'Loading...' : systemInfo?.status}
                 </span>
                 <div className={clsx(
                   "w-3 h-3 rounded-full shadow-[0_0_10px]",
                   systemInfo?.status === 'Healthy' ? "bg-emerald-500 shadow-emerald-500/50" : "bg-amber-500 shadow-amber-500/50"
                 )} />
               </div>
               <div className="mt-4 text-xs text-zinc-600 font-mono">
                 v{systemInfo?.version || '0.0.0'}
               </div>
             </div>
          </div>

          {/* Right Col: Metrics */}
          <div className="lg:col-span-2 space-y-6">
            <CriticalMetrics data={criticalMetric} settings={settings} />
            <NonCriticalMetrics computed={computedResult} settings={settings} />
          </div>
        </div>
      </div>
    </div>
  );
};
