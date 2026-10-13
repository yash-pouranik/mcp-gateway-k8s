import React from 'react';
import { User } from '../api';
import { LogOut, Server, Key, Terminal, Cpu, Zap, Users } from 'lucide-react';

interface NavbarProps {
  user: User;
  currentTab: 'servers' | 'keys' | 'audit' | 'chat' | 'members';
  onTabChange: (tab: 'servers' | 'keys' | 'audit' | 'chat' | 'members') => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  currentTab,
  onTabChange,
  onLogout,
}) => {
  const tabs = [
    { id: 'servers', label: 'Upstream MCP', icon: Server },
    { id: 'keys', label: 'API Keys', icon: Key },
    { id: 'audit', label: 'Audit Trail', icon: Terminal },
    { id: 'chat', label: 'AI Agent', icon: Cpu },
    { id: 'members', label: 'Team', icon: Users },
  ] as const;

  return (
    <header className="bg-black/90 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <div className="flex items-center space-x-3.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cf-orange to-amber-600 flex items-center justify-center text-black font-black text-sm shadow-md shadow-cf-orange/20">
              <Zap className="w-4 h-4 text-black fill-black" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base text-white tracking-tight">MCP Gateway</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-cf-orange border border-cf-orange/30">
                k8s
              </span>
            </div>
          </div>

          {/* Kumo-style Segmented Tab Switcher */}
          <nav className="flex items-center bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cf-orange' : 'text-zinc-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User profile & Logout */}
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-white">{user.name}</div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider flex items-center justify-end space-x-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cf-orange"></span>
                <span>{user.role}</span>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
