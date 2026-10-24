import React, { useState } from 'react';
import { User } from '../api';
import { AuditLogView } from './AuditLogView';
import { ObservabilityView } from './ObservabilityView';
import { Terminal, Activity } from 'lucide-react';

interface MonitoringViewProps {
  user: User;
  initialTab?: 'audit' | 'metrics';
}

export const MonitoringView: React.FC<MonitoringViewProps> = ({ user, initialTab = 'audit' }) => {
  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'metrics'>(initialTab);

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-850 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight">Monitoring & Telemetry</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Inspect real-time tool executions, audit trails, and Prometheus telemetry metrics.
          </p>
        </div>

        {/* Sub-tab Switcher Pills */}
        <div className="inline-flex items-center p-1 rounded-lg bg-zinc-900 border border-zinc-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSubTab === 'audit'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60'
            }`}
          >
            <Terminal className={`w-3.5 h-3.5 ${activeSubTab === 'audit' ? 'text-cf-orange' : 'text-zinc-500'}`} />
            <span>Audit Log</span>
          </button>

          <button
            onClick={() => setActiveSubTab('metrics')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSubTab === 'metrics'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60'
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${activeSubTab === 'metrics' ? 'text-cf-orange' : 'text-zinc-500'}`} />
            <span>Metrics</span>
          </button>
        </div>
      </div>

      {/* Render Active Sub-View */}
      <div>
        {activeSubTab === 'audit' && <AuditLogView user={user} />}
        {activeSubTab === 'metrics' && (
          <ObservabilityView
            user={user}
            onNavigateToAudit={() => setActiveSubTab('audit')}
          />
        )}
      </div>
    </div>
  );
};
