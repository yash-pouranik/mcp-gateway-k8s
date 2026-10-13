import React, { useEffect, useState } from 'react';
import { api, AuditLog } from '../api';
import { RefreshCw, CheckCircle2, XCircle, ChevronDown, ChevronRight, Filter } from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTool, setFilterTool] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAuditLogs({
        limit: 50,
        toolName: filterTool.trim() || undefined,
      });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Audit Trail & Telemetry</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300">
              {total} events logged
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time audit log of all tool invocations, user sessions, duration metrics, and access rejections.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <form onSubmit={handleFilterSubmit} className="flex items-center">
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by tool name..."
                value={filterTool}
                onChange={(e) => setFilterTool(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-cf-orange w-48 sm:w-56 font-mono"
              />
              <Filter className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2 pointer-events-none" />
            </div>
          </form>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition flex items-center space-x-1.5 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          {error}
        </div>
      )}

      <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
          <span>Total Records: {total}</span>
          <span>Showing latest 50 entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800">
            <thead className="bg-zinc-900/60">
              <tr>
                <th className="w-8 px-4 py-3"></th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Actor
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Tool Invoked
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Target Upstream
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Result
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Latency
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 font-mono text-xs">
                    Loading audit stream...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 text-xs">
                    No audit records match the current filter.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => toggleExpand(log.id)}
                        className="hover:bg-zinc-900/40 cursor-pointer transition select-none"
                      >
                        <td className="px-4 py-3 text-zinc-500">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-cf-orange" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-zinc-300">
                          {new Date(log.calledAt).toLocaleTimeString()}
                          <span className="text-[10px] text-zinc-500 ml-1.5">
                            {new Date(log.calledAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {log.user ? (
                            <div>
                              <div className="font-medium text-white">{log.user.name}</div>
                              <div className="text-[10px] font-mono text-zinc-500">{log.user.email}</div>
                            </div>
                          ) : (
                            <span className="text-amber-400 font-mono text-[11px]">Unauthenticated / Unknown</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-mono font-medium text-cf-orange">
                          {log.toolName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-300">
                          {log.server?.name || (log.serverId ? 'Server' : '—')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {log.success ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Success</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-medium">
                              <XCircle className="w-3 h-3" />
                              <span>Rejected</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-mono text-zinc-400">
                          {log.durationMs}ms
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-black/60">
                          <td colSpan={7} className="px-8 py-3.5">
                            <div className="space-y-2.5">
                              {log.errorMsg && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs font-mono">
                                  <strong>Error Reason:</strong> {log.errorMsg}
                                </div>
                              )}
                              <div>
                                <div className="text-[10px] font-mono uppercase text-zinc-500 mb-1">
                                  Input Parameters JSON
                                </div>
                                <pre className="p-3 bg-zinc-950 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto border border-zinc-800">
                                  {JSON.stringify(log.inputSummary, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
