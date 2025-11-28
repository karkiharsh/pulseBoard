export type MetricType = 'CRITICAL' | 'NON_CRITICAL';

export interface MetricUpdate {
  id: string;
  type: MetricType;
  label: string;
  value: number;
  timestamp: number;
}

export interface ComputedMetrics {
  count: number;
  average: number;
  stdDev: number;
  min: number;
  max: number;
  lastProcessedTimestamp: number;
}

export interface SystemInfo {
  version: string;
  uptimeSeconds: number;
  region: string;
  status: 'Healthy' | 'Degraded' | 'Maintenance';
}

export interface AppSettings {
  buffer: boolean; // Disables buffering (simulates lag)
  workerOff: boolean; // Runs mock parsing computation on main thread
  profileMode: boolean; // Enables visual render logging
}
