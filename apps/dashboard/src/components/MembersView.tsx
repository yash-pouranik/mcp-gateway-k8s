import React, { useState, useEffect } from 'react';
import { api, TeamMember } from '../api';
import { Users, Plus, Key, Calendar, AlertCircle, RefreshCw, X, Mail } from 'lucide-react';

export const MembersView: React.FC = () => {
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

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMembers();
      setMembers(data.members);
    } catch (err: any) {
      setError(err.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim() || !invitePassword.trim()) {
      setModalError('All fields are required');
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      await api.createMember({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        password: invitePassword.trim(),
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
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-bold tracking-tight text-white font-sans">Team Management</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-cf-orange">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Manage authorized users, roles, and API key provisioning across the MCP Gateway platform.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={loadMembers}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition shadow-sm"
            title="Refresh members"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cf-orange' : ''}`} />
          </button>
          <button
            onClick={() => {
              setModalError(null);
              setShowInviteModal(true);
            }}
            className="flex items-center space-x-2 px-3.5 py-2 bg-cf-orange hover:bg-cf-hover active:bg-cf-dark text-white rounded-xl text-xs font-semibold shadow-md shadow-cf-orange/20 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Invite Member</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-950/40 border border-rose-900/60 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => (
          <div
            key={member.id}
            className="p-4 bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl shadow-sm transition group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-semibold text-zinc-200">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white tracking-tight">{member.name}</div>
                  <div className="text-xs text-zinc-400 truncate max-w-[14rem] flex items-center space-x-1 mt-0.5">
                    <Mail className="w-3 h-3 text-zinc-500" />
                    <span>{member.email}</span>
                  </div>
                </div>
              </div>

              <span
                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  member.role === 'admin'
                    ? 'bg-cf-orange/15 text-cf-orange border-cf-orange/30'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                }`}
              >
                {member.role}
              </span>
            </div>

            <div className="mt-4 pt-3.5 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400 font-mono">
              <div className="flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-zinc-500" />
                <span>{member._count?.apiKeys || 0} API Keys</span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] text-zinc-500">
                <Calendar className="w-3 h-3" />
                <span>{new Date(member.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3.5 border-b border-zinc-800 mb-4">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-cf-orange" />
                <h3 className="text-sm font-bold text-white tracking-tight">Invite Team Member</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 mb-4 bg-rose-950/40 border border-rose-900/60 rounded-xl text-rose-300 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleInviteSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-cf-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. sarah@example.com"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-cf-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="Strong password for login"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-cf-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-cf-orange"
                >
                  <option value="member">Member (Can issue personal keys & use AI Agent)</option>
                  <option value="admin">Administrator (Full cluster & server config control)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-cf-orange hover:bg-cf-hover active:bg-cf-dark disabled:opacity-40 text-white text-xs font-semibold transition"
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
