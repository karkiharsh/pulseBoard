import React from 'react';
import { AppSettings } from '../types';
import { Settings, Zap, ZapOff, Activity, Monitor } from 'lucide-react';
import { clsx } from 'clsx';

interface ControlsProps {
  settings: AppSettings;
  onToggle: (key: keyof AppSettings) => void;
}

export const Controls: React.FC<ControlsProps> = ({ settings, onToggle }) => {
  const ToggleBtn = ({ 
    active, 
    onClick, 
    label, 
    icon: Icon 
  }: { 
    active: boolean; 
    onClick: () => void; 
    label: string; 
    icon: any 
  }) => (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center justify-between w-full p-3 rounded-lg text-sm font-medium transition-all duration-200 border",
        active 
          ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-200" 
          : "bg-zinc-800/30 border-zinc-800 text-zinc-400 hover:bg-zinc-800/50"
      )}
    >
      <span className="flex items-center gap-2">
        <Icon size={16} className={active ? "text-indigo-400" : "text-zinc-500"} />
        {label}
      </span>
      <div className={clsx(
        "w-8 h-4 rounded-full relative transition-colors",
        active ? "bg-indigo-500" : "bg-zinc-700"
      )}>
        <div className={clsx(
          "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200",
          active ? "left-4.5 translate-x-0" : "left-0.5"
        )} />
      </div>
    </button>
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
          <Settings size={20} />
        </div>
        <h2 className="text-lg font-semibold text-white">Simulation Controls</h2>
      </div>

      <div className="space-y-3">
        <ToggleBtn
          active={settings.buffer}
          onClick={() => onToggle('buffer')}
          label="Slow Mode (No Buffer)"
          icon={ZapOff}
        />
        <p className="text-[10px] text-zinc-500 px-1 mb-2">
          Disables buffering. Every event triggers a render. High CPU usage.
        </p>

        <ToggleBtn
          active={settings.workerOff}
          onClick={() => onToggle('workerOff')}
          label="Disable Worker"
          icon={Activity}
        />
        <p className="text-[10px] text-zinc-500 px-1 mb-2">
          Runs heavy math on the main thread instead of a Web Worker. Freezes UI.
        </p>
        
        <ToggleBtn
          active={settings.profileMode}
          onClick={() => onToggle('profileMode')}
          label="Profile Mode"
          icon={Monitor}
        />
        <p className="text-[10px] text-zinc-500 px-1">
          Shows render counts on components to visualize optimization.
        </p>
      </div>
    </div>
  );
};
