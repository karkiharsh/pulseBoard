import { MetricUpdate, ComputedMetrics } from '../types';

/**
 * Performs heavy calculations on a batch of metrics.
 * Includes artificial delay loops to simulate complex business logic.
 */
export const performHeavyComputation = (data: MetricUpdate[]): ComputedMetrics => {
  if (data.length === 0) {
    return { count: 0, average: 0, stdDev: 0, min: 0, max: 0, lastProcessedTimestamp: Date.now() };
  }

  const values = data.map(d => d.value);
  const count = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  // 1. Calculate Mean
  const sum = values.reduce((a, b) => a + b, 0);
  const average = sum / count;

  // 2. Calculate Standard Deviation
  const squareDiffs = values.map(value => {
    const diff = value - average;
    return diff * diff;
  });
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / count;
  const stdDev = Math.sqrt(avgSquareDiff);

  // 3. Artificial CPU Load (Simulating complex analysis)
  // We'll verify primality for a random large number to burn cycles
  const iterations = 50000; 
  let primeCount = 0;
  for (let i = 0; i < iterations; i++) {
     if (Math.random() > 0.5) primeCount++;
  }

  return {
    count,
    average: parseFloat(average.toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2)),
    min: parseFloat(min.toFixed(2)),
    max: parseFloat(max.toFixed(2)),
    lastProcessedTimestamp: Date.now(),
  };
};