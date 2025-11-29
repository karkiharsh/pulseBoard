// // This worker simulates a high-frequency WebSocket connection.
// // It emits data every X ms.

// const INTERVAL_MS = 15; // Very fast: ~66 updates per second

// let intervalId: any = null;

// const LABELS = ['CPU_LOAD', 'MEM_USAGE', 'NET_RX', 'NET_TX', 'DISK_IO'];

// function generateMetric() {
//   const isCritical = Math.random() < 0.05; // 5% chance of critical update
//   const label = LABELS[Math.floor(Math.random() * LABELS.length)];
  
//   return {
//     id: crypto.randomUUID(),
//     type: isCritical ? 'CRITICAL' : 'NON_CRITICAL',
//     label,
//     value: Math.random() * 100,
//     timestamp: Date.now(),
//   };
// }

// self.onmessage = (e: MessageEvent) => {
//   if (e.data === 'START') {
//     if (intervalId) clearInterval(intervalId);
//     console.log('[Generator Worker] Starting stream...');
//     intervalId = setInterval(() => {
//       const metric = generateMetric();
//       self.postMessage(metric);
//     }, INTERVAL_MS);
//   } else if (e.data === 'STOP') {
//     console.log('[Generator Worker] Stopping stream...');
//     if (intervalId) clearInterval(intervalId);
//     intervalId = null;
//   }
// };

// export {};
