import React, { useEffect, useState } from 'react';
import { api, AuditLog } from '../api';
import { FileText, RefreshCw, CheckCircle2, XCircle, ChevronDown, ChevronRight, Filter } from 'lucide-react';

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <FileText className="w-6 h-6 text-emerald-400" />
            <span>Audit Trail</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Immutable security log of all tool executions, user attributions, rejection attempts, and upstream latency.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <form onSubmit={handleFilterSubmit} className="flex items-center">
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by tool name..."
                value={filterTool}
                onChange={(e) => setFilterTool(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 sm:w-60"
              />
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </form>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition flex items-center space-x-2 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {error}
        </div>
      )}

      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-3 bg-slate-900/60 border-b border-slate-700/60 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Total Records: {total}</span>
          <span>Showing latest 50 entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700/60">
            <thead className="bg-slate-900/40">
              <tr>
                <th className="w-8 px-4 py-3.5"></th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Tool
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Upstream
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500 text-sm">
                    Loading audit records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500 text-sm">
                    No audit records match the current criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => toggleExpand(log.id)}
                        className="hover:bg-slate-700/20 cursor-pointer transition select-none"
                      >
                        <td className="px-4 py-3 text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-slate-300">
                          {new Date(log.calledAt).toLocaleTimeString()}
                          <span className="text-[10px] text-slate-500 ml-1.5">
                            {new Date(log.calledAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {log.user ? (
                            <div>
                              <div className="font-medium text-white">{log.user.name}</div>
                              <div className="text-[11px] text-slate-400">{log.user.email}</div>
                            </div>
                          ) : (
                            <span className="text-amber-400 font-mono text-[11px]">Unauthenticated</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-mono font-medium text-emerald-400">
                          {log.toolName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-300">
                          {log.server?.name || (log.serverId ? 'Server' : '—')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {log.success ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Success</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px]">
                              <XCircle className="w-3 h-3" />
                              <span>Rejected</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-mono text-slate-400">
                          {log.durationMs}ms
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-900/60">
                          <td colSpan={7} className="px-8 py-4">
                            <div className="space-y-3">
                              {log.errorMsg && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-mono">
                                  <strong>Error:</strong> {log.errorMsg}
                                </div>
                              )}
                              <div>
                                <div className="text-xs font-medium text-slate-400 mb-1">
                                  Input Summary / Parameters
                                </div>
                                <pre className="p-3 bg-slate-950 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto border border-slate-800">
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
