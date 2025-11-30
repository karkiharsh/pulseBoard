import React, { useEffect, useRef, useState } from "react";
import { Layers, Activity, Cpu, TrendingUp } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, YAxis, Tooltip } from "recharts";
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

const BASELINE = 75;             // neutral vitals baseline for deviation calc
const FLUSH_MS = 500;            // existing flush cadence
const WINDOW_MS = 30_000;        // last 30 seconds
const MAX_POINTS = Math.ceil(WINDOW_MS / FLUSH_MS); // ~60

export function NonCriticalMetrics2({ worker }: { worker: Worker }) {
  const [computedByPatient, setComputedByPatient] = useState<Record<string, PatientMetrics>>({});
  const [populationAverages, setPopulationAverages] = useState<PopulationPoint | null>(null);
  const [populationHistory, setPopulationHistory] = useState<PopulationPoint[]>([]);
  const { settings } = useDashboard();
  const renderCount = useRef(0);
  renderCount.current++;
  const offloadWork = useRef<boolean>(settings.OffloadToWorker);
  useEffect(()=> {offloadWork.current = settings.OffloadToWorker}, [settings.OffloadToWorker])
  // Per-patient buffers
  const bufferRef = useRef<Record<string, NonCriticalEvent[]>>({});
  const historyRef = useRef<Record<string, PatientMetrics[]>>({});

  // Population rolling window (for chart & summary)
  const populationHistoryRef = useRef<PopulationPoint[]>([]);

  // Collect NON_CRITICAL events
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
  useEffect(()=>{
    console.log("OffloadToWorker  : ", settings.OffloadToWorker)
  },[settings])
  // Helpers
  function mean(nums: number[]) {
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }
  function stddev(nums: number[]) {
    if (nums.length <= 1) return 0;
    const m = mean(nums);
    const v = mean(nums.map((x) => (x - m) ** 2));
    return Math.sqrt(v);
  }
  function clamp01(x: number) {
    return Math.max(0, Math.min(1, x));
  }

  // Flush every 500ms → compute per-patient + population metrics
  useEffect(() => {
    const interval = setInterval(() => {
      const buffers = bufferRef.current;
      const now = Date.now();
      const perPatientAverages: number[] = [];
      const perPatientStdDevs: number[] = [];
      let totalCount = 0;

      for (const patientId of Object.keys(buffers)) {
        const events = buffers[patientId];
        if (!events || events.length === 0) continue;

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
        if (arr.length > 20) arr.shift(); // keep small per-patient spark data

        buffers[patientId] = [];
      }

      // Population-level (not grouped) metrics only if we had any events
      if (perPatientAverages.length > 0) {
        const rollingAvg = mean(perPatientAverages);                    // Average of averages
        const rollingStdDev = mean(perPatientStdDevs);                  // Mean volatility across patients
        const deviation = Math.abs(rollingAvg - BASELINE);              // Overall deviation from baseline

        // Simple composite anomaly: balance volatility & deviation, normalize to 0–1
        const volComponent = rollingStdDev / 20;                        // 0..~2+ given our 50–100 range
        const devComponent = deviation / 50;                            // 0..~1
        const rawScore = (volComponent + devComponent) / 2;
        const anomalyScore = Number(clamp01(rawScore).toFixed(3));

        // Confidence: higher with lower stddev and more samples; clamp 0–1
        const sampleBoost = Math.min(1, totalCount / 40);               // saturate around ~40 samples/flush
        const conf = clamp01(1 / (1 + rollingStdDev / 15)) * (0.6 + 0.4 * sampleBoost);
        const confidence = Number(conf.toFixed(3));

        const point: PopulationPoint = {
          windowEnd: now,
          rollingAvg: Number(rollingAvg.toFixed(2)),
          rollingStdDev: Number(rollingStdDev.toFixed(2)),
          deviation: Number(deviation.toFixed(2)),
          anomalyScore,
          confidence,
        };

        // Maintain 30s sliding window
        populationHistoryRef.current.push(point);
        // Drop by time (authoritative) and by count (cheap guard)
        while (
          populationHistoryRef.current.length > 0 &&
          (now - populationHistoryRef.current[0].windowEnd > WINDOW_MS ||
            populationHistoryRef.current.length > MAX_POINTS)
        ) {
          populationHistoryRef.current.shift();
        }
setPopulationHistory([...populationHistoryRef.current]);

        setPopulationAverages(point);
      }

      // Push latest per-patient sample (for your existing patient cards)
      const latest: Record<string, PatientMetrics> = {};
      for (const [id, arr] of Object.entries(historyRef.current) as [string, PatientMetrics[]][]) {
        if (arr.length > 0) latest[id] = arr[arr.length - 1];
      }
     if(!offloadWork.current) {
      function heavyBlock(durationMs) {
    const stopAt = performance.now() + durationMs;

    // A little state to ensure work isn't optimized out:
    let f = 0;
    let b = 0n;

    while (performance.now() < stopAt) {
      // Inner loop does millions of ops; tweak count to taste.
      for (let i = 0; i < 8_000_000; i++) {
        // Some non-trivial floating point work:
        f += Math.sqrt((i % 997) + f) / (1 + (f % 13));
        f = f % 1e9;

        // Some BigInt work so the engine can't vectorize everything:
        b += BigInt((i * 37) % 104729) * BigInt((i * 41) % 130099);
        b = b % 10_000_000_000_000_000_000n;
      }
    }

    // Use values so dead-code elimination doesn't skip work:
    console.log("Finished.", { f, b: b.toString() });
      }
      heavyBlock(5_000);
    }
      setComputedByPatient(latest);
    }, FLUSH_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4 relative">
      <span className="absolute top-2 right-2 text-[10px] bg-blue-500/20 text-blue-400 px-1.5 rounded">
        Renders: {renderCount.current}
      </span>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
          <Layers size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Non-Critical Vitals</h2>
          <p className="text-xs text-zinc-500">Buffered updates every 500 ms (grouped by patient)</p>
        </div>
      </div>

      {/* NEW: Population (not grouped) summary */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 text-sm text-zinc-400">
          <TrendingUp size={16} />
          <span>Population Metrics (last flush)</span>
        </div>

        {populationAverages ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <MetricBox label="rollingAvg" value={populationAverages.rollingAvg} suffix="" />
            <MetricBox label="rollingStdDev" value={populationAverages.rollingStdDev} suffix="" />
            <MetricBox label="deviation" value={populationAverages.deviation} suffix="" />
            <MetricBox label="anomalyScore" value={populationAverages.anomalyScore} suffix="" />
            <MetricBox label="confidence" value={populationAverages.confidence} suffix="" />
          </div>
        ) : (
          <div className="h-12 flex items-center justify-center text-zinc-600 border border-dashed border-zinc-800 rounded-lg">
            <span className="flex items-center gap-2 text-sm">
              <Activity size={14} /> Computing population metrics...
            </span>
          </div>
        )}
      </div>

      {/* Live trend chart of the 3 requested lines (rollingAvg, anomalyScore, deviation) */}
      <div className="h-48 bg-zinc-950/30 rounded-lg border border-zinc-800/50 p-2 mb-6">
        <LiveTrendChart
          simulate={false}
          externalData={populationHistory}
          className="h-full"
        />
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center pt-3 mt-4 border-t border-zinc-800/50">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Cpu size={12} />
          <span>Buffered Processing</span>
        </div>
        <div className="text-[10px] font-mono text-zinc-600">
          Patients: {Object.keys(computedByPatient).length}
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
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
