import { useEffect, useRef, useState } from 'react';
import { MetricUpdate } from '../types';

// Embedded worker code to avoid URL resolution issues
const GENERATOR_WORKER_CODE = `
const INTERVAL_MS = 15; // Very fast: ~66 updates per second
let intervalId = null;
const LABELS = ['CPU_LOAD', 'MEM_USAGE', 'NET_RX', 'NET_TX', 'DISK_IO'];

function generateMetric() {
  console.log('Web socket code under execution');
  const isCritical = Math.random() < 0.05; // 5% chance of critical update
  const label = LABELS[Math.floor(Math.random() * LABELS.length)];
  
  return {
    id: crypto.randomUUID(),
    type: isCritical ? 'CRITICAL' : 'NON_CRITICAL',
    label,
    value: Math.random() * 100,
    timestamp: Date.now(),
  };
}

self.onmessage = (e) => {
  if (e.data === 'START') {
    if (intervalId) clearInterval(intervalId);
    // console.log('[Generator Worker] Starting stream...');
    intervalId = setInterval(() => {
      self.postMessage(generateMetric());
    }, INTERVAL_MS);
  } else if (e.data === 'STOP') {
    // console.log('[Generator Worker] Stopping stream...');
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }
};
`;

interface UseSocketDataProps {
  onFlushBatch: (batch: MetricUpdate[]) => void;
  buffer: boolean; // If true, disable buffering (force frequent renders)
}

export const useSocketData = ({ onFlushBatch, buffer }: UseSocketDataProps) => {
  const [criticalMetric, setCriticalMetric] = useState<MetricUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Buffer for non-critical updates
  const bufferRef = useRef<MetricUpdate[]>([]);
  
  // Reference to the generator worker
  const generatorRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Create worker from Blob to avoid path/import issues
    const blob = new Blob([GENERATOR_WORKER_CODE], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    worker.onmessage = (e: MessageEvent) => {
      const metric = e.data as MetricUpdate;

      if (metric.type === 'CRITICAL') {
        // Critical updates bypass the buffer and update state immediately
        setCriticalMetric(metric);
      } else {
        if (buffer) {
          // SLOW MODE: Treat every non-critical update as critical (immediate flush)
          // This causes massive re-rendering and main-thread blocking
          onFlushBatch([metric]);
        } else {
          // NORMAL MODE: Buffer the data
          bufferRef.current.push(metric);
        }
      }
    };

    generatorRef.current = worker;
    setIsConnected(true);
    worker.postMessage('START');

    return () => {
      worker.postMessage('STOP');
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      setIsConnected(false);
    };
  }, [buffer, onFlushBatch]);

  // Buffer Flush Loop
  useEffect(() => {
    if (buffer) return; // In slow mode, we flush immediately on receipt

    const FLUSH_INTERVAL = 500; // Flush every 500ms

    const interval = setInterval(() => {
      if (bufferRef.current.length > 0) {
        // SNAPSHOT PATTERN:
        // Create a copy of the current buffer and clear the ref immediately
        // to prevent race conditions during the async processing.
        const batch = [...bufferRef.current];
        bufferRef.current = [];
        
        onFlushBatch(batch);
      }
    }, FLUSH_INTERVAL);

    return () => clearInterval(interval);
  }, [buffer, onFlushBatch]);

  return {
    criticalMetric,
    isConnected,
  };
};