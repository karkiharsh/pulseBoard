// MetricsContainer2.tsx
import { useEffect, useRef } from "react";
import { CriticalMetrics2 } from "./CriticalMetrics2";
import type { HospitalEvent } from "../types";

export function MetricsContainer2() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const code = `
      const INTERVAL = 50;
      const PATIENTS = ['John Doe', 'Alice Kim', 'Ravi Patel', 'Sara Lee'];
      const LABELS = ['Heart Rate', 'Oxygen Level', 'Temperature', 'BP'];
      const UNITS = ['bpm', '%', '°C', 'mmHg'];
      const WARDS = ['ICU-1', 'Ward-2', 'ER-3'];

      let timer = null;

      function gen() {
        const isCritical = Math.random() < 0.15;
        const patient = PATIENTS[Math.floor(Math.random() * PATIENTS.length)] +Math.floor(Math.random()*1000);
        const labelIndex = Math.floor(Math.random() * LABELS.length);

        const msg = isCritical
          ? {
              id: crypto.randomUUID(),
              type: 'CRITICAL',
              label: LABELS[labelIndex],
              value: Math.random() * 100,
              unit: UNITS[labelIndex],
              source: 'PatientMonitor',
              timestamp: Date.now(),
              severity: ['LOW','MEDIUM','HIGH'][Math.floor(Math.random() * 3)],
              patientName: patient,
              ward: WARDS[Math.floor(Math.random() * WARDS.length)],
              alertMessage: LABELS[labelIndex] + ' abnormal',
              acknowledged: Math.random() < 0.3
            }
          : {
              id: crypto.randomUUID(),
              type: 'NON_CRITICAL',
              label: LABELS[labelIndex],
              value: Math.random() * 100,
              unit: UNITS[labelIndex],
              source: 'VitalsSensor',
              timestamp: Date.now(),
              category: 'VITALS',
              average: 50 + Math.random() * 10,
              min: 45 + Math.random() * 5,
              max: 60 + Math.random() * 5,
              batchSize: 10 + Math.floor(Math.random() * 20)
            };

        postMessage(msg);
      }

      onmessage = (e) => {
        if (e.data === 'START') {
          if (timer) clearInterval(timer);
          timer = setInterval(gen, INTERVAL);
        }
        if (e.data === 'STOP') {
          if (timer) clearInterval(timer);
          timer = null;
        }
      };
    `;

    const blob = new Blob([code], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url);
    w.postMessage("START");
    workerRef.current = w;

    return () => {
      w.postMessage("STOP");
      w.terminate();
      URL.revokeObjectURL(url);
      workerRef.current = null;
    };
  }, []);

  return (
    <div className="p-4 text-white font-mono">
      <h2 className="mb-4 text-xl font-bold">Hospital Dashboard</h2>
      {workerRef.current && (
        <>
          <CriticalMetrics2 worker={workerRef.current} />
          {/* Later: <NonCriticalMetrics2 worker={workerRef.current} /> */}
        </>
      )}
    </div>
  );
}
