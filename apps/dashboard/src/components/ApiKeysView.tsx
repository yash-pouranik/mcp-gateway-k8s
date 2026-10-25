import React, { useEffect, useState } from 'react';
import { api, ApiKey, User } from '../api';
import { Plus, Copy, Check, Trash2, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { TableRowsSkeleton, MobileCardsSkeleton } from './Skeleton';

interface ApiKeysViewProps {
  user?: User;
}

export const ApiKeysView: React.FC<ApiKeysViewProps> = ({ user }) => {
  const isAdmin = user?.role === 'admin';
  const [scope, setScope] = useState<'my' | 'team'>(isAdmin ? 'team' : 'my');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Issue Key Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke Key Confirmation Modal
  const [revokingKey, setRevokingKey] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchKeys = async (targetScope = scope) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getApiKeys(targetScope === 'team');
      setKeys(data.keys || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys(scope);
  }, [scope]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    setIssuing(true);
    try {
      const data = await api.createApiKey(keyName);
      setCreatedKey(data.apiKey.rawKey);
      await fetchKeys(scope);
    } catch (err: any) {
      alert(`Failed to create API key: ${err.message}`);
    } finally {
      setIssuing(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokingKey) return;
    setRevoking(true);
    try {
      await api.revokeApiKey(revokingKey.id);
      setRevokingKey(null);
      await fetchKeys(scope);
    } catch (err: any) {
      alert(`Failed to revoke key: ${err.message}`);
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-850">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-semibold text-white tracking-tight">API Keys</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              {keys.length} {scope === 'team' ? 'team keys' : 'issued'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Machine-to-machine tokens authenticated via indexed SHA-256 hashes. Prefix: <code className="text-zinc-300 font-mono">mcp_live_</code>
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
                Team Keys
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
            onClick={() => fetchKeys(scope)}
            className="p-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cf-orange' : ''}`} />
          </button>

          <button
            onClick={() => {
              setKeyName('');
              setCreatedKey(null);
              setIsModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-md bg-cf-orange hover:bg-cf-hover active:bg-cf-dark text-white font-medium text-xs transition flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate Key</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs">
          {error}
        </div>
      )}

      <div className="border border-zinc-800 bg-zinc-950 rounded-lg overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-900/50 text-zinc-400 font-mono text-[11px] border-b border-zinc-800">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                {scope === 'team' && (
                  <th className="px-4 py-2.5 font-medium">Owner</th>
                )}
                <th className="px-4 py-2.5 font-medium">Key Prefix</th>
                <th className="px-4 py-2.5 font-medium">Usage</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850">
              {loading ? (
                <TableRowsSkeleton cols={scope === 'team' ? 7 : 6} rows={4} />
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={scope === 'team' ? 7 : 6} className="px-4 py-12 text-center text-zinc-500 text-xs font-mono">
                    No API keys issued yet. Generate a key to connect Claude Code, Cursor, or Postman.
                  </td>
                </tr>
              ) : (
                  keys.map((k) => {
                    const isRevoked = Boolean(k.revokedAt);
                    const isOwner = k.userId === user?.id;
                    const canRevoke = isAdmin || isOwner;

                    return (
                      <tr key={k.id} className="hover:bg-zinc-900/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">
                          {k.name}
                        </td>

                        {scope === 'team' && (
                          <td className="px-4 py-3">
                            {k.user ? (
                              <div className="flex items-center space-x-1.5">
                                <span className="text-zinc-200">{k.user.name}</span>
                                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
                                  {k.user.role}
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-600 font-mono text-[11px]">—</span>
                            )}
                          </td>
                        )}

                        <td className="px-4 py-3 font-mono text-zinc-300">
                          {k.keyPrefix}••••••••
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-400">
                          {k.callCount || 0} calls
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center space-x-1.5 text-xs">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isRevoked ? 'bg-zinc-600' : 'bg-emerald-400'
                              }`}
                            />
                            <span className={isRevoked ? 'text-zinc-500 font-sans' : 'text-zinc-300 font-sans'}>
                              {isRevoked ? 'Revoked' : 'Active'}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-zinc-500 font-mono">
                          {new Date(k.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!isRevoked && canRevoke && (
                            <button
                              onClick={() => setRevokingKey(k)}
                              className="text-xs text-zinc-400 hover:text-rose-400 font-medium inline-flex items-center space-x-1 px-2 py-1 rounded hover:bg-zinc-900 transition"
                              title="Revoke key"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Revoke</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="block sm:hidden divide-y divide-zinc-850">
            {loading ? (
              <MobileCardsSkeleton count={4} />
            ) : keys.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs font-mono">
                No API keys issued yet. Generate a key to connect Claude Code, Cursor, or Postman.
              </div>
            ) : (
              keys.map((k) => {
                const isRevoked = Boolean(k.revokedAt);
                const isOwner = k.userId === user?.id;
                const canRevoke = isAdmin || isOwner;

                return (
                  <div key={k.id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-xs text-white truncate mr-2">
                        {k.name}
                      </div>
                      <span className="inline-flex items-center space-x-1.5 text-[11px] shrink-0">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isRevoked ? 'bg-zinc-600' : 'bg-emerald-400'
                          }`}
                        />
                        <span className={isRevoked ? 'text-zinc-500' : 'text-zinc-300'}>
                          {isRevoked ? 'Revoked' : 'Active'}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                      <span>{k.keyPrefix}••••••••</span>
                      <span className="text-zinc-500">{k.callCount || 0} calls</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-900">
                      <span>{new Date(k.createdAt).toLocaleDateString()}</span>
                      {!isRevoked && canRevoke && (
                        <button
                          onClick={() => setRevokingKey(k)}
                          className="text-xs text-rose-400 hover:text-rose-300 font-medium inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Revoke</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      {/* Generate Key Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white">
                {createdKey ? 'API Key Generated' : 'Create API Key'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdKey ? (
              <div className="mt-3 space-y-3">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 text-xs leading-relaxed">
                  Save this key now. It is stored as an indexed SHA-256 hash and cannot be viewed again.
                </div>

                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={createdKey}
                    className="w-full pl-2.5 pr-20 py-2 bg-black border border-zinc-800 rounded text-xs font-mono text-cf-orange focus:outline-none"
                  />
                  <button
                    onClick={() => handleCopy(createdKey)}
                    className="absolute right-1.5 top-1.5 px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs transition flex items-center space-x-1"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 bg-cf-orange hover:bg-cf-hover text-white rounded text-xs font-medium transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Key Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cursor / Claude Code CLI"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <div className="text-[11px] text-zinc-500 font-mono">
                  Prefix: <span className="text-zinc-300">mcp_live_</span> + 32-character random hex
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded text-xs border border-zinc-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={issuing}
                    className="px-3 py-1.5 bg-cf-orange hover:bg-cf-hover text-white rounded text-xs font-medium transition disabled:opacity-50"
                  >
                    {issuing ? 'Generating...' : 'Create Key'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {revokingKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-sm w-full p-5 shadow-2xl space-y-3">
            <div className="flex items-center space-x-2 text-rose-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-semibold text-white">Revoke API Key</h3>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to revoke <span className="font-semibold text-white font-mono">{revokingKey.name}</span>?
            </p>

            <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-850 text-[11px] font-mono text-zinc-400">
              Prefix: <span className="text-zinc-200">{revokingKey.keyPrefix}••••••••</span>
              <br />
              Subsequent requests using this key will immediately return <span className="text-rose-400">401 Unauthorized</span>.
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                onClick={() => setRevokingKey(null)}
                disabled={revoking}
                className="px-3 py-1.5 rounded text-xs text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRevoke}
                disabled={revoking}
                className="px-3 py-1.5 rounded text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 transition disabled:opacity-50 flex items-center space-x-1.5"
              >
                {revoking ? (
                  <span>Revoking...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Revoke Key</span>
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
