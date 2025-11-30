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
// types.ts
export interface BaseEvent {
  id: string;
  source: string;
  label: string;
  value: number;
  unit: string;
  timestamp: number;
}

export interface CriticalEvent extends BaseEvent {
  type: 'CRITICAL';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  patientName: string;
  ward: string;
  alertMessage: string;
  acknowledged: boolean;
}

export interface NonCriticalEvent extends BaseEvent {
  type: 'NON_CRITICAL';
  category: 'VITALS' | 'ENVIRONMENT' | 'DEVICE';
  average?: number;
  min?: number;
  max?: number;
  batchSize?: number;
  notes?: string;
}

export type HospitalEvent = CriticalEvent | NonCriticalEvent;

