import React, { useState } from 'react';
import { api, User } from '../api';
import { Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

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
      <div className="max-w-sm w-full bg-zinc-950 border border-zinc-800 rounded-lg p-6 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3">
            <img src="/vynn_ai_logo.png" alt="VYNN" className="w-6 h-6 object-contain" />
          </div>
          <h1 className="text-base font-semibold text-white tracking-tight">VYNN / MCP Gateway</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Sign in to access the control plane and tool registry.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-500">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 text-xs"
                placeholder="you@domain.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-500">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 text-xs"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2 px-3 rounded bg-cf-orange hover:bg-cf-hover active:bg-cf-dark text-white font-medium text-xs transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-zinc-850">
          <div className="text-[10px] text-zinc-500 font-mono mb-2">
            Demo Credentials
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickFill('admin@mcp-platform.local', 'AdminPass123!')}
              className="py-1 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-[11px] font-mono text-zinc-300 transition text-center"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('member_a@mcp-platform.local', 'MemberPass123!')}
              className="py-1 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-[11px] font-mono text-zinc-400 transition text-center"
            >
              Alice (A)
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('member_b@mcp-platform.local', 'MemberPass123!')}
              className="py-1 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-[11px] font-mono text-zinc-400 transition text-center"
            >
              Bob (B)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
