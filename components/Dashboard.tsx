import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Controls } from './Controls';
import { MetricsContainer } from './MetricsContainer';
import { MetricsContainer2 } from './MetricsContainer2';
import { AppSettings } from '../types';
import { Server, Wifi, WifiOff, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { fetchSystemInfo } from '../api/systemInfo';
export const Dashboard: React.FC = () => {
  const renderCount = useRef(0);
  renderCount.current++;

  const [settings, setSettings] = useState<AppSettings>({
    buffer: false,
    workerOff: false,
    profileMode: false,
  });
 const { data: systemInfo, isLoading } = useQuery({
    queryKey: ['systemInfo'],
    queryFn: fetchSystemInfo,
  });

  const toggleSetting = (key: keyof AppSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  console.log('Dashboard rendered:', renderCount.current);

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 md:p-8">
       {settings.profileMode && (
        <span className="absolute top-2 right-2 text-[10px] bg-blue-500/20 text-blue-400 px-1.5 rounded">
          Renders: {renderCount.current}
        </span>
      )}
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
            <div className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400">
              <Wifi size={14} />
              Connected
            </div>
            <div className="h-4 w-px bg-zinc-800" />
            <div className="flex items-center gap-2 text-xs text-zinc-400 px-2">
              <Server size={14} />
              india
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400 px-2">
              <Clock size={14} />
              123h Uptime
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Col: Controls */}
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

          {/* Right Col: Metrics Container */}
          <div className="lg:col-span-2 space-y-6">
            <MetricsContainer settings={settings} />
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto space-y-6">
        <MetricsContainer2  />
      </div>
    </div>
  );
};
