// CriticalMetrics2.tsx
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Activity } from "lucide-react";
import type { CriticalEvent, HospitalEvent } from "../types";

export function CriticalMetrics2({ worker }: { worker: Worker }) {
  const [data, setData] = useState<CriticalEvent | null>(null);
  const renderCount = useRef(0);
  renderCount.current++;

  useEffect(() => {
    const onMsg = (e: MessageEvent<HospitalEvent>) => {
      const msg = e.data;
      if (msg.type === "CRITICAL") setData(msg);
    };
    worker.addEventListener("message", onMsg);
    return () => worker.removeEventListener("message", onMsg);
  }, [worker]);

  console.log("🔥 CriticalMetrics render", renderCount.current, data?.label);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4 relative overflow-hidden">
      <span className="absolute top-2 right-2 text-[10px] bg-blue-500/20 text-blue-400 px-1.5 rounded">
        Renders: {renderCount.current}
      </span>

      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-red-500/10 rounded-lg text-red-500 animate-pulse">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Critical Alerts</h2>
          <p className="text-xs text-zinc-500">Patient & Device Emergencies</p>
        </div>
      </div>

      {!data ? (
        <div className="h-24 flex items-center justify-center text-zinc-600 border border-dashed border-zinc-800 rounded-lg">
          <span className="flex items-center gap-2 text-sm">
            <Activity size={14} /> Waiting for hospital alert...
          </span>
        </div>
      ) : (
        <div key={data.id} className="space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-red-400 font-mono">{data.label}</div>
              <div className="text-4xl font-bold text-white font-mono tracking-tighter">
                {data.value.toFixed(1)} {data.unit}
              </div>
            </div>
            <div className="text-xs text-zinc-500 text-right">
              <div>{data.patientName}</div>
              <div>{data.ward}</div>
            </div>
          </div>

          <div className="text-xs text-red-400 mt-2">
            {data.alertMessage} ({data.severity})
          </div>
          <div className="mt-2 text-[10px] text-zinc-500">
            Ack: {data.acknowledged ? "✅ Yes" : "❌ No"}
          </div>

          <div className="mt-4 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-300 ease-out"
              style={{ width: `${data.value}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
