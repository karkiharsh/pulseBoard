import React, { useRef } from 'react';
import { useSocketData } from '../hooks/useSocketData';
import { usePerformanceWorker } from '../hooks/usePerformanceWorker';
import { CriticalMetrics } from './CriticalMetrics';
import { NonCriticalMetrics } from './NonCriticalMetrics';

export const MetricsContainer = ({ settings }) => {
  const renderCount = useRef(0);
  renderCount.current++;

  // Performance computation (worker or main thread)
  const { computedResult, processBatch } = usePerformanceWorker(settings.workerOff);

  // Socket data (critical + buffered)
  const { criticalMetric, isConnected } = useSocketData({
    onFlushBatch: processBatch,
    buffer: settings.buffer,
  });

  // console.log('MetricsContainer render:', renderCount.current);

  return (
    <>
      {/* <CriticalMetrics data={criticalMetric} settings={settings} /> */}
      <NonCriticalMetrics computed={computedResult} settings={settings} />
    </>
  );
};
