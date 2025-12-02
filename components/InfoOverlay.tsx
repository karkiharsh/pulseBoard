// InfoOverlay.tsx
import React from "react";
import { X } from "lucide-react";

export function InfoOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-xl w-full relative shadow-lg">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300"
        >
          <X size={18} />
        </button>

        <h2 className="text-xl font-semibold text-white mb-4">About PulseBoard</h2>
        <p className="text-sm text-zinc-400 mb-4">
          PulseBoard is a simulation of a high-performance React dashboard.
          It demonstrates techniques for handling high-frequency WebSocket data
          without freezing the UI, using buffered rendering and Web Workers.
        </p>

        <h3 className="text-md text-white mt-4 mb-2">🧩 Simulation Toggles</h3>
        <ul className="text-sm text-zinc-400 space-y-2 list-disc list-inside">
          <li>
            <strong>Buffer Non-Critical Events:</strong> Enables batching to
            reduce re-renders for high-frequency, low-priority updates.
          </li>
          <li>
            <strong>Offload to Web Worker:</strong> Moves heavy computation
            off the main thread to prevent UI freezes.
          </li>
          <li>
            <strong>Profile Mode:</strong> Displays live render counts on
            components to visualize optimization effects.
          </li>
          <li>
            <strong>Add Heavy Computation:</strong> Simulates blocking CPU
            operations to show how performance can degrade.
          </li>
        </ul>

        <h3 className="text-md text-white mt-4 mb-2">🎯 Try This</h3>
        <p className="text-sm text-zinc-400">
          Disable buffering and Web Workers, then toggle heavy computation to
          observe how React rendering performance is affected. Then re-enable
          them to see how optimization stabilizes the dashboard.
        </p>

        <h3 className="text-md text-white mt-4 mb-2">💡 Learning Outcome</h3>
        <p className="text-sm text-zinc-400">
          Understand how to isolate rendering ownership, use buffering for
          non-critical updates, and offload high-frequency processing to web workers for
          maintain smooth UI in real-time systems.
        </p>
      </div>
    </div>
  );
}
