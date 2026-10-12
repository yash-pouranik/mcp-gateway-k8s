import React, { useEffect, useState } from 'react';
import { api, McpServer, McpTool } from '../api';
import { Server, CheckCircle2, AlertTriangle, PowerOff, RefreshCw, Plus, Wrench, ShieldAlert, X } from 'lucide-react';

export const ServersView: React.FC = () => {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tools Modal state
  const [activeServer, setActiveServer] = useState<McpServer | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);

  // Add Server Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newHeader, setNewHeader] = useState('Authorization');
  const [newValue, setNewValue] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const fetchServers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getServers();
      setServers(data.servers);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch servers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleToggle = async (id: string) => {
    try {
      const res = await api.toggleServer(id);
      setServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: res.server.enabled, status: res.server.status } : s))
      );
    } catch (err: any) {
      alert(`Error toggling server: ${err.message}`);
    }
  };

  const handleInspectTools = async (server: McpServer) => {
    setActiveServer(server);
    setToolsLoading(true);
    try {
      const data = await api.getServerTools(server.id);
      setTools(data.tools);
    } catch (err: any) {
      alert(`Could not load tools: ${err.message}`);
      setTools([]);
    } finally {
      setToolsLoading(false);
    }
  };

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAdding(true);
    try {
      await api.addServer({
        name: newName,
        slug: newSlug,
        url: newUrl,
        credentialHeader: newHeader || undefined,
        credentialValue: newValue || undefined,
      });
      setIsAddModalOpen(false);
      setNewName('');
      setNewSlug('');
      setNewUrl('');
      setNewValue('');
      await fetchServers();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add server');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Server className="w-6 h-6 text-emerald-400" />
            <span>Upstream MCP Servers</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Registered upstream MCP providers aggregated into the single Streamable HTTP endpoint (<code className="text-emerald-300">/mcp</code>).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchServers}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition flex items-center space-x-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition flex items-center space-x-2 shadow-lg shadow-emerald-900/20"
          >
            <Plus className="w-4 h-4" />
            <span>Register Server</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading upstream servers...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map((server) => {
            const isConnected = server.status === 'connected';
            const isDisabled = !server.enabled || server.status === 'disabled';

            return (
              <div
                key={server.id}
                className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white tracking-tight">{server.name}</h3>
                      <div className="text-xs font-mono text-emerald-400/90 mt-0.5">slug: {server.slug}</div>
                    </div>

                    <span
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        isDisabled
                          ? 'bg-slate-700 text-slate-400 border-slate-600'
                          : isConnected
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {isDisabled ? (
                        <>
                          <PowerOff className="w-3 h-3" />
                          <span>Disabled</span>
                        </>
                      ) : isConnected ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Connected</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3" />
                          <span>Unreachable</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="mt-4 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400 font-medium">Target URL</div>
                    <div className="text-xs font-mono text-slate-200 truncate mt-1" title={server.url}>
                      {server.url}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-700/60 flex items-center justify-between">
                  <button
                    onClick={() => handleInspectTools(server)}
                    className="text-xs font-medium text-slate-300 hover:text-white flex items-center space-x-1.5 bg-slate-700/50 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition"
                  >
                    <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Inspect Tools</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400">{server.enabled ? 'Enabled' : 'Disabled'}</span>
                    <button
                      type="button"
                      onClick={() => handleToggle(server.id)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        server.enabled ? 'bg-emerald-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          server.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect Tools Modal */}
      {activeServer && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Wrench className="w-5 h-5 text-emerald-400" />
                  <span>Tools Exported by {activeServer.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Available in Gateway namespaced as <code className="text-emerald-300">{activeServer.slug}__*</code>
                </p>
              </div>
              <button
                onClick={() => setActiveServer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {toolsLoading ? (
                <div className="text-center py-8 text-slate-500">Querying tools via JSON-RPC...</div>
              ) : tools.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No tools found or server unreachable.
                </div>
              ) : (
                tools.map((t) => (
                  <div key={t.gatewayName} className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono font-semibold text-emerald-400">{t.gatewayName}</span>
                      <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-mono">
                        upstream: {t.originalName}
                      </span>
                    </div>
                    {t.description && <p className="text-xs text-slate-300">{t.description}</p>}
                    {t.inputSchema && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
                          View Input Schema
                        </summary>
                        <pre className="mt-2 p-2.5 bg-slate-950 rounded-lg text-slate-300 overflow-x-auto text-[11px] font-mono">
                          {JSON.stringify(t.inputSchema, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
              <button
                onClick={() => setActiveServer(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Server Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <span>Register Upstream MCP Server</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddServer} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Analytics MCP"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Server Slug (namespacing)</label>
                <input
                  type="text"
                  required
                  pattern="^[a-z0-9-]+$"
                  placeholder="e.g. analytics"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Streamable HTTP URL</label>
                <input
                  type="url"
                  required
                  placeholder="http://analytics.default.svc.cluster.local:3000/mcp"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Header Name</label>
                <input
                  type="text"
                  placeholder="Authorization"
                  value={newHeader}
                  onChange={(e) => setNewHeader(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Optional Token (AES-256 encrypted)</label>
                <input
                  type="password"
                  placeholder="Bearer token or API Secret"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition disabled:opacity-50"
                >
                  {adding ? 'Validating & Saving...' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
