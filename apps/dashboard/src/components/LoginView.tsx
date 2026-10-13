import React, { useState } from 'react';
import { api, User } from '../api';
import { Lock, Mail, ArrowRight, UserCheck } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@mcp-platform.local');
  const [password, setPassword] = useState('AdminPass123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.login(email, password);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (userEmail: string, userPass: string) => {
    setEmail(userEmail);
    setPassword(userPass);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black">
      <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-7">
          <div className="inline-flex p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-cf-orange mb-3.5 shadow-sm">
            <span className="text-2xl font-black">⚡</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">MCP Gateway Console</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Aggregated Model Context Protocol Management & Agent Hub
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-cf-orange text-xs"
                placeholder="you@domain.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-cf-orange text-xs"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-cf-orange hover:bg-cf-hover active:bg-cf-dark text-white font-medium text-xs transition flex items-center justify-center space-x-2 shadow-sm shadow-cf-orange/20 disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Gateway'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-zinc-800/80">
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2.5 flex items-center space-x-1.5">
            <UserCheck className="w-3 h-3 text-cf-orange" />
            <span>Quick Fill Test Accounts</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('admin@mcp-platform.local', 'AdminPass123!')}
              className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-[11px] font-medium text-cf-orange transition text-center"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('member_a@mcp-platform.local', 'MemberPass123!')}
              className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-[11px] font-medium text-zinc-300 transition text-center"
            >
              Alice (A)
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('member_b@mcp-platform.local', 'MemberPass123!')}
              className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-[11px] font-medium text-zinc-300 transition text-center"
            >
              Bob (B)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
