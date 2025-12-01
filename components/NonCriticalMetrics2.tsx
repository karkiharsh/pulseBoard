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
  // --- REACT STATE ---
  const [computedByPatient, setComputedByPatient] = useState<
    Record<string, PatientMetrics>
  >({});
  const [populationAverages, setPopulationAverages] =
    useState<PopulationPoint | null>(null);
  const [populationHistory, setPopulationHistory] = useState<PopulationPoint[]>([]);

  const { settings } = useDashboard();
  const renderCount = useRef(0);
  renderCount.current++;

  // --- MODE FLAGS ---
  const offloadWork = useRef(settings.OffloadToWorker);
  const useHeavyComputation = useRef(settings.useHeavyComputation);
  const currentMode = useRef<"main" | "worker">(
    settings.OffloadToWorker ? "worker" : "main"
  );

  useEffect(() => {
    offloadWork.current = settings.OffloadToWorker;
    currentMode.current = settings.OffloadToWorker ? "worker" : "main";
    useHeavyComputation.current = settings.useHeavyComputation;

    // Reset transient data on mode change
    queueRef.current = [];
    workerBusy.current = false;
    populationHistoryRef.current = [];
    setPopulationHistory([]);
    setPopulationAverages(null);
    console.log(`🔁 Mode switched: ${currentMode.current}`);
  }, [settings.OffloadToWorker, settings.useHeavyComputation]);

  // --- BUFFERS ---
  const bufferRef = useRef<Record<string, NonCriticalEvent[]>>({});
  const historyRef = useRef<Record<string, PatientMetrics[]>>({});
  const populationHistoryRef = useRef<PopulationPoint[]>([]);
  const lastWindowTimestampRef = useRef<number>(0);

  // --- WORKER SYSTEM ---
  const computeWorkerRef = useRef<Worker | null>(null);
  const workerBusy = useRef(false);
  const queueRef = useRef<any[]>([]);
  const MAX_QUEUE = 5;

  // --- HELPERS ---
  const mean = (nums: number[]) =>
    nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
  const stddev = (nums: number[]) => {
    if (nums.length <= 1) return 0;
    const m = mean(nums);
    const v = mean(nums.map((x) => (x - m) ** 2));
    return Math.sqrt(v);
  };
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

  /** 🧠 Create compute worker (once) */
  useEffect(() => {
    if (computeWorkerRef.current) return;

    const workerCode = `
      self.onmessage = (e) => {
        const { type, id, payload, useHeavyComputation } = e.data;
        if (type !== "process") return;
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
    const newWorker = new Worker(url);
    computeWorkerRef.current = newWorker;

    const onMsg = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "done") {
        // Ignore stale responses
        if (currentMode.current !== "worker") return;

        workerBusy.current = false;
        const { latest, populationPoint } = msg.result;

        if (populationPoint) {
          // Enforce timestamp monotonicity
          if (populationPoint.windowEnd <= lastWindowTimestampRef.current)
            populationPoint.windowEnd = lastWindowTimestampRef.current + 1;
          lastWindowTimestampRef.current = populationPoint.windowEnd;

          populationHistoryRef.current.push(populationPoint);
          const now = Date.now();
          while (
            populationHistoryRef.current.length > 0 &&
            (now - populationHistoryRef.current[0].windowEnd > WINDOW_MS ||
              populationHistoryRef.current.length > MAX_POINTS)
          )
            populationHistoryRef.current.shift();

          setPopulationHistory([...populationHistoryRef.current]);
          setPopulationAverages(populationPoint);
        }

        if (latest) setComputedByPatient(latest);
        trySendNextBatch();
      }
    };

    const onError = (err: ErrorEvent) => {
      console.error("Worker crashed:", err.message);
      workerBusy.current = false;
    };

    newWorker.addEventListener("message", onMsg);
    newWorker.addEventListener("error", onError);

    return () => {
      newWorker.removeEventListener("message", onMsg);
      newWorker.removeEventListener("error", onError);
      newWorker.terminate();
      URL.revokeObjectURL(url);
      computeWorkerRef.current = null;
      console.log("🧹 Worker terminated");
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

  /** 🧩 Shared websocket listener (pushes to buffer) */
  useEffect(() => {
    const onMsg = (e: MessageEvent<HospitalEvent>) => {
      const msg = e.data;
      if (!isNonCriticalEvent(msg)) return;
      const patientId = msg.patientId ?? "Unknown";
      if (!bufferRef.current[patientId]) bufferRef.current[patientId] = [];
      bufferRef.current[patientId].push(msg);
    };

    worker.addEventListener("message", onMsg);
    return () => worker.removeEventListener("message", onMsg);
  }, [worker]);

  // ===========================================================
  // 🟢 BUFFERED MODE (interval-based batching)
  // ===========================================================
  useEffect(() => {
    if (!settings.buffer) return;
    console.log("🟢 Buffered mode active");

    let flushCount = 0;
    const interval = setInterval(() => {
      flushCount++;
      const buffers = bufferRef.current;
      const now = Date.now();
      const perPatientAverages: number[] = [];
      const perPatientStdDevs: number[] = [];
      let totalCount = 0;

      for (const patientId of Object.keys(buffers)) {
        const events = buffers[patientId];
        if (!events?.length) continue;

        const values = events.map((e) => e.value);
        const count = values.length;
        totalCount += count;
        const avg = mean(values);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const sd = stddev(values);

        perPatientAverages.push(avg);
        perPatientStdDevs.push(sd);

        const newMetric: PatientMetrics = {
          count,
          average: Number(avg.toFixed(1)),
          min: Number(min.toFixed(1)),
          max: Number(max.toFixed(1)),
          lastProcessedTimestamp: now,
        };

        if (!historyRef.current[patientId]) historyRef.current[patientId] = [];
        const arr = historyRef.current[patientId];
        arr.push(newMetric);
        if (arr.length > 20) arr.shift();
        buffers[patientId] = [];
      }

      if (perPatientAverages.length === 0) return;
      if (offloadWork.current && workerBusy.current) return;

      const rollingAvg = mean(perPatientAverages);
      const rollingStdDev = mean(perPatientStdDevs);
      const deviation = Math.abs(rollingAvg - BASELINE);
      const volComponent = rollingStdDev / 20;
      const devComponent = deviation / 50;
      const rawScore = (volComponent + devComponent) / 2;
      const anomalyScore = Number(clamp01(rawScore).toFixed(3));
      const sampleBoost = Math.min(1, totalCount / 40);
      const conf =
        clamp01(1 / (1 + rollingStdDev / 15)) * (0.6 + 0.4 * sampleBoost);
      const confidence = Number(conf.toFixed(3));

      const populationPoint: PopulationPoint = {
        windowEnd: now,
        rollingAvg: Number(rollingAvg.toFixed(2)),
        rollingStdDev: Number(rollingStdDev.toFixed(2)),
        deviation: Number(deviation.toFixed(2)),
        anomalyScore,
        confidence,
      };

      if (populationPoint.windowEnd <= lastWindowTimestampRef.current)
        populationPoint.windowEnd = lastWindowTimestampRef.current + 1;
      lastWindowTimestampRef.current = populationPoint.windowEnd;

      const latest: Record<string, PatientMetrics> = {};
      for (const [id, arr] of Object.entries(
        historyRef.current
      ) as [string, PatientMetrics[]][]) {
        if (arr.length > 0) latest[id] = arr[arr.length - 1];
      }

      if (!offloadWork.current) {
        setComputedByPatient(latest);
        populationHistoryRef.current.push(populationPoint);
        const nowTs = Date.now();
        while (
          populationHistoryRef.current.length > 0 &&
          (nowTs - populationHistoryRef.current[0].windowEnd > WINDOW_MS ||
            populationHistoryRef.current.length > MAX_POINTS)
        )
          populationHistoryRef.current.shift();
        setPopulationHistory([...populationHistoryRef.current]);
        setPopulationAverages(populationPoint);

        if (useHeavyComputation.current) {
          const stopAt = performance.now() + 2000;
          while (performance.now() < stopAt) {}
        }
      } else {
        const id = Date.now();
        const payload = { latest, populationPoint };
        const batch = {
          type: "process",
          id,
          payload,
          useHeavyComputation: useHeavyComputation.current,
        };
        if (queueRef.current.length >= MAX_QUEUE) queueRef.current.shift();
        queueRef.current.push(batch);
        if (!workerBusy.current) trySendNextBatch();
      }

      if (workerBusy.current && flushCount % 4 === 0)
        console.warn("⚠️ Worker busy during flush tick");
    }, FLUSH_MS);

    return () => {
      clearInterval(interval);
      console.log("🔴 Buffered mode stopped");
    };
  }, [settings.buffer]);

  // ===========================================================
  // ⚡ INSTANT MODE (per-event processing)
  // ===========================================================
  useEffect(() => {
    if (settings.buffer) return;
    console.log("⚡ Instant mode active");

    const onMsg = (e: MessageEvent<HospitalEvent>) => {
      const msg = e.data;
      if (!isNonCriticalEvent(msg)) return;

      const now = Date.now();
      const patientId = msg.patientId ?? "Unknown";
      const value = msg.value;

      const newMetric: PatientMetrics = {
        count: 1,
        average: value,
        min: value,
        max: value,
        lastProcessedTimestamp: now,
      };

      if (!historyRef.current[patientId]) historyRef.current[patientId] = [];
      const arr = historyRef.current[patientId];
      arr.push(newMetric);
      if (arr.length > 20) arr.shift();

      const patientArrays = Object.values(historyRef.current) as PatientMetrics[][];
      const perPatientAverages = patientArrays.map((a) =>
        a.length > 0 ? a[a.length - 1].average : 0
      );
      const perPatientStdDevs = patientArrays.map((a) =>
        a.length > 1 ? stddev(a.map((x) => x.average)) : 0
      );
      const totalCount = patientArrays.reduce(
        (sum, a) => (a.length > 0 ? sum + a[a.length - 1].count : sum),
        0
      );

      const rollingAvg = mean(perPatientAverages);
      const rollingStdDev = mean(perPatientStdDevs);
      const deviation = Math.abs(rollingAvg - BASELINE);
      const volComponent = rollingStdDev / 20;
      const devComponent = deviation / 50;
      const rawScore = (volComponent + devComponent) / 2;
      const anomalyScore = Number(clamp01(rawScore).toFixed(3));
      const sampleBoost = Math.min(1, totalCount / 40);
      const conf =
        clamp01(1 / (1 + rollingStdDev / 15)) * (0.6 + 0.4 * sampleBoost);
      const confidence = Number(conf.toFixed(3));

      const populationPoint: PopulationPoint = {
        windowEnd: now,
        rollingAvg: Number(rollingAvg.toFixed(2)),
        rollingStdDev: Number(rollingStdDev.toFixed(2)),
        deviation: Number(deviation.toFixed(2)),
        anomalyScore,
        confidence,
      };

      if (populationPoint.windowEnd <= lastWindowTimestampRef.current)
        populationPoint.windowEnd = lastWindowTimestampRef.current + 1;
      lastWindowTimestampRef.current = populationPoint.windowEnd;

      if (!offloadWork.current) {
        populationHistoryRef.current.push(populationPoint);
        while (
          populationHistoryRef.current.length > 0 &&
          (now - populationHistoryRef.current[0].windowEnd > WINDOW_MS ||
            populationHistoryRef.current.length > MAX_POINTS)
        )
          populationHistoryRef.current.shift();

        setPopulationHistory([...populationHistoryRef.current]);
        setPopulationAverages(populationPoint);
        setComputedByPatient({ ...computedByPatient, [patientId]: newMetric });

        if (useHeavyComputation.current) {
          const stopAt = performance.now() + 2000;
          while (performance.now() < stopAt) {}
        }
      } else {
        const id = Date.now();
        const payload = {
          latest: { ...computedByPatient, [patientId]: newMetric },
          populationPoint,
        };
        const batch = {
          type: "process",
          id,
          payload,
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
      console.log("⚪ Instant mode stopped");
    };
  }, [settings.buffer]);

  // ===========================================================
  // 🖼️ UI RENDER
  // ===========================================================
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4 relative">
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
          <h2 className="text-lg font-semibold text-white">
            Non-Critical Vitals
          </h2>
          <p className="text-xs text-zinc-500">
            {settings.buffer
              ? "Buffered updates every 500 ms"
              : "Instant per-event processing"}
          </p>
        </div>
      </div>

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

      <div className="h-48 bg-zinc-950/30 rounded-lg border border-zinc-800/50 p-2 mb-6">
        <LiveTrendChart simulate={false} externalData={populationHistory} className="h-full" />
      </div>

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
