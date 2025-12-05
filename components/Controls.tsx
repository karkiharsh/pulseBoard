import React, { useState } from "react";
import { AppSettings } from "../types";
import {
  Settings,
  ZapOff,
  Activity,
  Monitor,
  Flame,
  Info,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { InfoOverlay } from "./InfoOverlay";

interface ControlsProps {
  settings: AppSettings;
  onToggle: (key: keyof AppSettings) => void;
}

const TOGGLE_INFOS = {
  buffer: {
    title: "Buffer Non-Critical Events",
    description:
      "When enabled, batches non-critical updates into one render every 500ms. Prevents performance drops during high-frequency streams.",
    expected:
      "Non-critical metrics update less frequently but the UI stays smooth.",
    gif: "/assets/gifs/profileMode.gif",
  },
  OffloadToWorker: {
    title: "Offload to Web Worker",
    description:
      "Moves heavy data processing to a separate thread. Prevents the main UI from freezing during large data bursts.",
    expected:
      "Toggling this off may cause the dashboard to stutter under load.",
    gif: "/assets/gifs/profileMode.gif",
  },
  profileMode: {
    title: "Profile Mode",
    description:
      "Shows render counts on each component to visualize how frequently React re-renders different sections.",
    expected:
      "You’ll see small counters increment near each tile as they re-render.",
    gif: "/assets/gifs/profileMode.gif",
  },
  useHeavyComputation: {
    title: "Add Heavy Computation",
    description:
      "Simulates CPU-heavy data processing on the main thread, to mimic scenarios where computation blocks UI.",
    expected:
      "Expect temporary freezing or lag when this is on — Web Worker mode prevents that.",
    gif: "/assets/gifs/profileMode.gif",
  },
};

export const Controls: React.FC<ControlsProps> = ({ settings, onToggle }) => {
  const [showInfo, setShowInfo] = useState(false);
  const [activeInfo, setActiveInfo] = useState<string | null>(null);

  const ToggleBtn = ({
    active,
    onClick,
    label,
    icon: Icon,
    infoKey,
  }: {
    active: boolean;
    onClick: () => void;
    label: string;
    icon: any;
    infoKey: keyof typeof TOGGLE_INFOS;
  }) => (
    <div className="relative">
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

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveInfo(infoKey);
            }}
            className="p-1 text-zinc-500 hover:text-indigo-400 transition"
          >
            <Info size={14} />
          </button>

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
        </div>
      </button>

      {activeInfo === infoKey && (
        <div className="absolute z-40 top-14 left-0 w-[300px] bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-300 shadow-xl">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-white font-medium">
              {TOGGLE_INFOS[infoKey].title}
            </h3>
            <button
              onClick={() => setActiveInfo(null)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-zinc-400 mb-2">{TOGGLE_INFOS[infoKey].description}</p>
          <p className="text-xs text-zinc-500 mb-2">
            <strong>Expected:</strong> {TOGGLE_INFOS[infoKey].expected}
          </p>
          {TOGGLE_INFOS[infoKey].gif && (
            <img
              src={TOGGLE_INFOS[infoKey].gif}
              alt={TOGGLE_INFOS[infoKey].title}
              className="rounded-lg border border-zinc-800"
            />
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 relative">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
          <Settings size={18} />
        </div>
        <h2 className="text-base font-semibold text-white flex-1">
          Simulation Controls
        </h2>
        <button
          onClick={() => setShowInfo(true)}
          className="px-3 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          About This Demo
        </button>
      </div>

      {showInfo && <InfoOverlay onClose={() => setShowInfo(false)} />}

      <div className="space-y-3">
        <ToggleBtn
          active={settings.buffer}
          onClick={() => onToggle("buffer")}
          label="Buffer Non-Critical Events"
          icon={ZapOff}
          infoKey="buffer"
        />
        <ToggleBtn
          active={settings.OffloadToWorker}
          onClick={() => onToggle("OffloadToWorker")}
          label="Offload to Web Worker"
          icon={Activity}
          infoKey="OffloadToWorker"
        />
        <ToggleBtn
          active={settings.profileMode}
          onClick={() => onToggle("profileMode")}
          label="Profile Mode"
          icon={Monitor}
          infoKey="profileMode"
        />
        <ToggleBtn
          active={settings.useHeavyComputation}
          onClick={() => onToggle("useHeavyComputation")}
          label="Add Heavy Computation"
          icon={Flame}
          infoKey="useHeavyComputation"
        />
      </div>
    </div>
  );
};
