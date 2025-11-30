import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import clsx from "clsx";

type Point = {
  windowEnd: number;
  rollingAvg: number;
  anomalyScore: number; // 0–1
  deviation: number;
};

interface Props {
  /** Provide your own stream; if present, simulation is disabled by default. */
  externalData?: Point[];
  /** Force simulation (ignored if externalData present). Default true. */
  simulate?: boolean;
  /** Optional CSS/Tailwind wrapper class */
  className?: string;
}

const WINDOW_MS = 30_000; // 30 seconds visible window

export const LiveTrendChart: React.FC<Props> = ({
  externalData,
  simulate = true,
  className,
}) => {
  const [simPoints, setSimPoints] = useState<Point[]>([]);
  const timerRef = useRef<number | null>(null);

  const useSimulation = !externalData || externalData.length === 0 ? simulate : false;

  // Generate next simulated point with smooth evolution
  function nextSimPoint(prev?: Point): Point {
    const now = Date.now();
    const prevAvg = prev?.rollingAvg ?? 75;
    const avg = Math.max(50, Math.min(100, prevAvg + (Math.random() - 0.5) * 3)); // smooth variation

    const deviation = Math.abs(avg - 75);
    const volatility = Math.random() * 0.6 + deviation / 60;
    const anomalyScore = Math.max(0, Math.min(1, (volatility + deviation / 50) / 2));

    return {
      windowEnd: now,
      rollingAvg: Number(avg.toFixed(2)),
      deviation: Number(deviation.toFixed(2)),
      anomalyScore: Number(anomalyScore.toFixed(3)),
    };
  }

  useEffect(() => {
    if (!useSimulation) return;

    function tick() {
      setSimPoints((prev) => {
        const p = nextSimPoint(prev.at(-1));
        const cutoff = p.windowEnd - WINDOW_MS;
        const next = [...prev, p].filter((x) => x.windowEnd >= cutoff);
        return next;
      });
    }

    // Seed a few points initially
    for (let i = 0; i < 5; i++) tick();

    timerRef.current = window.setInterval(tick, 2000); // every 2s
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [useSimulation]);

  // Prepare data for chart
  const data = useMemo(() => {
    const raw = useSimulation ? simPoints : externalData ?? [];
    return raw.map((d) => ({
      ...d,
      formattedTime: new Date(d.windowEnd).toLocaleTimeString(),
    }));
  }, [simPoints, externalData, useSimulation]);

  return (
    <div className={clsx("w-full h-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
          syncMethod="value"
        >
          <CartesianGrid strokeDasharray="3 3" />
          {/* ✅ Use numeric time scale for smooth timeline */}
          <XAxis
            dataKey="windowEnd"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
            tick={{ fontSize: 10 }}
          />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            labelFormatter={(ts) => new Date(Number(ts)).toLocaleTimeString()}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="rollingAvg"
            stroke="#60a5fa"
            dot={false}
            strokeWidth={2}
            name="Rolling Avg"
            isAnimationActive
          />
          <Line
            type="monotone"
            dataKey="anomalyScore"
            stroke="#f59e0b"
            dot={false}
            strokeWidth={2}
            name="Anomaly Score"
            isAnimationActive
          />
          <Line
            type="monotone"
            dataKey="deviation"
            stroke="#ef4444"
            dot={false}
            strokeWidth={2}
            name="Deviation"
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
