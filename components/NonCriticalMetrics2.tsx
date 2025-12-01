import React, { useEffect, useRef, useState } from "react";
import { Layers, Activity, Cpu, TrendingUp } from "lucide-react";
import type { NonCriticalEvent, HospitalEvent } from "../types";
import { LiveTrendChart } from "./LiveTrendChart";
import { useDashboard } from "@/context/DashboardContext";

interface PatientMetrics {
  count: number;
  average: number;
  min: number;
  max: number;
  lastProcessedTimestamp: number;
}

interface PopulationPoint {
  windowEnd: number;
  rollingAvg: number;
  rollingStdDev: number;
  deviation: number;
  anomalyScore: number;
  confidence: number;
}

function isNonCriticalEvent(e: HospitalEvent): e is NonCriticalEvent {
  return e.type === "NON_CRITICAL";
}

const BASELINE = 75;
const FLUSH_MS = 500;
const WINDOW_MS = 30_000;
const MAX_POINTS = Math.ceil(WINDOW_MS / FLUSH_MS);

export function NonCriticalMetrics2({ worker }: { worker: Worker }) {
  // -------- React state (UI-facing only) --------
  const [computedByPatient, setComputedByPatient] = useState<Record<string, PatientMetrics>>({});
  const [populationAverages, setPopulationAverages] = useState<PopulationPoint | null>(null);
  const [populationHistory, setPopulationHistory] = useState<PopulationPoint[]>([]);

  const { settings } = useDashboard();
  const renderCount = useRef(0);
  renderCount.current++;

  // -------- Runtime flags/refs (no re-renders) --------
  const offloadWork = useRef<boolean>(settings.OffloadToWorker);
  const useHeavyComputation = useRef<boolean>(settings.useHeavyComputation);
  const currentMode = useRef<"main" | "worker">(settings.OffloadToWorker ? "worker" : "main");
  const activeComputeSource = useRef<"main" | "worker">("main"); // who owns updates *right now*

  useEffect(() => {
    offloadWork.current = settings.OffloadToWorker;
    currentMode.current = settings.OffloadToWorker ? "worker" : "main";
    useHeavyComputation.current = settings.useHeavyComputation;

    // Reset transient timeline & queue on mode flip to avoid stale merges
    queueRef.current = [];
    workerBusy.current = false;
    populationHistoryRef.current = [];
    setPopulationHistory([]);
    setPopulationAverages(null);
    lastWindowTimestampRef.current = 0;
    // Note: we intentionally do NOT clear historyRef; patient mini-sparks persist.
    // eslint-disable-next-line no-console
    console.log(`🔁 Offload mode switched → ${currentMode.current}`);
  }, [settings.OffloadToWorker, settings.useHeavyComputation]);

  // -------- Buffers & rolling stores --------
  const bufferRef = useRef<Record<string, NonCriticalEvent[]>>({});
  const historyRef = useRef<Record<string, PatientMetrics[]>>({});
  const populationHistoryRef = useRef<PopulationPoint[]>([]);
  const lastWindowTimestampRef = useRef<number>(0);

  // -------- Worker system --------
  const computeWorkerRef = useRef<Worker | null>(null);
  const workerBusy = useRef(false);
  const queueRef = useRef<any[]>([]);
  const MAX_QUEUE = 5;

  // -------- Helpers --------
  const mean = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
  const stddev = (nums: number[]) => {
    if (nums.length <= 1) return 0;
    const m = mean(nums);
    const v = mean(nums.map((x) => (x - m) ** 2));
    return Math.sqrt(v);
  };
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

  // Build "latest" snapshot from historyRef (avoids stale state closures)
  const buildLatestFromHistory = () => {
    const latest: Record<string, PatientMetrics> = {};
    for (const [id, arr] of Object.entries(historyRef.current) as [string, PatientMetrics[]][]) {
      if (arr.length > 0) latest[id] = arr[arr.length - 1];
    }
    return latest;
  };

  // Keep windowEnd strictly increasing; also correct if worker result is late
  const normalizeWindowEnd = (pt: PopulationPoint) => {
    const now = Date.now();
    if (now - pt.windowEnd > FLUSH_MS * 2) pt.windowEnd = now; // drift fix
    if (pt.windowEnd <= lastWindowTimestampRef.current) pt.windowEnd = lastWindowTimestampRef.current + 1;
    lastWindowTimestampRef.current = pt.windowEnd;
  };

  // Push populationPoint into rolling window and update state
  const commitPopulationPoint = (pt: PopulationPoint) => {
    populationHistoryRef.current.push(pt);
    const now = Date.now();
    while (
      populationHistoryRef.current.length > 0 &&
      (now - populationHistoryRef.current[0].windowEnd > WINDOW_MS ||
        populationHistoryRef.current.length > MAX_POINTS)
    ) {
      populationHistoryRef.current.shift();
    }
    setPopulationAverages(pt);
    setPopulationHistory([...populationHistoryRef.current]);
  };

  // -------- Compute Worker: create once --------
  useEffect(() => {
    if (computeWorkerRef.current) return;

    const workerCode = `
      self.onmessage = (e) => {
        const { type, id, payload, useHeavyComputation } = e.data;
        if (type !== "process") return;

        // Simulate optional heavy CPU work
        const start = performance.now();
        try {
          if (useHeavyComputation) {
            const stopAt = performance.now() + 2000;
            let f = 0; let b = 0n;
            while (performance.now() < stopAt) {
              for (let i = 0; i < 3_000_000; i++) {
                f += Math.sqrt((i % 997) + f) / (1 + (f % 13));
                f = f % 1e9;
                b += BigInt((i * 37) % 104729) * BigInt((i * 41) % 130099);
                b = b % 10_000_000_000_000_000_000n;
              }
            }
          }
        } finally {
          const latency = performance.now() - start;
          self.postMessage({ type: "done", id, result: payload, latency });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url);
    computeWorkerRef.current = w;

    const onMsg = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type !== "done") return;

      // Discard if worker no longer owns the timeline
      if (currentMode.current !== "worker" || activeComputeSource.current !== "worker") return;

      workerBusy.current = false;

      const { latest, populationPoint } = msg.result as {
        latest: Record<string, PatientMetrics>;
        populationPoint: PopulationPoint | null;
      };

      if (populationPoint) {
        normalizeWindowEnd(populationPoint);
        commitPopulationPoint(populationPoint);
      }
      if (latest) setComputedByPatient(latest);

      trySendNextBatch();
    };

    const onError = (err: ErrorEvent) => {
      // eslint-disable-next-line no-console
      console.error("Compute worker error:", err.message);
      workerBusy.current = false;
    };

    w.addEventListener("message", onMsg);
    w.addEventListener("error", onError);

    return () => {
      w.removeEventListener("message", onMsg);
      w.removeEventListener("error", onError);
      w.terminate();
      URL.revokeObjectURL(url);
      computeWorkerRef.current = null;
      // eslint-disable-next-line no-console
      console.log("🧹 Compute worker terminated");
    };
  }, []);

  const trySendNextBatch = () => {
    const w = computeWorkerRef.current;
    if (!w || workerBusy.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    workerBusy.current = true;
    w.postMessage(next);
  };

  // -------- Stream (mock websocket) → buffer --------
  useEffect(() => {
    const onMsg = (e: MessageEvent<HospitalEvent>) => {
      const msg = e.data;
      if (!isNonCriticalEvent(msg)) return;
      const id = msg.patientId ?? "Unknown";
      (bufferRef.current[id] ||= []).push(msg);
    };
    worker.addEventListener("message", onMsg);
    return () => worker.removeEventListener("message", onMsg);
  }, [worker]);

  // =========================
  // Buffered mode (interval)
  // =========================
  useEffect(() => {
    if (!settings.buffer) return;
    // eslint-disable-next-line no-console
    console.log("🟢 Buffered mode active");
    activeComputeSource.current = offloadWork.current ? "worker" : "main";

    let flushCount = 0;
    const interval = setInterval(() => {
      if (offloadWork.current && workerBusy.current) return; // hold while worker busy
      flushCount++;

      const now = Date.now();
      const perAvg: number[] = [];
      const perStd: number[] = [];
      let totalCount = 0;

      // drain buffers → historyRef
      for (const pid of Object.keys(bufferRef.current)) {
        const events = bufferRef.current[pid];
        if (!events?.length) continue;

        const values = events.map((e) => e.value);
        const count = values.length;
        totalCount += count;

        const avg = mean(values);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const sd  = stddev(values);

        perAvg.push(avg);
        perStd.push(sd);

        const metric: PatientMetrics = {
          count,
          average: Number(avg.toFixed(1)),
          min: Number(min.toFixed(1)),
          max: Number(max.toFixed(1)),
          lastProcessedTimestamp: now,
        };

        (historyRef.current[pid] ||= []).push(metric);
        if (historyRef.current[pid].length > 20) historyRef.current[pid].shift();

        bufferRef.current[pid] = []; // clear
      }

      if (perAvg.length === 0) return; // nothing to flush

      const rollingAvg = mean(perAvg);
      const rollingStdDev = mean(perStd);
      const deviation = Math.abs(rollingAvg - BASELINE);
      const anomalyScore = Number(clamp01((rollingStdDev / 20 + deviation / 50) / 2).toFixed(3));
      const sampleBoost = Math.min(1, totalCount / 40);
      const confidence = Number((clamp01(1 / (1 + rollingStdDev / 15)) * (0.6 + 0.4 * sampleBoost)).toFixed(3));

      const populationPoint: PopulationPoint = {
        windowEnd: now,
        rollingAvg: Number(rollingAvg.toFixed(2)),
        rollingStdDev: Number(rollingStdDev.toFixed(2)),
        deviation: Number(deviation.toFixed(2)),
        anomalyScore,
        confidence,
      };
      normalizeWindowEnd(populationPoint);

      if (!offloadWork.current) {
        // MAIN owns timeline
        activeComputeSource.current = "main";
        setComputedByPatient(buildLatestFromHistory());
        commitPopulationPoint(populationPoint);

        if (useHeavyComputation.current) {
          const stopAt = performance.now() + 2000;
          while (performance.now() < stopAt) {} // simulate blocking
        }
      } else {
        // WORKER owns timeline
        activeComputeSource.current = "worker";
        const batch = {
          type: "process",
          id: Date.now(),
          payload: { latest: buildLatestFromHistory(), populationPoint },
          useHeavyComputation: useHeavyComputation.current,
        };
        if (queueRef.current.length >= MAX_QUEUE) queueRef.current.shift(); // drop oldest (bounded)
        queueRef.current.push(batch);
        if (!workerBusy.current) trySendNextBatch();
      }

      if (workerBusy.current && flushCount % 4 === 0) {
        // eslint-disable-next-line no-console
        console.warn("⚠️ Worker busy during buffered flush");
      }
    }, FLUSH_MS);

    return () => {
      clearInterval(interval);
      // eslint-disable-next-line no-console
      console.log("🔴 Buffered mode stopped");
    };
  }, [settings.buffer]);

  // =========================
  // Instant mode (per-event)
  // =========================
  useEffect(() => {
    if (settings.buffer) return;
    // eslint-disable-next-line no-console
    console.log("⚡ Instant mode active");
    activeComputeSource.current = offloadWork.current ? "worker" : "main";

    const onMsg = (e: MessageEvent<HospitalEvent>) => {
      const msg = e.data;
      if (!isNonCriticalEvent(msg)) return;

      const now = Date.now();
      const pid = msg.patientId ?? "Unknown";
      const val = msg.value;

      const metric: PatientMetrics = {
        count: 1,
        average: val,
        min: val,
        max: val,
        lastProcessedTimestamp: now,
      };

      (historyRef.current[pid] ||= []).push(metric);
      if (historyRef.current[pid].length > 20) historyRef.current[pid].shift();

      // Build population from latest per-patient
      const arrays = Object.values(historyRef.current) as PatientMetrics[][];
      const perAvg = arrays.map((a) => (a.length ? a[a.length - 1].average : 0));
      const perStd = arrays.map((a) => (a.length > 1 ? stddev(a.map((x) => x.average)) : 0));
      const totalCount = arrays.reduce((sum, a) => (a.length ? sum + a[a.length - 1].count : sum), 0);

      const rollingAvg = mean(perAvg);
      const rollingStdDev = mean(perStd);
      const deviation = Math.abs(rollingAvg - BASELINE);
      const anomalyScore = Number(clamp01((rollingStdDev / 20 + deviation / 50) / 2).toFixed(3));
      const sampleBoost = Math.min(1, totalCount / 40);
      const confidence = Number((clamp01(1 / (1 + rollingStdDev / 15)) * (0.6 + 0.4 * sampleBoost)).toFixed(3));

      const populationPoint: PopulationPoint = {
        windowEnd: now,
        rollingAvg: Number(rollingAvg.toFixed(2)),
        rollingStdDev: Number(rollingStdDev.toFixed(2)),
        deviation: Number(deviation.toFixed(2)),
        anomalyScore,
        confidence,
      };
      normalizeWindowEnd(populationPoint);

      if (!offloadWork.current) {
        // MAIN timeline
        activeComputeSource.current = "main";
        commitPopulationPoint(populationPoint);
        setComputedByPatient(buildLatestFromHistory());

        if (useHeavyComputation.current) {
          const stopAt = performance.now() + 2000;
          while (performance.now() < stopAt) {}
        }
      } else {
        // WORKER timeline
        activeComputeSource.current = "worker";
        const batch = {
          type: "process",
          id: Date.now(),
          payload: { latest: buildLatestFromHistory(), populationPoint },
          useHeavyComputation: useHeavyComputation.current,
        };
        if (queueRef.current.length >= MAX_QUEUE) queueRef.current.shift();
        queueRef.current.push(batch);
        if (!workerBusy.current) trySendNextBatch();
      }
    };

    worker.addEventListener("message", onMsg);
    return () => {
      worker.removeEventListener("message", onMsg);
      // eslint-disable-next-line no-console
      console.log("⚪ Instant mode stopped");
    };
  }, [settings.buffer]);

  // -------- UI --------
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4 relative">
      {settings.profileMode && (
        <div className="absolute top-2 right-2 bg-blue-500/10 text-[10px] text-blue-400 px-2 py-1 rounded-md space-y-0.5">
          <div>Renders: {renderCount.current}</div>
          <div>Offload: {offloadWork.current ? "Worker" : "Main"}</div>
          <div>Buffer: {settings.buffer ? "On" : "Off"}</div>
          <div>Owner: {activeComputeSource.current}</div>
          <div>Busy: {workerBusy.current ? "Yes" : "No"}</div>
          <div>Queue: {queueRef.current.length}</div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
          <Layers size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Non-Critical Vitals</h2>
          <p className="text-xs text-zinc-500">
            {settings.buffer ? "Buffered updates every 500 ms" : "Instant per-event processing"}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-sm text-zinc-400">
          <TrendingUp size={16} />
          <span>Population Metrics</span>
        </div>

        {populationAverages ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <MetricBox label="rollingAvg" value={populationAverages.rollingAvg} />
            <MetricBox label="rollingStdDev" value={populationAverages.rollingStdDev} />
            <MetricBox label="deviation" value={populationAverages.deviation} />
            <MetricBox label="anomalyScore" value={populationAverages.anomalyScore} />
            <MetricBox label="confidence" value={populationAverages.confidence} />
          </div>
        ) : (
          <div className="h-12 flex items-center justify-center text-zinc-600 border border-dashed border-zinc-800 rounded-lg">
            <span className="flex items-center gap-2 text-sm">
              <Activity size={14} /> Computing population metrics...
            </span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-48 bg-zinc-950/30 rounded-lg border border-zinc-800/50 p-2 mb-6">
        <LiveTrendChart simulate={false} externalData={populationHistory} className="h-full" />
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center pt-3 mt-4 border-t border-zinc-800/50">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Cpu size={12} />
          {settings.buffer ? <span>Buffered Processing</span> : <span>Instant Processing</span>}
        </div>
        <div className="text-[10px] font-mono text-zinc-600">
          Patients: {Object.keys(computedByPatient).length}
        </div>
      </div>
    </div>
  );
}

function MetricBox({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="bg-zinc-900 rounded-md border border-zinc-800 p-2">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-lg font-mono text-white">
        {value}
        {suffix}
      </div>
    </div>
  );
}
