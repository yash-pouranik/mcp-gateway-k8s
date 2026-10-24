import React from 'react';
import { User } from '../api';
import { LogOut, Server, Key, Terminal, Cpu, Users, Activity, Shield } from 'lucide-react';

interface NavbarProps {
  user: User;
  currentTab: 'servers' | 'keys' | 'audit' | 'chat' | 'members' | 'observability' | 'oauth';
  onTabChange: (tab: 'servers' | 'keys' | 'audit' | 'chat' | 'members' | 'observability' | 'oauth') => void;
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
    { id: 'oauth', label: 'OAuth Apps', icon: Shield, adminOnly: false },
    { id: 'audit', label: 'Audit Log', icon: Terminal, adminOnly: false },
    { id: 'observability', label: 'Metrics', icon: Activity, adminOnly: false },
    { id: 'chat', label: 'Chat Agent', icon: Cpu, adminOnly: false },
    { id: 'members', label: 'Team', icon: Users, adminOnly: true },
  ] as const;
  const tabs = allTabs.filter(t => !t.adminOnly || user.role === 'admin');

  return (
    <header className="bg-black border-b border-zinc-850 sticky top-0 z-40 shrink-0">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Main Header Row */}
        <div className="flex items-center justify-between h-12 md:h-14">
          {/* Logo / Brand */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
              <img src="/vynn_ai_logo.png" alt="VYNN" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
            </div>
            <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm">
              <span className="font-semibold text-white tracking-tight">VYNN</span>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-400 font-medium hidden sm:inline">MCP Gateway</span>
              <span className="text-[9px] sm:text-[10px] font-mono px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                k8s
              </span>
            </div>
          </div>

          {/* Desktop Tab Navigation (Hidden on Mobile) */}
          <nav className="hidden md:flex items-center space-x-1">
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
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="text-right">
              <div className="text-[11px] sm:text-xs font-medium text-zinc-200 leading-none truncate max-w-[110px] sm:max-w-none">
                {user.name}
              </div>
              <div className="text-[9px] sm:text-[10px] font-mono text-zinc-500 mt-0.5 sm:mt-1 flex items-center justify-end space-x-1">
                <span className={`w-1.5 h-1.5 rounded-full ${user.role === 'admin' ? 'bg-cf-orange' : 'bg-zinc-500'}`} />
                <span className="capitalize">{user.role}</span>
              </div>
            </div>

            <div className="h-3.5 sm:h-4 w-px bg-zinc-800" />

            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile Tab Strip (Scrollable, Clean, No-Scrollbar) */}
        <nav className="flex md:hidden items-center space-x-1 py-1.5 overflow-x-auto no-scrollbar border-t border-zinc-900/80 -mx-3 px-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
              >
                <Icon className={`w-3 h-3 ${isActive ? 'text-cf-orange' : 'text-zinc-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
