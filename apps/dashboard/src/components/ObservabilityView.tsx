import React, { useState, useEffect, useCallback } from 'react';
import { api, MetricsSummaryResponse, User } from '../api';
import {
  RefreshCw,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Radio,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

interface ObservabilityViewProps {
  user: User;
  onNavigateToAudit?: () => void;
}

export const ObservabilityView: React.FC<ObservabilityViewProps> = ({ user: _user, onNavigateToAudit }) => {
  const [data, setData] = useState<MetricsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<'1h' | '24h' | '7d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');
  const [expandedFailureId, setExpandedFailureId] = useState<string | null>(null);

  const fetchMetrics = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const res = await api.getMetricsSummary(timeWindow);
        setData(res);
        setLastRefreshedAt(new Date().toLocaleTimeString());
      } catch (err: any) {
        setError(err.message || 'Failed to fetch observability telemetry');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [timeWindow]
  );

  useEffect(() => {
    fetchMetrics(false);
  }, [fetchMetrics]);

  // Auto-refresh interval (10 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchMetrics(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchMetrics]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-zinc-900 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-850 rounded-lg overflow-hidden border border-zinc-850">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-zinc-950 p-4 animate-pulse" />
          ))}
        </div>
        <div className="h-56 bg-zinc-950 border border-zinc-850 rounded-lg animate-pulse" />
      </div>
    );
  }

  const hist = data?.historicalMetrics;
  const proc = data?.processMetrics;
  const upstreams = data?.upstreams || [];
  const tools = data?.tools || [];
  const recentFailures = data?.recentFailures || [];

  const healthyCount = upstreams.filter((s) => s.status === 'connected' && s.enabled).length;
  const totalEnabled = upstreams.filter((s) => s.enabled).length;
  const hasErrors = (hist?.errorRatePercentage || 0) > 0;

  return (
    <div className="space-y-6">
      {/* 1. Header Bar with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-zinc-850">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Observability</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            RED method telemetry, upstream health, and request latency percentiles.
          </p>
        </div>

        {/* Time Window Switcher & Refresh Controls */}
        <div className="flex items-center space-x-2">
          {/* Time Window Selector */}
          <div className="flex items-center bg-zinc-900 rounded-md border border-zinc-800 p-0.5 text-xs font-mono">
            {(['1h', '24h', '7d'] as const).map((w) => (
              <button
                key={w}
                onClick={() => setTimeWindow(w)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  timeWindow === w
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border text-xs font-mono transition ${
              autoRefresh
                ? 'bg-zinc-900 text-zinc-300 border-zinc-700'
                : 'bg-zinc-950 text-zinc-500 border-zinc-850 hover:text-zinc-300'
            }`}
            title="Auto-refresh every 10 seconds"
          >
            <Radio className={`w-3 h-3 ${autoRefresh ? 'text-emerald-400' : 'text-zinc-600'}`} />
            <span className="hidden sm:inline">10s</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={() => fetchMetrics(true)}
            disabled={refreshing}
            className="p-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
            title="Refresh now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cf-orange' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-3 rounded-md bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchMetrics(false)} className="underline hover:text-rose-200 font-mono text-[11px]">
            Retry
          </button>
        </div>
      )}

      {/* 2. Compact KPI Summary Strip (Grafana / Datadog style) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-zinc-800 bg-zinc-950 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
        {/* Metric 1: Rate (Requests) */}
        <div className="p-4 flex flex-col justify-between">
          <div className="text-xs text-zinc-400 font-medium">Requests</div>
          <div className="my-2">
            <div className="text-2xl font-semibold font-mono text-white tracking-tight">
              {hist?.totalCalls.toLocaleString() || 0}
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-0.5">Calls in {timeWindow}</div>
          </div>
          <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between pt-2 border-t border-zinc-900">
            <span className="text-zinc-500">In-flight active</span>
            <span className="text-zinc-200">{proc?.activeRequests || 0}</span>
          </div>
        </div>

        {/* Metric 2: Error Rate */}
        <div className="p-4 flex flex-col justify-between">
          <div className="text-xs text-zinc-400 font-medium">Error rate</div>
          <div className="my-2">
            <div
              className={`text-2xl font-semibold font-mono tracking-tight ${
                hasErrors ? 'text-rose-400' : 'text-zinc-100'
              }`}
            >
              {hist?.errorRatePercentage ?? 0}%
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
              {hist?.errorCalls || 0} failed / {hist?.totalCalls || 0} total
            </div>
          </div>
          <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between pt-2 border-t border-zinc-900">
            <span className="text-zinc-500">Auth / RBAC rejections</span>
            <span className="text-zinc-200">{proc?.processLifetimeAuthFailures || 0}</span>
          </div>
        </div>

        {/* Metric 3: Duration (p95 Latency) */}
        <div className="p-4 flex flex-col justify-between">
          <div className="text-xs text-zinc-400 font-medium">p95 Latency</div>
          <div className="my-2">
            <div className="text-2xl font-semibold font-mono text-white tracking-tight">
              {hist?.latencyMs.p95 || 0}
              <span className="text-xs font-normal text-zinc-500 ml-1">ms</span>
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
              Average {hist?.latencyMs.average || 0} ms
            </div>
          </div>
          <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between pt-2 border-t border-zinc-900">
            <span className="text-zinc-500">p50 / p90 / p99</span>
            <span className="text-zinc-300">
              {hist?.latencyMs.p50} / {hist?.latencyMs.p90} / {hist?.latencyMs.p99}
            </span>
          </div>
        </div>

        {/* Metric 4: Upstreams Health */}
        <div className="p-4 flex flex-col justify-between">
          <div className="text-xs text-zinc-400 font-medium">Upstream status</div>
          <div className="my-2">
            <div className="text-2xl font-semibold font-mono text-white tracking-tight flex items-center space-x-2">
              <span>{healthyCount}/{totalEnabled}</span>
              <span className="text-xs font-sans font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                Connected
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
              {upstreams.length - totalEnabled} disabled
            </div>
          </div>
          <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between pt-2 border-t border-zinc-900">
            <span className="text-zinc-500">Process uptime</span>
            <span className="text-zinc-200">
              {Math.floor((proc?.uptimeSeconds || 0) / 3600)}h {Math.floor(((proc?.uptimeSeconds || 0) % 3600) / 60)}m
            </span>
          </div>
        </div>
      </div>

      {/* 3. Upstream Runtime Status Matrix */}
      <div className="border border-zinc-800 bg-zinc-950 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-xs font-semibold text-zinc-200 tracking-tight">Upstream Servers Runtime Matrix</h2>
            <span className="text-[11px] font-mono text-zinc-500">· 15s timeout boundary</span>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">Synced at {lastRefreshedAt}</span>
        </div>

        <div className="divide-y divide-zinc-850">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-900/50 text-zinc-400 font-mono text-[11px]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Server</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Requests</th>
                <th className="px-4 py-2.5 font-medium text-right">Success rate</th>
                <th className="px-4 py-2.5 font-medium text-right">Avg latency</th>
                <th className="px-4 py-2.5 font-medium text-right">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850 font-mono text-xs">
              {upstreams.map((server) => {
                const isConnected = server.status === 'connected' && server.enabled;
                const isUnreachable = server.status === 'unreachable' && server.enabled;
                const isDisabled = !server.enabled;

                return (
                  <tr key={server.id} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-sans font-medium text-white">{server.name}</div>
                      <div className="text-[11px] text-zinc-500 font-mono">{server.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center space-x-1.5 text-xs">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isConnected
                              ? 'bg-emerald-400'
                              : isUnreachable
                              ? 'bg-rose-500'
                              : 'bg-zinc-600'
                          }`}
                        />
                        <span className="capitalize font-sans text-zinc-300">
                          {isDisabled ? 'Disabled' : server.status}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-200">
                      {server.totalCalls.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {server.totalCalls === 0 ? (
                        <span className="text-zinc-600">—</span>
                      ) : (server.successRate || 0) < 95 ? (
                        <span className="text-rose-400 font-medium">{server.successRate}%</span>
                      ) : (
                        <span className="text-emerald-400">{server.successRate}%</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300">
                      {server.totalCalls > 0 ? `${server.averageLatencyMs} ms` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {server.recentFailures > 0 ? (
                        <span className="text-rose-400 font-medium">{server.recentFailures}</span>
                      ) : (
                        <span className="text-zinc-600">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Traffic Breakdown & Recent Failures (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Tool Traffic Distribution */}
        <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
            <h2 className="text-xs font-semibold text-zinc-200 tracking-tight">
              Tool Traffic Distribution ({timeWindow})
            </h2>
            <span className="text-[11px] text-zinc-500 font-mono">{tools.length} active tools</span>
          </div>

          {tools.length === 0 ? (
            <div className="py-10 text-center text-zinc-500 text-xs font-mono">
              No tool executions recorded in the selected {timeWindow} window.
            </div>
          ) : (
            <div className="space-y-2.5 pt-1">
              {tools.slice(0, 8).map((tool) => {
                const maxCalls = tools[0]?.callCount || 1;
                const percentage = Math.round((tool.callCount / maxCalls) * 100);

                return (
                  <div key={tool.toolName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-300 truncate max-w-[16rem]" title={tool.toolName}>
                        <span className="text-zinc-500 mr-1.5">{tool.serverSlug} /</span>
                        {tool.toolName}
                      </span>
                      <div className="flex items-center space-x-3 text-[11px]">
                        <span className="text-zinc-500">{tool.avgDurationMs}ms</span>
                        <span className="text-zinc-200 font-medium">{tool.callCount} calls</span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1 bg-zinc-900 rounded overflow-hidden">
                      <div
                        className="h-full bg-cf-orange rounded transition-all duration-300"
                        style={{ width: `${Math.max(percentage, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Recent Failures Stream with Expandable Detail */}
        <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
            <h2 className="text-xs font-semibold text-zinc-200 tracking-tight">Recent Failures & Rejections</h2>
            {onNavigateToAudit && (
              <button
                onClick={onNavigateToAudit}
                className="text-[11px] text-cf-orange hover:underline flex items-center space-x-1 transition"
              >
                <span>View audit trail</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {recentFailures.length === 0 ? (
            <div className="py-10 text-center text-zinc-400 text-xs font-mono flex flex-col items-center justify-center space-y-1.5">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span>Zero errors recorded in {timeWindow}</span>
            </div>
          ) : (
            <div className="space-y-1.5 pt-1">
              {recentFailures.slice(0, 6).map((failure) => {
                const isExpanded = expandedFailureId === failure.id;
                return (
                  <div
                    key={failure.id}
                    className="border border-zinc-850 rounded-md bg-zinc-900/40 text-xs font-mono overflow-hidden transition-colors hover:border-zinc-800"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFailureId(isExpanded ? null : failure.id)}
                      className="w-full p-2.5 flex items-center justify-between text-left text-xs"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        )}
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span className="text-zinc-200 truncate font-medium">{failure.toolName}</span>
                      </div>
                      <span className="text-[11px] text-zinc-500 shrink-0 ml-2">
                        {new Date(failure.calledAt).toLocaleTimeString()} · {failure.durationMs}ms
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="p-2.5 pt-0 border-t border-zinc-850 bg-black/60 text-[11px] space-y-1">
                        <div className="text-rose-400 font-mono break-all">{failure.errorMsg}</div>
                        <div className="text-zinc-500 text-[10px] pt-1">
                          Log ID: {failure.id} · Timestamp: {failure.calledAt}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. Prometheus Scrape Information Footer */}
      <div className="px-4 py-2.5 rounded-md border border-zinc-850 bg-zinc-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-zinc-400 font-mono">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cf-orange" />
          <span>Prometheus Metrics:</span>
          <code className="text-zinc-200 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
            GET /metrics
          </code>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">OpenMetrics & RED standard</span>
        </div>
        <div className="text-[11px] text-zinc-500">
          Scraping interval: 10s · Storage: in-memory Node.js registry
        </div>
      </div>
    </div>
  );
};
