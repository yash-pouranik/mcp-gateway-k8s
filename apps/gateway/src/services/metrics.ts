import client from 'prom-client';

// ==============================================================================
// MCP Gateway Prometheus Observability Service
// Exposes standard RED metrics (Rate, Errors, Duration) & MCP Upstream telemetry
// ==============================================================================

export const register = new client.Registry();

// Enable standard Node.js runtime process metrics (CPU, Memory, Event Loop)
client.collectDefaultMetrics({
  register,
  prefix: 'mcp_',
});

// Helper: Sanitize metric label values to bounded, safe character sets
export function sanitizeLabelValue(val: string, maxLen = 48): string {
  if (!val || typeof val !== 'string') return 'unknown';
  // Allow only lowercase alphanumeric, underscore, and hyphen
  const cleaned = val.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return cleaned.substring(0, maxLen) || 'unknown';
}

// 1. Tool Call Counter partitioned by server, tool, and outcome
export const mcpToolCallsTotal = new client.Counter({
  name: 'mcp_tool_calls_total',
  help: 'Total number of MCP tool calls executed through the gateway hub',
  labelNames: ['server', 'tool', 'outcome'] as const,
  registers: [register],
});

// 2. Tool Call Execution Duration Histogram
// Buckets tailored for fast microservices up to 15s upstream timeout
export const mcpToolCallDurationSeconds = new client.Histogram({
  name: 'mcp_tool_call_duration_seconds',
  help: 'Execution duration of MCP tool calls in seconds',
  labelNames: ['server', 'tool'] as const,
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 15],
  registers: [register],
});

// 3. Upstream Server Status Multi-state Gauge
// For each server: connected=1/0, unreachable=1/0, disabled=1/0
export const mcpUpstreamStatus = new client.Gauge({
  name: 'mcp_upstream_status',
  help: 'Runtime availability state of registered upstream MCP servers (1 = active state, 0 = inactive)',
  labelNames: ['server', 'state'] as const,
  registers: [register],
});

// 4. Upstream Timeouts Counter
export const mcpUpstreamTimeoutsTotal = new client.Counter({
  name: 'mcp_upstream_timeouts_total',
  help: 'Total count of tool call requests that timed out waiting for upstream server',
  labelNames: ['server'] as const,
  registers: [register],
});

// 5. Authentication & Authorization Failures Counter
export const mcpAuthFailuresTotal = new client.Counter({
  name: 'mcp_auth_failures_total',
  help: 'Total number of rejected authentication attempts and RBAC permission denials',
  labelNames: ['reason'] as const,
  registers: [register],
});

// 6. Active In-Flight Tool Calls Gauge
export const mcpActiveRequests = new client.Gauge({
  name: 'mcp_active_requests',
  help: 'Current number of tool call requests actively executing in flight',
  registers: [register],
});

// ==============================================================================
// Safe Metric Recording Functions (Guaranteed non-fatal try/catch safety)
// ==============================================================================

/**
 * Increment active request gauge and return a cleanup callback for a finally block
 */
export function trackActiveRequest(): () => void {
  try {
    mcpActiveRequests.inc();
  } catch (err) {
    console.warn('[Metrics] Failed to increment active requests:', err);
  }

  let decremented = false;
  return () => {
    if (decremented) return;
    decremented = true;
    try {
      mcpActiveRequests.dec();
    } catch (err) {
      console.warn('[Metrics] Failed to decrement active requests:', err);
    }
  };
}

/**
 * Record a completed tool call (success, failure, or timeout)
 */
export function recordToolCallMetric(params: {
  server: string;
  tool: string;
  durationMs: number;
  outcome: 'success' | 'failure' | 'timeout';
}): void {
  try {
    const server = sanitizeLabelValue(params.server);
    const tool = sanitizeLabelValue(params.tool);
    const durationSeconds = Math.max(0, params.durationMs / 1000);

    mcpToolCallsTotal.inc({ server, tool, outcome: params.outcome });
    mcpToolCallDurationSeconds.observe({ server, tool }, durationSeconds);
  } catch (err) {
    console.warn('[Metrics] Failed to record tool call metric:', err);
  }
}

/**
 * Record an upstream timeout event
 */
export function recordUpstreamTimeout(server: string): void {
  try {
    mcpUpstreamTimeoutsTotal.inc({ server: sanitizeLabelValue(server) });
  } catch (err) {
    console.warn('[Metrics] Failed to record upstream timeout:', err);
  }
}

/**
 * Record an authentication or RBAC rejection
 */
export function recordAuthFailure(
  reason: 'missing_auth' | 'invalid_key' | 'revoked_key' | 'invalid_jwt' | 'rbac_denied'
): void {
  try {
    mcpAuthFailuresTotal.inc({ reason });
  } catch (err) {
    console.warn('[Metrics] Failed to record auth failure:', err);
  }
}

/**
 * Sync server status across all three possible states
 */
export function updateUpstreamStatusMetric(
  server: string,
  currentStatus: 'connected' | 'unreachable' | 'disabled'
): void {
  try {
    const safeServer = sanitizeLabelValue(server);
    const states = ['connected', 'unreachable', 'disabled'] as const;

    for (const state of states) {
      mcpUpstreamStatus.set({ server: safeServer, state }, state === currentStatus ? 1 : 0);
    }
  } catch (err) {
    console.warn('[Metrics] Failed to update upstream status metric:', err);
  }
}

/**
 * Get in-memory snapshot of process-lifetime Prometheus metrics
 */
export async function getProcessMetricsSnapshot() {
  try {
    const metrics = await register.getMetricsAsJSON();
    const activeReq = (await mcpActiveRequests.get()).values[0]?.value || 0;

    let totalCalls = 0;
    const callsMetric = metrics.find((m) => m.name === 'mcp_tool_calls_total');
    if (callsMetric && 'values' in callsMetric) {
      for (const val of callsMetric.values) {
        totalCalls += val.value || 0;
      }
    }

    let timeouts = 0;
    const timeoutsMetric = metrics.find((m) => m.name === 'mcp_upstream_timeouts_total');
    if (timeoutsMetric && 'values' in timeoutsMetric) {
      for (const val of timeoutsMetric.values) {
        timeouts += val.value || 0;
      }
    }

    let authFailures = 0;
    const authMetric = metrics.find((m) => m.name === 'mcp_auth_failures_total');
    if (authMetric && 'values' in authMetric) {
      for (const val of authMetric.values) {
        authFailures += val.value || 0;
      }
    }

    return {
      activeRequests: activeReq,
      processLifetimeToolCalls: totalCalls,
      processLifetimeTimeouts: timeouts,
      processLifetimeAuthFailures: authFailures,
      uptimeSeconds: Math.round(process.uptime()),
    };
  } catch (err) {
    return {
      activeRequests: 0,
      processLifetimeToolCalls: 0,
      processLifetimeTimeouts: 0,
      processLifetimeAuthFailures: 0,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
