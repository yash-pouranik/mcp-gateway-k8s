import React, { useState } from 'react';
import { User } from '../api';
import { ApiKeysView } from './ApiKeysView';
import { OAuthClientsView } from './OAuthClientsView';
import { Key, Shield } from 'lucide-react';

interface AccessViewProps {
  user: User;
  initialTab?: 'keys' | 'oauth';
}

export const AccessView: React.FC<AccessViewProps> = ({ user, initialTab = 'keys' }) => {
  const [activeSubTab, setActiveSubTab] = useState<'keys' | 'oauth'>(initialTab);

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-850 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight">Access & Credentials</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage authentication methods to connect external clients, agents, and applications.
          </p>
        </div>

        {/* Sub-tab Switcher Pills */}
        <div className="inline-flex items-center p-1 rounded-lg bg-zinc-900 border border-zinc-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('keys')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSubTab === 'keys'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60'
            }`}
          >
            <Key className={`w-3.5 h-3.5 ${activeSubTab === 'keys' ? 'text-cf-orange' : 'text-zinc-500'}`} />
            <span>API Keys</span>
          </button>

          <button
            onClick={() => setActiveSubTab('oauth')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSubTab === 'oauth'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60'
            }`}
          >
            <Shield className={`w-3.5 h-3.5 ${activeSubTab === 'oauth' ? 'text-cf-orange' : 'text-zinc-500'}`} />
            <span>OAuth Apps</span>
          </button>
        </div>
      </div>

      {/* Render Active Sub-View */}
      <div>
        {activeSubTab === 'keys' && <ApiKeysView user={user} />}
        {activeSubTab === 'oauth' && <OAuthClientsView user={user} />}
      </div>
    </div>
  );
};
