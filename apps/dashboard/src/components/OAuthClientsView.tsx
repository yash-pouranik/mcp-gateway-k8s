import React, { useState, useEffect, useCallback } from 'react';
import { api, OAuthClient } from '../api';
import {
  Plus,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Shield,
  RefreshCw,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { OAuthClientsSkeleton } from './Skeleton';

interface OAuthClientsViewProps {
  user: { id: string; email: string; name: string; role: 'admin' | 'member' };
}

const AVAILABLE_SCOPES = [
  { value: 'mcp:read', label: 'mcp:read', description: 'Read tools — list products, orders, notes' },
  { value: 'mcp:write', label: 'mcp:write', description: 'Write tools — create, update' },
  { value: 'mcp:admin', label: 'mcp:admin', description: 'Admin tools — delete, configure' },
];

export const OAuthClientsView: React.FC<OAuthClientsViewProps> = ({ user }) => {
  const isAdmin = user?.role === 'admin';
  const [scope, setScope] = useState<'my' | 'team'>(isAdmin ? 'team' : 'my');
  const [clients, setClients] = useState<OAuthClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newClientSecret, setNewClientSecret] = useState<{ clientId: string; secret: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Revoke / Delete Confirmation Modal
  const [deletingClient, setDeletingClient] = useState<OAuthClient | null>(null);
  const [deleting, setDeleting] = useState(false);

  // New client form state
  const [form, setForm] = useState({
    name: '',
    redirectUris: '',
    scopes: ['mcp:read', 'mcp:write'] as string[],
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadClients = useCallback(async (selectedScope: 'my' | 'team') => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOAuthClients(isAdmin && selectedScope === 'team');
      setClients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OAuth clients');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadClients(scope);
  }, [loadClients, scope]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  const handleCreate = async () => {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Application name is required');
      return;
    }
    const uris = form.redirectUris
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);
    if (uris.length === 0) {
      setFormError('At least one redirect URI is required');
      return;
    }
    if (form.scopes.length === 0) {
      setFormError('At least one scope must be selected');
      return;
    }

    setCreating(true);
    try {
      const result = await api.createOAuthClient({
        name: form.name.trim(),
        redirectUris: uris,
        scopes: form.scopes,
      });
      setNewClientSecret({ clientId: result.clientId, secret: result.clientSecret });
      setShowNewModal(false);
      setForm({ name: '', redirectUris: '', scopes: ['mcp:read', 'mcp:write'] });
      await loadClients(scope);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create OAuth client');
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingClient) return;
    setDeleting(true);
    try {
      await api.deleteOAuthClient(deletingClient.id);
      setClients((prev) => prev.filter((c) => c.id !== deletingClient.id));
      setDeletingClient(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete OAuth client');
    } finally {
      setDeleting(false);
    }
  };

  const toggleScope = (scopeName: string) => {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scopeName)
        ? prev.scopes.filter((s) => s !== scopeName)
        : [...prev.scopes, scopeName],
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-850">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span>OAuth Applications</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Register and govern external apps connecting via RFC 6749 OAuth 2.0 & RFC 9728 discovery.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Admin Scope Toggle */}
          {isAdmin && (
            <div className="flex items-center bg-zinc-900 p-0.5 rounded-md border border-zinc-800 text-xs">
              <button
                onClick={() => setScope('team')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  scope === 'team' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Team Apps
              </button>
              <button
                onClick={() => setScope('my')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  scope === 'my' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Personal
              </button>
            </div>
          )}

          <button
            onClick={() => loadClients(scope)}
            className="p-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cf-orange' : ''}`} />
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New App</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Secret reveal banner (shown once after creation) */}
      {newClientSecret && (
        <div className="bg-indigo-950/60 border border-indigo-700/50 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wide">
                Client Secret — Save this now
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                This secret will never be shown again.
              </p>
            </div>
            <button
              onClick={() => setNewClientSecret(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              Dismiss
            </button>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Client ID</p>
              <div className="flex items-center gap-2 bg-zinc-900 rounded-md px-3 py-2">
                <code className="text-xs text-indigo-300 font-mono flex-1 break-all">
                  {newClientSecret.clientId}
                </code>
                <button
                  onClick={() => handleCopy(newClientSecret.clientId, 'new-id')}
                  className="text-zinc-400 hover:text-zinc-200 transition shrink-0"
                >
                  {copiedId === 'new-id' ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Client Secret</p>
              <div className="flex items-center gap-2 bg-zinc-900 rounded-md px-3 py-2">
                <code className="text-xs text-amber-300 font-mono flex-1 break-all">
                  {newClientSecret.secret}
                </code>
                <button
                  onClick={() => handleCopy(newClientSecret.secret, 'new-secret')}
                  className="text-zinc-400 hover:text-zinc-200 transition shrink-0"
                >
                  {copiedId === 'new-secret' ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client list */}
      {loading ? (
        <OAuthClientsSkeleton count={3} />
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <Shield className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-zinc-400">No OAuth apps yet</p>
          <p className="text-xs mt-1">Register an app to enable external integrations (Claude Web, ChatGPT Actions)</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => {
            const isOwner = client.userId === user?.id;
            const canDelete = isAdmin || isOwner;

            return (
              <div
                key={client.id}
                className="bg-zinc-900/60 border border-zinc-850 hover:border-zinc-800 rounded-lg overflow-hidden transition-colors"
              >
                {/* Card header */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                  onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-indigo-900/50 border border-indigo-700/30 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-100 truncate">{client.name}</p>
                        {isOwner && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-850 text-zinc-300 border border-zinc-750">
                            You
                          </span>
                        )}
                      </div>

                      {/* Client ID and Owner Attribution Badge */}
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <p className="text-[10px] font-mono text-zinc-500 truncate">{client.clientId}</p>
                        {client.user && (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">
                            <UserCheck className="w-3 h-3 text-zinc-500 shrink-0" />
                            <span>Owner:</span>
                            <span className="text-zinc-200 font-medium">{client.user.name}</span>
                            <span className="text-zinc-500 text-[9px]">({client.user.email})</span>
                            <span
                              className={`text-[8px] uppercase px-1 py-0.2 rounded font-sans font-semibold ${
                                client.user.role === 'admin'
                                  ? 'bg-cf-orange/15 text-cf-orange border border-cf-orange/30'
                                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                              }`}
                            >
                              {client.user.role}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <div className="hidden sm:flex gap-1">
                      {client.scopes.map((s) => (
                        <span
                          key={s}
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700"
                        >
                          {s}
                        </span>
                      ))}
                    </div>

                    {canDelete ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingClient(client);
                        }}
                        className={`p-1.5 rounded-md transition-colors ${
                          isAdmin && !isOwner
                            ? 'text-amber-500/80 hover:text-rose-400 hover:bg-rose-950/30'
                            : 'text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20'
                        }`}
                        title={isAdmin && !isOwner ? `Revoke ${client.user?.name || "member"}'s app (Admin)` : 'Delete app'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span
                        className="text-[10px] text-zinc-600 italic px-1 select-none"
                        title={`Owned by ${client.user?.name || "member"}. Only owner or admin can revoke.`}
                      >
                        View only
                      </span>
                    )}

                    {expandedId === client.id ? (
                      <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === client.id && (
                  <div className="border-t border-zinc-800/60 px-4 py-3 space-y-3 bg-zinc-950/30">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Client ID</p>
                        <div className="flex items-center gap-2 bg-zinc-900 rounded-md px-2.5 py-1.5">
                          <code className="text-xs text-indigo-300 font-mono flex-1 break-all">
                            {client.clientId}
                          </code>
                          <button
                            onClick={() => handleCopy(client.clientId, `id-${client.id}`)}
                            className="text-zinc-400 hover:text-zinc-200 shrink-0"
                          >
                            {copiedId === `id-${client.id}` ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Created</p>
                        <p className="text-xs text-zinc-300">
                          {new Date(client.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                        Redirect URIs
                      </p>
                      <div className="space-y-1">
                        {client.redirectUris.map((uri) => (
                          <code key={uri} className="block text-xs text-zinc-300 font-mono bg-zinc-900 px-2.5 py-1 rounded">
                            {uri}
                          </code>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Scopes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {client.scopes.map((s) => (
                          <span
                            key={s}
                            className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-700/30"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="pt-1 border-t border-zinc-800/50">
                      <p className="text-[10px] text-zinc-600 font-mono">
                        Discovery: /.well-known/oauth-authorization-server
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New App Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowNewModal(false)}>
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Register OAuth Application</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                External apps use OAuth 2.0 to access the MCP Gateway on behalf of users.
              </p>
            </div>

            {formError && (
              <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-md px-3 py-2">
                {formError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                  Application Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="My MCP Integration"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                  Redirect URIs{' '}
                  <span className="text-zinc-600 font-normal">(one per line)</span>
                </label>
                <textarea
                  value={form.redirectUris}
                  onChange={(e) => setForm((prev) => ({ ...prev, redirectUris: e.target.value }))}
                  placeholder="https://myapp.com/callback&#10;https://chatgpt.com/aip/plugin-oauth/callback"
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 font-mono resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Scopes</label>
                <div className="space-y-2">
                  {AVAILABLE_SCOPES.map((s) => (
                    <label
                      key={s.value}
                      className="flex items-start gap-2.5 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={form.scopes.includes(s.value)}
                        onChange={() => toggleScope(s.value)}
                        className="mt-0.5 accent-indigo-500"
                      />
                      <span>
                        <span className="text-xs font-mono text-indigo-300">{s.label}</span>
                        <span className="text-xs text-zinc-500 ml-2">{s.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setShowNewModal(false); setFormError(null); }}
                className="flex-1 px-3 py-2 rounded-md text-xs text-zinc-400 border border-zinc-700 hover:border-zinc-600 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 px-3 py-2 rounded-md text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create App'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke / Delete Confirmation Modal */}
      {deletingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-sm w-full p-5 shadow-2xl space-y-3">
            <div className="flex items-center space-x-2 text-rose-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-semibold text-white">
                {isAdmin && deletingClient.userId !== user.id
                  ? "Revoke Member's OAuth Application"
                  : 'Delete OAuth Application'}
              </h3>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to delete and revoke{' '}
              <span className="font-semibold text-white font-mono">{deletingClient.name}</span>?
            </p>

            <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-850 text-[11px] font-mono text-zinc-400 space-y-1">
              <div>
                Client ID: <span className="text-indigo-300">{deletingClient.clientId}</span>
              </div>
              {deletingClient.user && (
                <div>
                  Owner: <span className="text-zinc-200">{deletingClient.user.name}</span> ({deletingClient.user.email})
                </div>
              )}
              <div className="text-rose-400 pt-1.5 border-t border-zinc-800 text-[10px] font-sans">
                All active access & refresh tokens will be immediately revoked. External AI clients (ChatGPT, Claude, etc.) using this app will be disconnected.
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                onClick={() => setDeletingClient(null)}
                disabled={deleting}
                className="px-3 py-1.5 rounded text-xs text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 transition disabled:opacity-50 flex items-center space-x-1.5"
              >
                {deleting ? (
                  <span>Revoking...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isAdmin && deletingClient.userId !== user.id ? 'Revoke App' : 'Delete App'}</span>
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
