import { useEffect, useRef, useState, useCallback } from 'react';
import { ComputedMetrics, MetricUpdate } from '../types';
import { performHeavyComputation } from '../utils/heavyMath';

// Embedded worker code to avoid URL resolution and import issues
const COMPUTE_WORKER_CODE = `
self.onmessage = (e) => {
  const { batch } = e.data;
  // console.log("worker code under execution");
  if (!batch || !Array.isArray(batch)) return;
  
  const values = batch.map((d) => d.value);
  const count = values.length;
  
  let result;

  if (count === 0) {
    result = { count: 0, average: 0, stdDev: 0, min: 0, max: 0, lastProcessedTimestamp: Date.now() };
  } else {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / count;
    
    // Simulate heavy load
    const start = performance.now();
    while (performance.now() - start < 10) {
      // Burn 10ms of CPU time per batch
      Math.sqrt(Math.random() * 10000);
    }

    result = {
      count,
      average: parseFloat(average.toFixed(2)),
      stdDev: 0, // Simplified for inline worker safety
      min: parseFloat(min.toFixed(2)),
      max: parseFloat(max.toFixed(2)),
      lastProcessedTimestamp: Date.now(),
    };
  }

  self.postMessage(result);
};
`;

export const usePerformanceWorker = (OffloadToWorker: boolean) => {
  const workerRef = useRef<Worker | null>(null);
  const [computedResult, setComputedResult] = useState<ComputedMetrics | null>(null);

  useEffect(() => {
    // Initialize worker from Blob
    const blob = new Blob([COMPUTE_WORKER_CODE], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    
    worker.onmessage = (e) => {
      setComputedResult(e.data);
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  }, []);

  const processBatch = useCallback((batch: MetricUpdate[]) => {
    if (OffloadToWorker) {
      // Main thread computation (Will block UI if batch is large or math is heavy)
      const result = performHeavyComputation(batch);
      setComputedResult(result);
    } else {
      // Offload to worker
      if (workerRef.current) {
        workerRef.current.postMessage({ batch });
      }
    }
  }, [OffloadToWorker]);

  return { computedResult, processBatch };
};