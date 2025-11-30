import { useEffect, useRef } from "react";
import { CriticalMetrics2 } from "./CriticalMetrics2";
import type { HospitalEvent } from "../types";
import { NonCriticalMetrics2 } from "./NonCriticalMetrics2";

export function MetricsContainer2() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Inline worker code as a string
    const code = `
  const INTERVAL = 50;
  const BASE_NAMES = ["John Doe", "Alice Kim", "Ravi Patel", "Sara Lee", "Miguel Díaz", "Priya Nair", "Emma Wong", "Noah Smith"];

  // Create stable patients for the session, with random numeric suffixes on both id & name
  function unique(n) { return Math.floor(100 + Math.random() * 900); } // 3-digit
  const PATIENTS = Array.from({ length: 6 }, (_, i) => {
    const n1 = unique(i);
    const n2 = unique(i + 10);
    return {
      id: "P-" + n1 + n2,                           // e.g., P-734281
      name: BASE_NAMES[i % BASE_NAMES.length] + " #" + unique(i + 20) // e.g., "John Doe #593"
    };
  });

  const LABELS = ['Heart Rate', 'Oxygen Level', 'Temperature', 'BP'];
  const UNITS = ['bpm', '%', '°C', 'mmHg'];
  const WARDS = ['ICU-1', 'Ward-2', 'ER-3'];

  let timer = null;

  function gen() {
    const isCritical = Math.random() < 0.15;
    const patient = PATIENTS[Math.floor(Math.random() * PATIENTS.length)];
    const labelIndex = Math.floor(Math.random() * LABELS.length);

    if (isCritical) {
      postMessage({
        id: crypto.randomUUID(),
        type: "CRITICAL",
        label: LABELS[labelIndex],
        value: Math.random() * 100,
        unit: UNITS[labelIndex],
        source: "PatientMonitor",
        timestamp: Date.now(),
        severity: ["LOW", "MEDIUM", "HIGH"][Math.floor(Math.random() * 3)],
        patientId: patient.id,
        patientName: patient.name,
        ward: WARDS[Math.floor(Math.random() * WARDS.length)],
        alertMessage: LABELS[labelIndex] + " abnormal",
        acknowledged: Math.random() < 0.3,
      });
    } else {
      postMessage({
        id: crypto.randomUUID(),
        type: "NON_CRITICAL",
        label: LABELS[labelIndex],
        value: 50 + Math.random() * 50, // 50–100
        unit: UNITS[labelIndex],
        source: "VitalsSensor",
        timestamp: Date.now(),
        category: "VITALS",
        patientId: patient.id,
        patientName: patient.name,
        deviceId: "DEV-" + Math.floor(Math.random() * 100),
        deviceLocation: WARDS[Math.floor(Math.random() * WARDS.length)],
      });
    }
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
          <NonCriticalMetrics2 worker={workerRef.current} />
        </>
      )}
    </div>
  );
}
