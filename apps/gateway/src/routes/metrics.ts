import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { requireUserAuth } from '../middleware/auth.js';
import { getProcessMetricsSnapshot } from '../services/metrics.js';

const router = Router();

// ==============================================================================
// GET /api/metrics/summary — Aggregated Observability & RED Analytics
// ==============================================================================
router.get('/summary', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawWindow = (req.query.window as string) || '24h';
    let windowMs = 24 * 60 * 60 * 1000; // default 24h

    if (rawWindow === '1h') {
      windowMs = 60 * 60 * 1000;
    } else if (rawWindow === '7d') {
      windowMs = 7 * 24 * 60 * 60 * 1000;
    } else if (rawWindow === '30d') {
      windowMs = 30 * 24 * 60 * 60 * 1000;
    }

    const since = new Date(Date.now() - windowMs);

    // 1. Total and Error Calls in time window
    const [totalCalls, errorCalls, servers] = await Promise.all([
      prisma.auditLog.count({
        where: { calledAt: { gte: since } },
      }),
      prisma.auditLog.count({
        where: { calledAt: { gte: since }, success: false },
      }),
      prisma.mcpServer.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          enabled: true,
          createdAt: true,
        },
      }),
    ]);

    const successCalls = totalCalls - errorCalls;
    const errorRate = totalCalls > 0 ? Number(((errorCalls / totalCalls) * 100).toFixed(2)) : 0;

    // 2. Latency percentiles (bounded up to 10,000 recent samples)
    const durationsRecords = await prisma.auditLog.findMany({
      where: { calledAt: { gte: since } },
      select: { durationMs: true },
      orderBy: { durationMs: 'asc' },
      take: 10000,
    });

    const sampleCount = durationsRecords.length;
    let p50 = 0;
    let p90 = 0;
    let p95 = 0;
    let p99 = 0;
    let avgDurationMs = 0;

    if (sampleCount > 0) {
      const durations = durationsRecords.map((d) => d.durationMs);
      const sum = durations.reduce((acc, curr) => acc + curr, 0);
      avgDurationMs = Math.round(sum / sampleCount);

      p50 = durations[Math.floor(sampleCount * 0.5)] || 0;
      p90 = durations[Math.floor(sampleCount * 0.9)] || 0;
      p95 = durations[Math.floor(sampleCount * 0.95)] || 0;
      p99 = durations[Math.floor(sampleCount * 0.99)] || 0;
    }

    // 3. Upstream Server Health Matrix
    // Fetch stats for each server in this window
    const serverStatsMap: Record<string, { total: number; success: number; failed: number; totalDuration: number }> = {};

    const serverLogs = await prisma.auditLog.findMany({
      where: {
        calledAt: { gte: since },
        serverId: { not: null },
      },
      select: {
        serverId: true,
        success: true,
        durationMs: true,
      },
      take: 5000,
    });

    for (const log of serverLogs) {
      if (!log.serverId) continue;
      if (!serverStatsMap[log.serverId]) {
        serverStatsMap[log.serverId] = { total: 0, success: 0, failed: 0, totalDuration: 0 };
      }
      serverStatsMap[log.serverId].total += 1;
      if (log.success) {
        serverStatsMap[log.serverId].success += 1;
      } else {
        serverStatsMap[log.serverId].failed += 1;
      }
      serverStatsMap[log.serverId].totalDuration += log.durationMs;
    }

    const upstreamsHealth = servers.map((s) => {
      const stats = serverStatsMap[s.id] || { total: 0, success: 0, failed: 0, totalDuration: 0 };
      const avgLat = stats.total > 0 ? Math.round(stats.totalDuration / stats.total) : 0;
      const sRate = stats.total > 0 ? Number(((stats.success / stats.total) * 100).toFixed(1)) : 100;

      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        status: s.status, // connected | unreachable | disabled
        enabled: s.enabled,
        totalCalls: stats.total,
        successRate: sRate,
        averageLatencyMs: avgLat,
        recentFailures: stats.failed,
      };
    });

    // 4. Grouped Traffic by Tool
    const toolLogs = await prisma.auditLog.groupBy({
      by: ['toolName', 'serverId'],
      where: { calledAt: { gte: since } },
      _count: { _all: true },
      _avg: { durationMs: true },
    });

    const serverSlugMap = new Map(servers.map((s) => [s.id, s.slug]));

    const toolTraffic = toolLogs
      .map((t) => {
        const serverSlug = t.serverId ? serverSlugMap.get(t.serverId) || 'unknown' : 'gateway';
        return {
          toolName: t.toolName,
          serverSlug,
          callCount: t._count._all,
          avgDurationMs: Math.round(t._avg.durationMs || 0),
        };
      })
      .sort((a, b) => b.callCount - a.callCount);

    // 5. Recent Failures Stream (Last 10 failures for quick inspection)
    const recentFailures = await prisma.auditLog.findMany({
      where: {
        calledAt: { gte: since },
        success: false,
      },
      select: {
        id: true,
        calledAt: true,
        toolName: true,
        durationMs: true,
        errorMsg: true,
        serverId: true,
        userId: true,
        server: {
          select: {
            slug: true,
            name: true,
          },
        },
      },
      orderBy: { calledAt: 'desc' },
      take: 10,
    });

    // 6. In-Memory Process-Lifetime Prometheus Snapshot
    const processSnapshot = await getProcessMetricsSnapshot();

    res.json({
      reportingWindow: rawWindow,
      since: since.toISOString(),
      generatedAt: new Date().toISOString(),
      historicalMetrics: {
        totalCalls,
        successCalls,
        errorCalls,
        errorRatePercentage: errorRate,
        sampleCount,
        latencyMs: {
          average: avgDurationMs,
          p50,
          p90,
          p95,
          p99,
        },
      },
      upstreams: upstreamsHealth,
      tools: toolTraffic,
      recentFailures: recentFailures.map((f) => ({
        id: f.id,
        calledAt: f.calledAt.toISOString(),
        toolName: f.toolName,
        serverSlug: f.server?.slug || 'gateway',
        serverName: f.server?.name || 'Gateway Hub',
        durationMs: f.durationMs,
        errorMsg: f.errorMsg || 'Unknown error',
        userId: f.userId,
      })),
      processMetrics: processSnapshot,
    });
  } catch (err: any) {
    console.error('[Metrics] Failed to build metrics summary:', err);
    res.status(500).json({ error: `Failed to compile metrics summary: ${err.message}` });
  }
});

export default router;
