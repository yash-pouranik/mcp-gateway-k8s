import React, { useState, useEffect, useCallback } from 'react';
import { api, MetricsSummaryResponse, User } from '../api';
import {
  Activity,
  Clock,
  AlertTriangle,
  Server,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  BarChart2,
  TrendingUp,
  Radio,
  ArrowUpRight,
  ShieldAlert,
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
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-zinc-900 rounded-xl w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-zinc-900 border border-zinc-800 rounded-2xl"></div>
          ))}
        </div>
        <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-2xl"></div>
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

  return (
    <div className="space-y-7">
      {/* 1. Header Bar with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-gradient-to-br from-cf-orange/20 to-amber-500/10 rounded-xl border border-cf-orange/30 text-cf-orange">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
                <span>Gateway Observability & Telemetry</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  RED Method
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Real-time request rate, error distribution, latency percentiles, and upstream failure isolation.
              </p>
            </div>
          </div>
        </div>

        {/* Time Window Switcher & Refresh Controls */}
        <div className="flex items-center space-x-3">
          {/* Time Window Pills */}
          <div className="flex items-center bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-xs font-mono">
            {(['1h', '24h', '7d'] as const).map((w) => (
              <button
                key={w}
                onClick={() => setTimeWindow(w)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  timeWindow === w
                    ? 'bg-zinc-800 text-white font-semibold shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
            }`}
            title="Auto-refresh every 10s"
          >
            <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse' : ''}`} />
            <span className="hidden md:inline">Auto (10s)</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={() => fetchMetrics(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition"
            title="Refresh now"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cf-orange' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchMetrics(false)} className="underline hover:text-rose-200">
            Retry
          </button>
        </div>
      )}

      {/* 2. Top KPI Cards — The RED Method (Rate, Errors, Duration) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Rate (Tool Calls) */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-sm relative overflow-hidden group hover:border-zinc-700/80 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Rate (Tool Calls)</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono text-white tracking-tight">
              {hist?.totalCalls.toLocaleString() || 0}
            </span>
            <span className="text-xs text-zinc-500 font-mono">in {timeWindow}</span>
          </div>
          <div className="mt-3 text-[11px] font-mono text-zinc-400 flex items-center justify-between border-t border-zinc-800/60 pt-2.5">
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              <span>In-flight active:</span>
            </span>
            <span className="font-semibold text-white">{proc?.activeRequests || 0}</span>
          </div>
        </div>

        {/* Card 2: Errors (Failure Rate) */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-sm relative overflow-hidden group hover:border-zinc-700/80 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Error Rate</span>
            <div
              className={`p-2 rounded-xl border ${
                (hist?.errorRatePercentage || 0) > 5
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : (hist?.errorRatePercentage || 0) > 0
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span
              className={`text-3xl font-bold font-mono tracking-tight ${
                (hist?.errorRatePercentage || 0) > 5
                  ? 'text-rose-400'
                  : (hist?.errorRatePercentage || 0) > 0
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {hist?.errorRatePercentage ?? 0}%
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              ({hist?.errorCalls || 0} failed / {hist?.totalCalls || 0})
            </span>
          </div>
          <div className="mt-3 text-[11px] font-mono text-zinc-400 flex items-center justify-between border-t border-zinc-800/60 pt-2.5">
            <span>Auth / RBAC rejections:</span>
            <span className="font-semibold text-white">{proc?.processLifetimeAuthFailures || 0}</span>
          </div>
        </div>

        {/* Card 3: Duration (Latency Percentiles) */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-sm relative overflow-hidden group hover:border-zinc-700/80 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Duration (p95 Latency)</span>
            <div className="p-2 rounded-xl bg-cf-orange/10 text-cf-orange border border-cf-orange/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono text-white tracking-tight">
              {hist?.latencyMs.p95 || 0}
              <span className="text-sm font-normal text-zinc-400 ml-1">ms</span>
            </span>
            <span className="text-xs text-zinc-500 font-mono">avg {hist?.latencyMs.average || 0}ms</span>
          </div>
          <div className="mt-3 text-[11px] font-mono text-zinc-400 flex items-center justify-between border-t border-zinc-800/60 pt-2.5">
            <span>p50: {hist?.latencyMs.p50 || 0}ms</span>
            <span className="text-zinc-600">|</span>
            <span>p90: {hist?.latencyMs.p90 || 0}ms</span>
            <span className="text-zinc-600">|</span>
            <span className="text-amber-400 font-semibold">p99: {hist?.latencyMs.p99 || 0}ms</span>
          </div>
        </div>

        {/* Card 4: Upstreams Health */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-sm relative overflow-hidden group hover:border-zinc-700/80 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Upstream Health</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono text-white tracking-tight">
              {healthyCount}
              <span className="text-lg font-normal text-zinc-500 mx-1">/</span>
              {totalEnabled}
            </span>
            <span className="text-xs text-emerald-400 font-mono font-medium">Healthy</span>
          </div>
          <div className="mt-3 text-[11px] font-mono text-zinc-400 flex items-center justify-between border-t border-zinc-800/60 pt-2.5">
            <span>Process uptime:</span>
            <span className="font-semibold text-white">
              {Math.floor((proc?.uptimeSeconds || 0) / 3600)}h {Math.floor(((proc?.uptimeSeconds || 0) % 3600) / 60)}m
            </span>
          </div>
        </div>
      </div>

      {/* 3. Upstream Failure Isolation & Health Matrix */}
      <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
              <Zap className="w-4 h-4 text-cf-orange" />
              <span>Upstream Isolation & Runtime Health</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Each upstream operates behind an independent 15-second timeout and circuit barrier.
            </p>
          </div>
          <div className="text-[11px] font-mono text-zinc-500 flex items-center space-x-2">
            <span>Last sync:</span>
            <span className="text-zinc-300 font-semibold">{lastRefreshedAt}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {upstreams.map((server) => {
            const isConnected = server.status === 'connected' && server.enabled;
            const isUnreachable = server.status === 'unreachable' && server.enabled;
            const isDisabled = !server.enabled;

            return (
              <div
                key={server.id}
                className={`p-4 rounded-xl border transition-all ${
                  isConnected
                    ? 'bg-zinc-900/80 border-emerald-500/20 hover:border-emerald-500/40'
                    : isUnreachable
                    ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                    : 'bg-zinc-900/30 border-zinc-800 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isConnected
                          ? 'bg-emerald-400 animate-pulse'
                          : isUnreachable
                          ? 'bg-rose-500'
                          : 'bg-zinc-600'
                      }`}
                    ></span>
                    <span className="font-semibold text-sm text-white">{server.name}</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md font-medium border ${
                      isConnected
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : isUnreachable
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    {isDisabled ? 'Disabled' : server.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center border-t border-zinc-800/80 pt-3">
                  <div>
                    <div className="text-[10px] text-zinc-400 uppercase font-mono">Calls</div>
                    <div className="text-sm font-bold font-mono text-white mt-0.5">{server.totalCalls}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-400 uppercase font-mono">Success</div>
                    <div
                      className={`text-sm font-bold font-mono mt-0.5 ${
                        server.totalCalls === 0
                          ? 'text-zinc-500'
                          : (server.successRate || 0) < 95
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {server.totalCalls > 0 && server.successRate !== null ? `${server.successRate}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-400 uppercase font-mono">Avg Lat</div>
                    <div className="text-sm font-bold font-mono text-cf-orange mt-0.5">
                      {server.totalCalls > 0 ? `${server.averageLatencyMs}ms` : '—'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-2 border-t border-zinc-800/40">
                  <span>Slug: {server.slug}</span>
                  <span className={server.recentFailures > 0 ? 'text-rose-400 font-semibold' : 'text-zinc-500'}>
                    {server.recentFailures} error(s)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Traffic Breakdown & Recent Failures (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Tool Traffic Distribution */}
        <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
              <BarChart2 className="w-4 h-4 text-blue-400" />
              <span>Tool Traffic Distribution ({timeWindow})</span>
            </h2>
            <span className="text-xs text-zinc-500 font-mono">{tools.length} active tools</span>
          </div>

          {tools.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs font-mono">
              No tool executions recorded in the selected {timeWindow} window.
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {tools.slice(0, 8).map((tool) => {
                const maxCalls = tools[0]?.callCount || 1;
                const percentage = Math.round((tool.callCount / maxCalls) * 100);

                return (
                  <div key={tool.toolName} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-200 font-medium truncate max-w-[16rem]">
                        <span className="text-zinc-500 mr-1.5">[{tool.serverSlug}]</span>
                        {tool.toolName}
                      </span>
                      <div className="flex items-center space-x-3">
                        <span className="text-zinc-400">{tool.avgDurationMs}ms</span>
                        <span className="text-white font-semibold">{tool.callCount} calls</span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cf-orange to-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Recent Failures Stream */}
        <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Recent Failures & Rejections</span>
            </h2>
            {onNavigateToAudit && (
              <button
                onClick={onNavigateToAudit}
                className="text-xs text-cf-orange hover:text-amber-400 flex items-center space-x-1 font-medium transition"
              >
                <span>View Full Audit Trail</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {recentFailures.length === 0 ? (
            <div className="py-12 text-center text-emerald-400 text-xs font-mono flex flex-col items-center justify-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/80" />
              <span>Zero failures recorded in the selected {timeWindow} window!</span>
            </div>
          ) : (
            <div className="space-y-2.5 pt-1 overflow-x-auto">
              {recentFailures.slice(0, 5).map((failure) => (
                <div
                  key={failure.id}
                  className="p-3 rounded-xl bg-zinc-900/80 border border-rose-500/20 text-xs font-mono space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-rose-400 font-semibold flex items-center space-x-1.5">
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[14rem]">{failure.toolName}</span>
                    </span>
                    <span className="text-zinc-500 text-[11px]">
                      {new Date(failure.calledAt).toLocaleTimeString()} · {failure.durationMs}ms
                    </span>
                  </div>
                  <p className="text-zinc-400 text-[11px] line-clamp-2 bg-black/40 p-1.5 rounded border border-zinc-800/60">
                    {failure.errorMsg}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Production Prometheus Scrape Information Pill */}
      <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-zinc-400">
        <div className="flex items-center space-x-2.5">
          <div className="w-2 h-2 rounded-full bg-cf-orange"></div>
          <span>
            Prometheus Scrape Endpoint:{' '}
            <code className="text-zinc-200 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              GET /metrics
            </code>
          </span>
          <span className="text-zinc-500">|</span>
          <span>OpenMetrics & RED compliant</span>
        </div>
        <div className="font-mono text-[11px] text-zinc-500">
          Historical: PostgreSQL Audit Trail · Real-time: prom-client Node.js Engine
        </div>
      </div>
    </div>
  );
};
