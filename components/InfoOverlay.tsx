// components/InfoOverlay.tsx
import React from "react";
import { X } from "lucide-react";

export const InfoOverlay = ({ onClose }: { onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 px-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-lg w-full relative shadow-xl text-zinc-300">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300"
        >
          <X size={18} />
        </button>

        <h2 className="text-xl font-semibold text-white mb-4">
          About This Demo
        </h2>

        <p className="text-sm leading-relaxed text-zinc-400 mb-4">
          <strong>PulseBoard</strong> simulates a hospital dashboard receiving
          high-frequency data streams through WebSockets. It demonstrates how to:
        </p>

        <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1 mb-4">
          <li>Isolate critical and non-critical render paths in React.</li>
          <li>Prevent UI freezes with buffering and batching.</li>
          <li>Offload heavy computation to Web Workers.</li>
          <li>Visualize render frequency and CPU impact in real-time.</li>
        </ul>

        <p className="text-sm text-zinc-400 border-t border-zinc-800 pt-3 mt-4">
          💡 Want to explore interactively?
          <br />
          Click the <span className="font-semibold text-indigo-400">ℹ️</span>{" "}
          icon beside each control to see what happens when it’s toggled —
          including short visual demos and expected outcomes.
        </p>
      </div>
    </div>
  );
};
