import React, { useEffect, useState } from 'react';
import { api, McpServer, McpTool, User } from '../api';
import {
  RefreshCw,
  Plus,
  Wrench,
  Edit3,
  X,
  Trash2,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';
import { ServersGridSkeleton, ToolsListSkeleton } from './Skeleton';

interface ServersViewProps {
  user?: User;
}

export const ServersView: React.FC<ServersViewProps> = ({ user }) => {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);

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

  const handleCopyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrlId(id);
    setTimeout(() => setCopiedUrlId(null), 2000);
  };

  const totalToolsCount = servers.reduce((acc, s) => acc + (s.tools?.length || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-3 sm:pb-4 border-b border-zinc-850">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h1 className="text-base sm:text-lg font-semibold text-white tracking-tight">Upstream Servers</h1>
            <span className="text-[10px] sm:text-xs font-mono px-1.5 sm:px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              {servers.length} registered
            </span>
            <span className="text-[10px] sm:text-xs font-mono px-1.5 sm:px-2 py-0.5 rounded bg-zinc-900 border border-zinc-850 text-cf-orange">
              {totalToolsCount} tools live
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
            Upstream tool providers aggregated behind the authenticated endpoint (<code className="text-zinc-300 font-mono">/mcp</code>).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchServers}
            disabled={loading}
            className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition flex items-center space-x-1.5 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cf-orange' : ''}`} />
            <span>Sync</span>
          </button>
          {(!user || user.role === 'admin') && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md bg-cf-orange hover:bg-cf-hover active:bg-cf-dark text-white font-medium text-xs transition flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Upstream</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <ServersGridSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {servers.map((server) => {
            const isConnected = server.status === 'connected';
            const isDisabled = !server.enabled || server.status === 'disabled';

            return (
              <div
                key={server.id}
                className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 sm:p-4 flex flex-col justify-between space-y-3 sm:space-y-4 hover:border-zinc-700 transition"
              >
                <div className="space-y-3">
                  {/* Card Header: Title & Status */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white tracking-tight">
                        {server.name}
                      </h3>
                      <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                        slug: <span className="text-zinc-300">{server.slug}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 text-xs">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isDisabled
                            ? 'bg-zinc-600'
                            : isConnected
                            ? 'bg-emerald-400'
                            : 'bg-rose-500'
                        }`}
                      />
                      <span className="capitalize font-sans text-[11px] text-zinc-400">
                        {isDisabled ? 'Disabled' : server.status}
                      </span>
                    </div>
                  </div>

                  {/* Endpoint URL (Compact) */}
                  <div className="p-2 rounded bg-zinc-900/60 border border-zinc-850 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-zinc-400 truncate mr-2" title={server.url}>
                      {server.url}
                    </span>
                    <button
                      onClick={() => handleCopyUrl(server.id, server.url)}
                      className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded shrink-0 transition"
                      title="Copy endpoint URL"
                    >
                      {copiedUrlId === server.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  {/* Exposed Tools Direct List */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                      <span className="font-medium">Exposed Tools</span>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {server.tools && server.tools.length > 0
                          ? `${server.tools.length} available`
                          : '0 available'}
                      </span>
                    </div>

                    {server.tools && server.tools.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {server.tools.slice(0, 5).map((tool) => (
                          <span
                            key={tool.gatewayName}
                            onClick={() => handleInspectTools(server)}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-700 hover:text-white cursor-pointer transition"
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
                      <div className="text-[11px] text-zinc-600 font-mono italic">
                        {isDisabled
                          ? 'Server disabled'
                          : !isConnected
                          ? 'Server unreachable'
                          : 'No tools registered'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-zinc-850 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleInspectTools(server)}
                      className="text-xs font-medium text-zinc-300 hover:text-white flex items-center space-x-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2 py-1 rounded transition"
                      title="Inspect tool schemas"
                    >
                      <Wrench className="w-3 h-3 text-zinc-400" />
                      <span>Inspect</span>
                    </button>

                    {user?.role === 'admin' && (
                      <>
                        <button
                          onClick={() => openEditModal(server)}
                          className="text-xs font-medium text-zinc-300 hover:text-white flex items-center space-x-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2 py-1 rounded transition"
                          title="Edit server"
                        >
                          <Edit3 className="w-3 h-3 text-zinc-400" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => {
                            setDeleteServer(server);
                            setDeleteError(null);
                          }}
                          className="text-xs font-medium text-zinc-400 hover:text-rose-400 p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition"
                          title="Delete server"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Enable / Disable Switch */}
                  {user?.role === 'admin' ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono text-zinc-500">{server.enabled ? 'On' : 'Off'}</span>
                      <button
                        type="button"
                        onClick={() => handleToggle(server.id)}
                        className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          server.enabled ? 'bg-cf-orange' : 'bg-zinc-800'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            server.enabled ? 'translate-x-3' : 'translate-x-0'
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

      {/* Inspect Tools Modal */}
      {inspectServer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                  <span>{inspectServer.name}</span>
                  <span className="text-xs font-mono text-zinc-500">({inspectServer.slug})</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Namespaced as <code className="text-zinc-300 font-mono">{inspectServer.slug}__*</code>
                </p>
              </div>
              <button
                onClick={() => setInspectServer(null)}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2.5">
              {toolsLoading ? (
                <ToolsListSkeleton count={4} />
              ) : toolsError ? (
                <div className="p-3 rounded bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs font-mono">
                  {toolsError}
                </div>
              ) : tools.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-xs font-mono">
                  No tools found on this upstream server.
                </div>
              ) : (
                tools.map((t) => (
                  <div key={t.gatewayName} className="p-3 bg-zinc-900/50 border border-zinc-850 rounded space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-medium text-cf-orange">{t.gatewayName}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        upstream: {t.originalName}
                      </span>
                    </div>
                    {t.description && <p className="text-xs text-zinc-300">{t.description}</p>}
                    {t.inputSchema && (
                      <details className="text-[11px] pt-1">
                        <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300 font-mono text-[10px]">
                          Input Schema JSON
                        </summary>
                        <pre className="mt-1.5 p-2 bg-black rounded text-zinc-300 overflow-x-auto text-[10px] font-mono border border-zinc-850">
                          {JSON.stringify(t.inputSchema, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setInspectServer(null)}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded text-xs font-medium transition"
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
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white">Edit Server ({editServer.slug})</h3>
              <button onClick={() => setEditServer(null)} className="p-1 rounded text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mt-3 p-2.5 rounded bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Streamable HTTP URL</label>
                <input
                  type="url"
                  required
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-700 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Header Name</label>
                <input
                  type="text"
                  value={editHeader}
                  onChange={(e) => setEditHeader(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-700 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Token (leave empty to keep current)</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••"
                  value={editToken}
                  onChange={(e) => setEditToken(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-700 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditServer(null)}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-xs border border-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-3 py-1.5 bg-cf-orange hover:bg-cf-hover text-white rounded text-xs font-medium transition"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Server Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white">Register Upstream Server</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 rounded text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="mt-3 p-2.5 rounded bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddServer} className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Analytics MCP"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Slug (namespacing)</label>
                <input
                  type="text"
                  required
                  pattern="^[a-z0-9-]+$"
                  placeholder="analytics"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-700 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Streamable HTTP URL</label>
                <input
                  type="url"
                  required
                  placeholder="http://analytics.extra-mcps.svc.cluster.local:3000/mcp"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-700 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Header Name</label>
                <input
                  type="text"
                  placeholder="Authorization"
                  value={newHeader}
                  onChange={(e) => setNewHeader(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-700 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Token (AES-256 encrypted)</label>
                <input
                  type="password"
                  placeholder="Bearer token or secret"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-700 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-xs border border-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="px-3 py-1.5 bg-cf-orange hover:bg-cf-hover text-white rounded text-xs font-medium transition disabled:opacity-50"
                >
                  {adding ? 'Registering...' : 'Register Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Server Confirmation Modal */}
      {deleteServer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-md w-full p-5 shadow-2xl flex flex-col space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">Remove Upstream Server</h3>
                  <p className="text-xs text-zinc-400">This action cannot be undone</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!deleting) setDeleteServer(null);
                }}
                disabled={deleting}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded bg-zinc-900/60 border border-zinc-850 space-y-1.5 text-xs">
              <div className="text-zinc-300">
                Are you sure you want to remove <span className="font-semibold text-white">{deleteServer.name}</span> (<code className="text-zinc-300 font-mono">{deleteServer.slug}</code>)?
              </div>
              <div className="text-zinc-400 text-[11px] leading-relaxed">
                All <span className="text-rose-400 font-medium">{deleteServer.tools?.length || 0} tools</span> exposed by this server will be immediately deregistered from the Gateway.
              </div>
              <div className="font-mono text-[10px] text-zinc-500 truncate pt-1">
                Endpoint: {deleteServer.url}
              </div>
            </div>

            {deleteError && (
              <div className="p-2.5 rounded bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteServer(null)}
                disabled={deleting}
                className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition flex items-center space-x-1.5"
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
