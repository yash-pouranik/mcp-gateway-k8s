import React, { useState, useEffect } from 'react';
import { api, TeamMember, User, UserUsageSummary, ChatSessionSummary, ChatMessageRecord } from '../api';
import {
  Plus,
  Key,
  AlertCircle,
  RefreshCw,
  X,
  Mail,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { MembersGridSkeleton, TableRowsSkeleton } from './Skeleton';

interface MembersViewProps {
  user?: User;
}

export const MembersView: React.FC<MembersViewProps> = ({ user }) => {
  const [subTab, setSubTab] = useState<'roster' | 'usage'>('roster');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite member modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Token Usage Analytics
  const [usageSummary, setUsageSummary] = useState<UserUsageSummary[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  // Inspect Member Chat Modal
  const [inspectMember, setInspectMember] = useState<{ id: string; name: string } | null>(null);
  const [inspectSessions, setInspectSessions] = useState<ChatSessionSummary[]>([]);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [selectedInspectSession, setSelectedInspectSession] = useState<{
    session: ChatSessionSummary;
    messages: ChatMessageRecord[];
  } | null>(null);

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMembers();
      setMembers(data.members || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const loadUsage = async () => {
    setUsageLoading(true);
    try {
      const data = await api.getChatUsage();
      setUsageSummary(data.summary || []);
    } catch (_) {
      // non-fatal
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
    if (user?.role === 'admin') {
      loadUsage();
    }
  }, [user]);

  const handleOpenInspect = async (member: { id: string; name: string }) => {
    setInspectMember(member);
    setInspectLoading(true);
    setSelectedInspectSession(null);
    try {
      const data = await api.getChatSessions(member.id);
      setInspectSessions(data.sessions || []);
    } catch (err: any) {
      alert(`Failed to load member sessions: ${err.message}`);
    } finally {
      setInspectLoading(false);
    }
  };

  const handleOpenInspectSession = async (session: ChatSessionSummary) => {
    try {
      setInspectLoading(true);
      const data = await api.getChatSession(session.id);
      setSelectedInspectSession({
        session: data.session,
        messages: data.session.messages || [],
      });
    } catch (err: any) {
      alert(`Failed to load session messages: ${err.message}`);
    } finally {
      setInspectLoading(false);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setSubmitting(true);
    try {
      await api.createMember({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        password: invitePassword,
        role: inviteRole,
      });
      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
      setInvitePassword('');
      setInviteRole('member');
      loadMembers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to invite team member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 pb-3 sm:pb-4 border-b border-zinc-850">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base sm:text-lg font-semibold text-white tracking-tight">Team Management</h1>
            <span className="text-[10px] sm:text-xs font-mono px-1.5 sm:px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
            Authorized users, RBAC roles, and per-member token usage telemetry.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Sub-Tab Switcher */}
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-md border border-zinc-800 text-xs">
            <button
              onClick={() => setSubTab('roster')}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs transition-colors ${
                subTab === 'roster' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Roster
            </button>
            <button
              onClick={() => {
                setSubTab('usage');
                loadUsage();
              }}
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs transition-colors ${
                subTab === 'usage' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              AI Usage
            </button>
          </div>

          <button
            onClick={() => {
              loadMembers();
              loadUsage();
            }}
            className="p-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cf-orange' : ''}`} />
          </button>

          {subTab === 'roster' && (!user || user.role === 'admin') && (
            <button
              onClick={() => {
                setModalError(null);
                setShowInviteModal(true);
              }}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md bg-cf-orange hover:bg-cf-hover active:bg-cf-dark text-white font-medium text-xs transition flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Invite Member</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Sub-Tab: Team Roster */}
      {subTab === 'roster' && (
        loading ? (
          <MembersGridSkeleton count={3} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="p-3 sm:p-4 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-lg transition space-y-2.5 sm:space-y-3"
              >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-mono font-medium text-zinc-300">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white tracking-tight">{member.name}</div>
                    <div className="text-[11px] text-zinc-400 truncate max-w-[12rem] flex items-center space-x-1 mt-0.5">
                      <Mail className="w-3 h-3 text-zinc-500" />
                      <span>{member.email}</span>
                    </div>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                    member.role === 'admin'
                      ? 'bg-cf-orange/10 text-cf-orange border-cf-orange/20'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                  }`}
                >
                  {member.role}
                </span>
              </div>

              <div className="pt-2.5 border-t border-zinc-850 flex items-center justify-between text-xs text-zinc-400 font-mono">
                <div className="flex items-center space-x-1.5 text-[11px]">
                  <Key className="w-3 h-3 text-zinc-500" />
                  <span>{member._count?.apiKeys || 0} API Keys</span>
                </div>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => handleOpenInspect(member)}
                    className="text-[11px] text-cf-orange hover:underline transition flex items-center space-x-1 font-sans"
                  >
                    <span>View Chats</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        )
      )}

      {/* 2. Sub-Tab: AI Chat Usage & Token Analytics */}
      {subTab === 'usage' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-zinc-800 rounded-lg overflow-hidden border border-zinc-800">
            <div className="p-4 bg-zinc-950">
              <div className="text-xs text-zinc-400 font-medium">Total Tokens Consumed</div>
              <div className="text-2xl font-semibold font-mono text-white mt-1">
                {usageSummary.reduce((acc, u) => acc + u.totalTokens, 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-zinc-500 font-mono mt-0.5">Across all team sessions</div>
            </div>

            <div className="p-4 bg-zinc-950">
              <div className="text-xs text-zinc-400 font-medium">AI Invocations</div>
              <div className="text-2xl font-semibold font-mono text-cf-orange mt-1">
                {usageSummary.reduce((acc, u) => acc + u.requestCount, 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-zinc-500 font-mono mt-0.5">Multi-turn tool calls</div>
            </div>

            <div className="p-4 bg-zinc-950">
              <div className="text-xs text-zinc-400 font-medium">Active AI Providers</div>
              <div className="text-2xl font-semibold font-mono text-emerald-400 mt-1">3 Active</div>
              <div className="text-[11px] text-zinc-500 font-mono mt-0.5">OpenAI, Google Gemini, Grok</div>
            </div>
          </div>

          <div className="border border-zinc-800 bg-zinc-950 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-200 tracking-tight">Per-Member Usage Breakdown</h3>
              <span className="text-[11px] font-mono text-zinc-500">Daily rollups</span>
            </div>

            <table className="min-w-full text-left text-xs">
              <thead className="bg-zinc-900/50 text-zinc-400 font-mono text-[11px] border-b border-zinc-800">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Member</th>
                  <th className="px-4 py-2.5 font-medium">Providers Breakdown</th>
                  <th className="px-4 py-2.5 font-medium text-right">Prompt</th>
                  <th className="px-4 py-2.5 font-medium text-right">Completion</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total Tokens</th>
                  <th className="px-4 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {usageLoading ? (
                  <TableRowsSkeleton cols={6} rows={4} />
                ) : usageSummary.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-zinc-500 text-xs font-mono">
                      No chat tokens recorded yet.
                    </td>
                  </tr>
                ) : (
                  usageSummary.map((item) => (
                    <tr key={item.userId} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{item.name}</div>
                        <div className="text-[11px] font-mono text-zinc-500">{item.email}</div>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(item.providers).map(([prov, tokens]) => (
                            <span
                              key={prov}
                              className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300"
                            >
                              <strong className="text-cf-orange font-normal">{prov}:</strong> {tokens.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">
                        {item.promptTokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">
                        {item.completionTokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-white">
                        {item.totalTokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenInspect({ id: item.userId, name: item.name })}
                          className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition text-xs font-medium"
                        >
                          View Chats
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspect Member Chats Modal */}
      {inspectMember && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Chat History: {inspectMember.name}
              </h3>
              <button
                onClick={() => {
                  setInspectMember(null);
                  setSelectedInspectSession(null);
                }}
                className="p-1 rounded text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {inspectLoading ? (
                <div className="space-y-2 py-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-3 bg-zinc-900/50 border border-zinc-850 rounded animate-pulse space-y-1.5">
                      <div className="h-3.5 w-48 bg-zinc-850 rounded" />
                      <div className="h-3 w-28 bg-zinc-900 rounded" />
                    </div>
                  ))}
                </div>
              ) : selectedInspectSession ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
                    <button
                      onClick={() => setSelectedInspectSession(null)}
                      className="text-cf-orange hover:underline font-mono"
                    >
                      ← Back to Sessions
                    </button>
                    <span className="font-mono text-zinc-400">
                      {selectedInspectSession.session.title}
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
                    {selectedInspectSession.messages.map((m) => {
                      const isUser = m.role === 'user';
                      return (
                        <div
                          key={m.id}
                          className={`p-3 rounded border text-xs leading-relaxed ${
                            isUser
                              ? 'bg-zinc-900 border-zinc-800 text-zinc-200'
                              : 'bg-zinc-950 border-zinc-850 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500 mb-1">
                            <span className="font-semibold text-zinc-400">
                              {isUser ? inspectMember.name : 'VYNN Assistant'}
                            </span>
                            <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <div className="whitespace-pre-wrap">{m.content}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : inspectSessions.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-xs font-mono">
                  No chat sessions recorded for this member.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {inspectSessions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => handleOpenInspectSession(s)}
                      className="p-3 rounded bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-800 cursor-pointer transition flex items-center justify-between"
                    >
                      <div className="truncate pr-3">
                        <div className="text-xs font-medium text-white truncate">{s.title}</div>
                        <div className="text-[10px] font-mono text-zinc-500 flex items-center space-x-2 mt-0.5">
                          <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
                          <span>·</span>
                          <span>{s.messageCount} messages</span>
                          <span>·</span>
                          <span>{s.totalTokens} tokens</span>
                          {s.provider && (
                            <span className="px-1 py-0.2 rounded bg-zinc-800 text-cf-orange uppercase">
                              {s.provider}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white">Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-1 rounded text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="mt-3 p-2.5 bg-rose-950/20 border border-rose-900/40 rounded text-rose-300 text-xs flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleInviteSubmit} className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Developer Bob"
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white text-xs focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="bob@mcp-platform.local"
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white text-xs focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white text-xs focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                  className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white text-xs focus:outline-none focus:border-zinc-700 font-mono"
                >
                  <option value="member">Member (Read tools & Personal API keys)</option>
                  <option value="admin">Administrator (Full cluster & mutating tools)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 rounded border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 rounded bg-cf-orange hover:bg-cf-hover active:bg-cf-dark disabled:opacity-40 text-white text-xs font-medium transition"
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
