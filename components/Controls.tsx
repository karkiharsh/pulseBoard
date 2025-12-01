import React from "react";
import { AppSettings } from "../types";
import { Settings, ZapOff, Activity, Monitor, FlameIcon } from "lucide-react";
import { clsx } from "clsx";

interface ControlsProps {
  settings: AppSettings;
  onToggle: (key: keyof AppSettings) => void;
}

export const Controls: React.FC<ControlsProps> = ({ settings, onToggle }) => {
  const ToggleBtn = ({
    active,
    onClick,
    label,
    icon: Icon,
  }: {
    active: boolean;
    onClick: () => void;
    label: string;
    icon: any;
  }) => (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center justify-between w-full p-3 rounded-lg text-sm font-medium transition-all duration-300 border focus:outline-none",
        active
          ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-200"
          : "bg-zinc-800/30 border-zinc-800 text-zinc-400 hover:bg-zinc-800/50"
      )}
    >
      <span className="flex items-center gap-2">
        <Icon
          size={16}
          className={clsx(
            "transition-colors duration-300",
            active ? "text-indigo-400" : "text-zinc-500"
          )}
        />
        {label}
      </span>

      {/* Smooth toggle switch */}
      <div
        className={clsx(
          "w-9 h-5 rounded-full relative transition-colors duration-500 ease-out",
          active ? "bg-indigo-500/90" : "bg-zinc-700"
        )}
      >
        <div
          className={clsx(
            "absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-500 ease-in-out",
            active ? "translate-x-4" : "translate-x-0"
          )}
        />
      </div>
    </button>
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
          <Settings size={18} />
        </div>
        <h2 className="text-base font-semibold text-white">
          Simulation Controls
        </h2>
      </div>

      <div className="space-y-3">
        <ToggleBtn
          active={settings.buffer}
          onClick={() => onToggle("buffer")}
          label="Buffer Non-Critical Events"
          icon={ZapOff}
        />
        <p className="text-[10px] text-zinc-500 px-1 mb-1">
          Disables buffering. Every event triggers a render. High CPU usage.
        </p>

        <ToggleBtn
          active={settings.OffloadToWorker}
          onClick={() => onToggle("OffloadToWorker")}
          label="Offload to Web Worker"
          icon={Activity}
        />
        <p className="text-[10px] text-zinc-500 px-1 mb-1">
          Runs heavy math on the main thread instead of a Web Worker. Freezes UI.
        </p>

        <ToggleBtn
          active={settings.profileMode}
          onClick={() => onToggle("profileMode")}
          label="Profile Mode"
          icon={Monitor}
        />
        <p className="text-[10px] text-zinc-500 px-1">
          Shows render counts on components to visualize optimization.
        </p>
        <ToggleBtn
          active={settings.useHeavyComputation}
          onClick={() => onToggle("useHeavyComputation")}
          label="Add Heavy Computation"
          icon={FlameIcon}
        />
        <p className="text-[10px] text-zinc-500 px-1">
          Simulates hevay blocking data processing.
        </p>
      </div>
    </div>
  );
};
