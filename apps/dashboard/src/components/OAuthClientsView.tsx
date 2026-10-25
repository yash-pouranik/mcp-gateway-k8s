import React, { useState, useEffect, useCallback } from 'react';
import { api, OAuthClient } from '../api';
import { Plus, Trash2, Copy, Check, ChevronDown, ChevronUp, Shield } from 'lucide-react';
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
  const [clients, setClients] = useState<OAuthClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newClientSecret, setNewClientSecret] = useState<{ clientId: string; secret: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New client form state
  const [form, setForm] = useState({
    name: '',
    redirectUris: '',
    scopes: ['mcp:read', 'mcp:write'] as string[],
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOAuthClients();
      setClients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OAuth clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

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
      await loadClients();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create OAuth client');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete OAuth app "${name}"? All tokens will be revoked.`)) return;
    try {
      await api.deleteOAuthClient(id);
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete OAuth client');
    }
  };

  const toggleScope = (scope: string) => {
    setForm((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            OAuth Applications
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Register external apps to access VYNN MCP Gateway via OAuth 2.0
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New App
        </button>
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
          <p className="text-xs mt-1">Register an app to enable external integrations</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => (
            <div
              key={client.id}
              className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg overflow-hidden"
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
                    <p className="text-sm font-medium text-zinc-100 truncate">{client.name}</p>
                    <p className="text-[10px] font-mono text-zinc-500 truncate">{client.clientId}</p>
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(client.id, client.name);
                    }}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-900/20 rounded-md transition-colors"
                    title="Delete app"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
          ))}
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
                  placeholder="https://myapp.com/callback&#10;http://localhost:3001/callback"
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

      {/* Unused user prop suppressor */}
      {!user && null}
    </div>
  );
};
