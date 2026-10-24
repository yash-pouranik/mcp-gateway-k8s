import React, { useState, useEffect } from 'react';
import { api, User } from './api';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { ServersView } from './components/ServersView';
import { ApiKeysView } from './components/ApiKeysView';
import { AuditLogView } from './components/AuditLogView';
import { ChatView } from './components/ChatView';
import { MembersView } from './components/MembersView';
import { ObservabilityView } from './components/ObservabilityView';
import { OAuthClientsView } from './components/OAuthClientsView';
import { ConnectDocsView } from './components/ConnectDocsView';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<'servers' | 'keys' | 'audit' | 'chat' | 'members' | 'observability' | 'oauth' | 'docs'>('servers');

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
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 font-mono text-xs">
        Initializing MCP Gateway...
      </div>
    );
  }

  if (!user) {
    return <LoginView onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className={`text-zinc-100 flex flex-col font-sans selection:bg-orange-500/20 selection:text-orange-300 ${currentTab === 'chat' ? 'h-[100dvh] overflow-hidden bg-claude-bg' : 'min-h-[100dvh] bg-black'}`}>
      <Navbar
        user={user}
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        onLogout={handleLogout}
      />

      <main className={`flex-1 w-full ${currentTab === 'chat' ? 'min-h-0 overflow-hidden p-0 flex flex-col' : 'max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6'}`}>
        {currentTab === 'servers' && <ServersView user={user} />}
        {currentTab === 'keys' && <ApiKeysView user={user} />}
        {currentTab === 'audit' && <AuditLogView user={user} />}
        {currentTab === 'observability' && <ObservabilityView user={user} onNavigateToAudit={() => setCurrentTab('audit')} />}
        {currentTab === 'chat' && <ChatView />}
        {currentTab === 'members' && <MembersView user={user} />}
        {currentTab === 'oauth' && <OAuthClientsView user={user} />}
        {currentTab === 'docs' && <ConnectDocsView user={user} onNavigateToTab={(t) => setCurrentTab(t)} />}
      </main>
    </div>
  );
};

export default App;
