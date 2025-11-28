import { SystemInfo } from '../types';

export const fetchSystemInfo = async (): Promise<SystemInfo> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  return {
    version: '2.4.0-beta',
    uptimeSeconds: 145023,
    region: 'ind-north-1',
    status: Math.random() > 0.1 ? 'Healthy' : 'Degraded',
  };
};
