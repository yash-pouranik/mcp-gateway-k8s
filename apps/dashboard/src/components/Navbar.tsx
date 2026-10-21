import React from 'react';
import { User } from '../api';
import { LogOut, Server, Key, Terminal, Cpu, Users, Activity } from 'lucide-react';

interface NavbarProps {
  user: User;
  currentTab: 'servers' | 'keys' | 'audit' | 'chat' | 'members' | 'observability';
  onTabChange: (tab: 'servers' | 'keys' | 'audit' | 'chat' | 'members' | 'observability') => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  currentTab,
  onTabChange,
  onLogout,
}) => {
  const allTabs = [
    { id: 'servers', label: 'Upstreams', icon: Server, adminOnly: false },
    { id: 'keys', label: 'API Keys', icon: Key, adminOnly: false },
    { id: 'audit', label: 'Audit Log', icon: Terminal, adminOnly: false },
    { id: 'observability', label: 'Metrics', icon: Activity, adminOnly: false },
    { id: 'chat', label: 'Chat Agent', icon: Cpu, adminOnly: false },
    { id: 'members', label: 'Team', icon: Users, adminOnly: true },
  ] as const;
  const tabs = allTabs.filter(t => !t.adminOnly || user.role === 'admin');

  return (
    <header className="bg-black border-b border-zinc-850 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo / Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden">
              <img src="/vynn_ai_logo.png" alt="VYNN" className="w-5 h-5 object-contain" />
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <span className="font-semibold text-white tracking-tight">VYNN</span>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-400 font-medium hidden sm:inline">MCP Gateway</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                k8s
              </span>
            </div>
          </div>

          {/* Minimalist Tab Navigation */}
          <nav className="flex items-center space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cf-orange' : 'text-zinc-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User profile & Logout */}
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-zinc-200 leading-none">{user.name}</div>
              <div className="text-[10px] font-mono text-zinc-500 mt-1 flex items-center justify-end space-x-1">
                <span className={`w-1.5 h-1.5 rounded-full ${user.role === 'admin' ? 'bg-cf-orange' : 'bg-zinc-500'}`} />
                <span className="capitalize">{user.role}</span>
              </div>
            </div>

            <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
