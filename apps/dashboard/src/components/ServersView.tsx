import React, { useEffect, useState } from 'react';
import { api, McpServer, McpTool, User } from '../api';
import { RefreshCw, Plus, Wrench, Edit3, X, Check, ShieldAlert, Trash2, AlertTriangle } from 'lucide-react';

interface ServersViewProps {
  user?: User;
}

export const ServersView: React.FC<ServersViewProps> = ({ user }) => {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inspect Tools Modal
  const [inspectServer, setInspectServer] = useState<McpServer | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);

  // Edit Server Modal
  const [editServer, setEditServer] = useState<McpServer | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editHeader, setEditHeader] = useState('');
  const [editToken, setEditToken] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Register Server Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newHeader, setNewHeader] = useState('Authorization');
  const [newValue, setNewValue] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Delete Server Modal
  const [deleteServer, setDeleteServer] = useState<McpServer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    setInspectServer(server);
    setToolsLoading(true);
    setToolsError(null);
    try {
      const data = await api.getServerTools(server.id);
      setTools(data.tools || []);
    } catch (err: any) {
      setToolsError(err.message || 'Could not fetch tools from this upstream server');
      setTools([]);
    } finally {
      setToolsLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteServer) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteServer(deleteServer.id);
      setServers((prev) => prev.filter((s) => s.id !== deleteServer.id));
      setDeleteServer(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting server');
    } finally {
      setDeleting(false);
    }
  };

  const openEditModal = (server: McpServer) => {
    setEditServer(server);
    setEditName(server.name);
    setEditUrl(server.url);
    setEditHeader(server.credentialHeader || 'Authorization');
    setEditToken('');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editServer) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const updated = await api.updateServer(editServer.id, {
        name: editName,
        url: editUrl,
        credentialHeader: editHeader || undefined,
        credentialValue: editToken.trim() || undefined,
      });
      setServers((prev) => prev.map((s) => (s.id === editServer.id ? updated.server : s)));
      setEditServer(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update server');
    } finally {
      setEditLoading(false);
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

  const totalToolsCount = servers.reduce((acc, s) => acc + (s.tools?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Connected MCP Servers</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300">
              {servers.length} upstreams
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cf-orange/10 border border-cf-orange/30 text-cf-orange">
              {totalToolsCount} tools aggregated
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Upstream tool providers aggregated behind the single authenticated Streamable HTTP endpoint (<code className="text-cf-orange font-mono">/mcp</code>).
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={fetchServers}
            disabled={loading}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition flex items-center space-x-2 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Status</span>
          </button>
          {(!user || user.role === 'admin') && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="py-2 px-3.5 rounded-lg bg-cf-orange hover:bg-cf-hover active:bg-cf-dark text-white font-medium text-xs transition flex items-center space-x-2 shadow-sm shadow-cf-orange/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Upstream</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-zinc-500 font-mono text-xs">
          Querying cluster MCP registries...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {servers.map((server) => {
            const isConnected = server.status === 'connected';
            const isDisabled = !server.enabled || server.status === 'disabled';

            return (
              <div
                key={server.id}
                className="bg-zinc-950/80 border border-zinc-800/90 hover:border-zinc-700/80 rounded-xl p-5 transition flex flex-col justify-between group shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-1.5">
                        <span>{server.name}</span>
                      </h3>
                      <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                        slug: <span className="text-cf-orange">{server.slug}</span>
                      </div>
                    </div>

                    {/* Kumo Status Badge */}
                    <span
                      className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                        isDisabled
                          ? 'bg-zinc-900 text-zinc-500 border-zinc-800'
                          : isConnected
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isDisabled
                            ? 'bg-zinc-600'
                            : isConnected
                            ? 'bg-emerald-400 animate-pulse'
                            : 'bg-rose-500'
                        }`}
                      />
                      <span className="capitalize">{server.status}</span>
                    </span>
                  </div>

                  {/* URL Card */}
                  <div className="mt-4 p-2.5 bg-zinc-900/60 rounded-lg border border-zinc-800/80">
                    <div className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Upstream Endpoint</div>
                    <div className="text-xs font-mono text-zinc-300 truncate mt-1 flex items-center justify-between" title={server.url}>
                      <span className="truncate">{server.url}</span>
                    </div>
                  </div>

                  {/* Exposed Tools Direct List */}
                  <div className="mt-3.5">
                    <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 mb-1.5">
                      <span className="flex items-center space-x-1.5">
                        <Wrench className="w-3 h-3 text-cf-orange" />
                        <span>Exposed Tools</span>
                      </span>
                      <span className="font-mono text-[10px] bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">
                        {server.tools && server.tools.length > 0
                          ? `${server.tools.length} live`
                          : isDisabled || !isConnected
                          ? '0 active'
                          : '0 tools'}
                      </span>
                    </div>

                    {server.tools && server.tools.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {server.tools.slice(0, 5).map((tool) => (
                          <span
                            key={tool.gatewayName}
                            onClick={() => handleInspectTools(server)}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900/90 text-zinc-300 border border-zinc-800 hover:border-cf-orange/50 hover:text-white cursor-pointer transition"
                            title={tool.description || tool.gatewayName}
                          >
                            {tool.originalName}
                          </span>
                        ))}
                        {server.tools.length > 5 && (
                          <button
                            onClick={() => handleInspectTools(server)}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-cf-orange hover:underline cursor-pointer border border-zinc-800"
                          >
                            +{server.tools.length - 5} more
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-zinc-500 font-mono italic">
                        {isDisabled
                          ? 'Server disabled — tools hidden'
                          : !isConnected
                          ? 'Server unreachable — tools offline'
                          : 'No tools registered'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-5 pt-3.5 border-t border-zinc-800/70 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleInspectTools(server)}
                      className="text-xs font-medium text-zinc-300 hover:text-white flex items-center space-x-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2.5 py-1.5 rounded-lg transition"
                      title="Inspect exported tools"
                    >
                      <Wrench className="w-3 h-3 text-cf-orange" />
                      <span>Inspect</span>
                    </button>

                    {user?.role === 'admin' && (
                      <>
                        <button
                          onClick={() => openEditModal(server)}
                          className="text-xs font-medium text-zinc-300 hover:text-white flex items-center space-x-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2.5 py-1.5 rounded-lg transition"
                          title="Edit server configuration"
                        >
                          <Edit3 className="w-3 h-3 text-zinc-400" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => {
                            setDeleteServer(server);
                            setDeleteError(null);
                          }}
                          className="text-xs font-medium text-zinc-400 hover:text-rose-400 flex items-center space-x-1 bg-zinc-900 hover:bg-rose-950/40 border border-zinc-800 hover:border-rose-500/40 p-1.5 rounded-lg transition"
                          title="Delete server from gateway"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Enable / Disable Switch */}
                  {user?.role === 'admin' ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono text-zinc-500">{server.enabled ? 'On' : 'Off'}</span>
                    <button
                      type="button"
                      onClick={() => handleToggle(server.id)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        server.enabled ? 'bg-cf-orange' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          server.enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  ) : (
                  <span className={`text-[11px] font-mono ${server.enabled ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {server.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect Tools Drawer / Modal */}
      {inspectServer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Wrench className="w-4 h-4 text-cf-orange" />
                  <span>Tools: {inspectServer.name}</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Live tools aggregated into Gateway namespaced as <code className="text-cf-orange font-mono">{inspectServer.slug}__*</code>
                </p>
              </div>
              <button
                onClick={() => setInspectServer(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              {toolsLoading ? (
                <div className="text-center py-12 text-zinc-500 font-mono text-xs">
                  Querying tools/list via JSON-RPC over Streamable HTTP...
                </div>
              ) : toolsError ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  <div className="font-semibold mb-1">Failed to query upstream tools:</div>
                  <div className="font-mono">{toolsError}</div>
                </div>
              ) : tools.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  No tools found on this server.
                </div>
              ) : (
                tools.map((t) => (
                  <div key={t.gatewayName} className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-cf-orange">{t.gatewayName}</span>
                      <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-mono">
                        upstream: {t.originalName}
                      </span>
                    </div>
                    {t.description && <p className="text-xs text-zinc-300">{t.description}</p>}
                    {t.inputSchema && (
                      <details className="text-[11px]">
                        <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300 font-mono">
                          View Input Schema JSON
                        </summary>
                        <pre className="mt-2 p-2.5 bg-black rounded-lg text-zinc-300 overflow-x-auto text-[10px] font-mono border border-zinc-800">
                          {JSON.stringify(t.inputSchema, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-end">
              <button
                onClick={() => setInspectServer(null)}
                className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg text-xs font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Server Modal */}
      {editServer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-cf-orange" />
                <span>Edit Upstream: {editServer.name}</span>
              </h3>
              <button
                onClick={() => setEditServer(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-cf-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Target URL</label>
                <input
                  type="url"
                  required
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-cf-orange font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Authorization Header</label>
                <input
                  type="text"
                  value={editHeader}
                  onChange={(e) => setEditHeader(e.target.value)}
                  placeholder="Authorization"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-cf-orange font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Update Token / Credential (AES-256 encrypted)
                </label>
                <input
                  type="password"
                  value={editToken}
                  onChange={(e) => setEditToken(e.target.value)}
                  placeholder="Leave empty to retain existing credential"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-cf-orange font-mono"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setEditServer(null)}
                  className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-medium border border-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-1.5 bg-cf-orange hover:bg-cf-hover text-white rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editLoading ? 'Saving...' : 'Save Configuration'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Server Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Plus className="w-4 h-4 text-cf-orange" />
                <span>Register Upstream Server</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddServer} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Analytics MCP"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-cf-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Server Slug (namespacing)</label>
                <input
                  type="text"
                  required
                  pattern="^[a-z0-9-]+$"
                  placeholder="e.g. analytics"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-cf-orange font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Streamable HTTP URL</label>
                <input
                  type="url"
                  required
                  placeholder="http://analytics.extra-mcps.svc.cluster.local:3000/mcp"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-cf-orange font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Header Name</label>
                <input
                  type="text"
                  placeholder="Authorization"
                  value={newHeader}
                  onChange={(e) => setNewHeader(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-cf-orange font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Optional Token (AES-256 encrypted)</label>
                <input
                  type="password"
                  placeholder="Bearer token or API Secret"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-cf-orange font-mono"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-medium border border-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="px-4 py-1.5 bg-cf-orange hover:bg-cf-hover text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
                >
                  {adding ? 'Validating & Registering...' : 'Register Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Server Confirmation Modal */}
      {deleteServer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Remove Upstream Server</h3>
                  <p className="text-xs text-zinc-400">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!deleting) setDeleteServer(null);
                }}
                disabled={deleting}
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2 text-xs">
              <div className="text-zinc-300">
                Are you sure you want to remove <span className="font-semibold text-white">{deleteServer.name}</span> (<code className="text-cf-orange font-mono">{deleteServer.slug}</code>)?
              </div>
              <div className="text-zinc-400 text-[11px] leading-relaxed">
                All <span className="text-rose-400 font-semibold">{deleteServer.tools?.length || 0} tools</span> exposed by this upstream will be immediately deregistered from the Gateway and will no longer be accessible by AI agents or external MCP clients.
              </div>
              <div className="font-mono text-[10px] text-zinc-500 truncate pt-1">
                Endpoint: {deleteServer.url}
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteServer(null)}
                disabled={deleting}
                className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-medium transition flex items-center space-x-1.5 shadow-sm shadow-rose-950"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Server</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
