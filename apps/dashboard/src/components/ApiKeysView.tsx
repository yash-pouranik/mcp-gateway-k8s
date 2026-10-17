import React, { useEffect, useState } from 'react';
import { api, ApiKey, User } from '../api';
import { Key, Plus, Copy, Check, Trash2, ShieldAlert, X, Users, AlertTriangle, RefreshCw, Activity } from 'lucide-react';

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-white tracking-tight">API Key Credentials</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300">
              {keys.length} {scope === 'team' ? 'team keys' : 'issued'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Secure client keys using SHA-256 indexed lookups. Personalized prefix: <code className="text-cf-orange font-mono">mcp_live_</code>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Admin Scope Toggle */}
          {isAdmin && (
            <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => setScope('team')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                  scope === 'team'
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-cf-orange" />
                <span>All Team Keys</span>
              </button>
              <button
                onClick={() => setScope('my')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                  scope === 'my'
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Key className="w-3.5 h-3.5 text-zinc-400" />
                <span>My Keys</span>
              </button>
            </div>
          )}

          <button
            onClick={() => fetchKeys(scope)}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition shadow-sm"
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
            className="py-2 px-3.5 rounded-lg bg-cf-orange hover:bg-cf-hover active:bg-cf-dark text-white font-medium text-xs transition flex items-center space-x-2 shadow-sm shadow-cf-orange/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate API Key</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-zinc-500 font-mono text-xs">Loading API keys...</div>
      ) : (
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-800">
            <thead className="bg-zinc-900/60">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Key Name
                </th>
                {scope === 'team' && (
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                    Owner / Member
                  </th>
                )}
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Prefix (Hashed lookup)
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Usage (Calls)
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Created
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={scope === 'team' ? 7 : 6} className="px-6 py-12 text-center text-zinc-500 text-xs">
                    No API keys found. Generate a key to connect external MCP clients (Cursor, Claude Code, MCP Inspector).
                  </td>
                </tr>
              ) : (
                keys.map((k) => {
                  const isRevoked = Boolean(k.revokedAt);
                  const isOwner = k.userId === user?.id;
                  const canRevoke = isAdmin || isOwner;

                  return (
                    <tr key={k.id} className="hover:bg-zinc-900/40 transition">
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs font-medium text-white">
                        {k.name}
                      </td>

                      {scope === 'team' && (
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs">
                          {k.user ? (
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-white">{k.user.name}</span>
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${
                                  k.user.role === 'admin'
                                    ? 'bg-cf-orange/15 text-cf-orange border-cf-orange/30'
                                    : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                                }`}
                              >
                                {k.user.role}
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-500 font-mono text-[11px]">—</span>
                          )}
                        </td>
                      )}

                      <td className="px-5 py-3.5 whitespace-nowrap text-xs font-mono text-cf-orange">
                        {k.keyPrefix}••••••••
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs font-mono">
                        <span
                          className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[11px] ${
                            (k.callCount || 0) > 0
                              ? 'bg-cf-orange/10 text-cf-orange border border-cf-orange/20 font-medium'
                              : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                          }`}
                        >
                          <Activity className="w-3 h-3" />
                          <span>{k.callCount || 0} calls</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-xs">
                        {isRevoked ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            <span>Revoked</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>Active</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-[11px] text-zinc-400 font-mono">
                        {new Date(k.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right text-xs">
                        {!isRevoked && canRevoke && (
                          <button
                            onClick={() => setRevokingKey(k)}
                            className="text-xs text-rose-400 hover:text-rose-300 font-medium inline-flex items-center space-x-1 p-1 rounded-md hover:bg-rose-500/10 transition"
                            title="Revoke Key"
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
      )}

      {/* Generate Key Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Key className="w-4 h-4 text-cf-orange" />
                <span>{createdKey ? 'API Key Generated' : 'Create Personalized API Key'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdKey ? (
              <div className="mt-4 space-y-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Copy this key immediately. It is stored as a SHA-256 hash in the database and cannot be retrieved later.
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={createdKey}
                    className="w-full pl-3 pr-20 py-2.5 bg-black border border-zinc-800 rounded-lg text-xs font-mono text-cf-orange focus:outline-none"
                  />
                  <button
                    onClick={() => handleCopy(createdKey)}
                    className="absolute right-1.5 top-1.5 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-medium transition flex items-center space-x-1"
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
                    className="px-4 py-1.5 bg-cf-orange hover:bg-cf-hover text-white rounded-lg text-xs font-medium transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Key Description / Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Production MCP Client Key"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-cf-orange"
                  />
                </div>

                <div className="text-[11px] text-zinc-500 font-mono">
                  Prefix: <span className="text-zinc-300">mcp_live_</span> + 32-character secure random hex
                </div>

                <div className="pt-2 flex justify-end space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-medium border border-zinc-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={issuing}
                    className="px-4 py-1.5 bg-cf-orange hover:bg-cf-hover text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
                  >
                    {issuing ? 'Generating...' : 'Create Key'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Kumo Revoke Confirmation Modal */}
      {revokingKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl max-w-sm w-full p-5 shadow-2xl shadow-black/80">
            <div className="flex items-center space-x-3 text-rose-400 mb-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Revoke API Key</h3>
                <p className="text-[11px] text-zinc-400">Immediate access revocation</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed mb-3">
              Are you sure you want to revoke <span className="font-semibold text-white font-mono">{revokingKey.name}</span>
              {revokingKey.user ? (
                <> belonging to <span className="text-cf-orange font-medium">{revokingKey.user.name}</span></>
              ) : ''}?
            </p>

            <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800 text-[11px] font-mono text-zinc-400 mb-4">
              Prefix: <span className="text-cf-orange">{revokingKey.keyPrefix}••••••••</span>
              <br />
              Subsequent MCP calls using this key will immediately return <span className="text-rose-400">401 Unauthorized</span>.
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setRevokingKey(null)}
                disabled={revoking}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRevoke}
                disabled={revoking}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 transition shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
              >
                {revoking ? (
                  <span>Revoking...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Revoke Immediately</span>
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
