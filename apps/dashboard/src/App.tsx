import React, { useState, useEffect } from 'react';
import { api, User } from './api';
import { Navbar, DashboardTab } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { ServersView } from './components/ServersView';
import { ChatView } from './components/ChatView';
import { AccessView } from './components/AccessView';
import { MonitoringView } from './components/MonitoringView';
import { MembersView } from './components/MembersView';
import { ConnectDocsView } from './components/ConnectDocsView';
import { AppSkeleton } from './components/Skeleton';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<DashboardTab>('servers');
  const [accessSubTab, setAccessSubTab] = useState<'keys' | 'oauth'>('keys');

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('mcp_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await api.getMe();
        setUser(data.user);
      } catch (_) {
        localStorage.removeItem('mcp_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // RBAC: redirect members away from admin-only tabs
  useEffect(() => {
    if (user && user.role !== 'admin' && currentTab === 'members') {
      setCurrentTab('servers');
    }
  }, [user, currentTab]);

  const handleLogout = () => {
    localStorage.removeItem('mcp_token');
    setUser(null);
  };

  if (loading) {
    return <AppSkeleton />;
  }

  if (!user) {
    return <LoginView onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div
      className={`text-zinc-100 flex flex-col font-sans selection:bg-orange-500/20 selection:text-orange-300 ${
        currentTab === 'chat' ? 'h-[100dvh] overflow-hidden bg-claude-bg' : 'min-h-[100dvh] bg-black'
      }`}
    >
      <Navbar
        user={user}
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        onLogout={handleLogout}
      />

      <main
        className={`flex-1 w-full ${
          currentTab === 'chat'
            ? 'min-h-0 overflow-hidden p-0 flex flex-col'
            : 'max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6'
        }`}
      >
        {currentTab === 'servers' && <ServersView user={user} />}
        {currentTab === 'chat' && <ChatView />}
        {currentTab === 'access' && <AccessView user={user} initialTab={accessSubTab} />}
        {currentTab === 'monitoring' && <MonitoringView user={user} initialTab="audit" />}
        {currentTab === 'members' && <MembersView user={user} />}
        {currentTab === 'docs' && (
          <ConnectDocsView
            user={user}
            onNavigateToTab={(t) => {
              setAccessSubTab(t);
              setCurrentTab('access');
            }}
          />
        )}
      </main>
    </div>
  );
};

export default App;
