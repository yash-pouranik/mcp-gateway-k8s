import { prisma } from '../db.js';
import { upstreamManager } from '../mcp/upstream.js';
import { updateUpstreamStatusMetric } from './metrics.js';

let intervalTimer: NodeJS.Timeout | null = null;

export function startHealthMonitor(intervalMs = 30000): void {
  if (intervalTimer) return;

  const checkHealth = async () => {
    try {
      const servers = await prisma.mcpServer.findMany();
      for (const server of servers) {
        if (!server.enabled) {
          if (server.status !== 'disabled') {
            await prisma.mcpServer.update({
              where: { id: server.id },
              data: { status: 'disabled' },
            });
          }
          updateUpstreamStatusMetric(server.slug, 'disabled');
          continue;
        }

        const isReachable = await upstreamManager.pingServer(server);
        const targetStatus = isReachable ? 'connected' : 'unreachable';

        if (server.status !== targetStatus) {
          await prisma.mcpServer.update({
            where: { id: server.id },
            data: { status: targetStatus },
          });
        }
        updateUpstreamStatusMetric(server.slug, targetStatus);
      }
    } catch (err) {
      console.error('Error in health check worker:', err);
    }
  };

  setTimeout(checkHealth, 2000);
  intervalTimer = setInterval(checkHealth, intervalMs);
}

export function stopHealthMonitor(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}
