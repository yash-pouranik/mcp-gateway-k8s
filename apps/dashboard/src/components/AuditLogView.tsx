import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api, AuditLog, McpServer, TeamMember, User } from '../api';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  ChevronLeft,
  Calendar,
  Check,
  Server,
  User as UserIcon,
  Activity,
  Key,
  Cpu,
} from 'lucide-react';

interface AuditLogViewProps {
  user: User | null;
}

interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

// -------------------------------------------------------------
// Kumo Custom Select Component (No default browser HTML selects)
// -------------------------------------------------------------
const KumoSelect: React.FC<{
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (val: string) => void;
  icon?: React.ComponentType<{ className?: string }>;
  placeholder?: string;
  widthClass?: string;
}> = ({ label, value, options, onChange, icon: Icon, placeholder = 'Select...', widthClass = 'w-44' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedOption = options.find((o) => o.value === value);
  const filteredOptions = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className={`relative flex flex-col ${widthClass}`} ref={containerRef}>
      <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1 flex items-center space-x-1">
        {Icon && <Icon className="w-2.5 h-2.5 text-zinc-500" />}
        <span>{label}</span>
      </span>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#222222] hover:bg-[#282828] border transition text-xs font-sans ${
          isOpen ? 'border-cf-orange/70 shadow-sm' : value ? 'border-zinc-700 text-zinc-100' : 'border-zinc-800 text-zinc-400'
        }`}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 flex-shrink-0 ml-1.5 ${
            isOpen ? 'rotate-180 text-cf-orange' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-[100%] mt-1 left-0 w-full min-w-[13rem] z-50 rounded-xl bg-[#1a1a1a] border border-zinc-700/80 shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100 font-sans">
          {options.length > 6 && (
            <div className="px-2 py-1 mb-1 border-b border-zinc-800">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-cf-orange/60"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div className="max-h-52 overflow-y-auto space-y-0.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-zinc-500 text-[11px] text-center">No options found</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition text-left ${
                      isSelected
                        ? 'bg-cf-orange/15 text-white font-medium'
                        : 'text-zinc-300 hover:text-white hover:bg-zinc-800/70'
                    }`}
                  >
                    <div className="truncate">
                      <div className="truncate">{opt.label}</div>
                      {opt.sublabel && <div className="text-[10px] text-zinc-500 font-mono truncate">{opt.sublabel}</div>}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cf-orange flex-shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------------------
// Kumo Custom Date Range Selector (No default browser date widgets)
// -----------------------------------------------------------------
const KumoDateFilter: React.FC<{
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}> = ({ startDate, endDate, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const [activePreset, setActivePreset] = useState<'all' | 'today' | '24h' | '7d' | '30d' | 'custom'>('all');

  const applyPreset = (preset: 'all' | 'today' | '24h' | '7d' | '30d') => {
    setActivePreset(preset);
    const now = new Date();

    if (preset === 'all') {
      onChange('', '');
    } else if (preset === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      onChange(todayStr, todayStr);
    } else if (preset === '24h') {
      const past24h = new Date(Date.now() - 24 * 3600 * 1000);
      onChange(past24h.toISOString(), now.toISOString());
    } else if (preset === '7d') {
      const past7d = new Date(Date.now() - 7 * 86400 * 1000);
      onChange(past7d.toISOString().split('T')[0], now.toISOString().split('T')[0]);
    } else if (preset === '30d') {
      const past30d = new Date(Date.now() - 30 * 86400 * 1000);
      onChange(past30d.toISOString().split('T')[0], now.toISOString().split('T')[0]);
    }
    setIsOpen(false);
  };

  const getLabel = () => {
    if (!startDate && !endDate) return 'All Time';
    if (activePreset === 'today') return 'Today';
    if (activePreset === '24h') return 'Last 24 Hours';
    if (activePreset === '7d') return 'Last 7 Days';
    if (activePreset === '30d') return 'Last 30 Days';
    return `${startDate || 'Start'} → ${endDate || 'End'}`;
  };

  return (
    <div className="relative flex flex-col w-48" ref={containerRef}>
      <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1 flex items-center space-x-1">
        <Calendar className="w-2.5 h-2.5 text-zinc-500" />
        <span>Time Range</span>
      </span>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#222222] hover:bg-[#282828] border transition text-xs font-sans ${
          isOpen ? 'border-cf-orange/70 shadow-sm' : startDate || endDate ? 'border-zinc-700 text-zinc-100' : 'border-zinc-800 text-zinc-400'
        }`}
      >
        <div className="flex items-center space-x-2 truncate">
          <Calendar className="w-3.5 h-3.5 text-cf-orange flex-shrink-0" />
          <span className="truncate">{getLabel()}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 flex-shrink-0 ml-1.5 ${
            isOpen ? 'rotate-180 text-cf-orange' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-[100%] mt-1 right-0 sm:left-0 w-64 z-50 rounded-xl bg-[#1a1a1a] border border-zinc-700/80 shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-100 font-sans">
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">Quick Presets</div>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: '24h', label: 'Last 24h' },
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id as any)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition text-left ${
                  activePreset === p.id && !startDate && p.id === 'all'
                    ? 'bg-cf-orange text-white'
                    : activePreset === p.id && startDate
                    ? 'bg-cf-orange text-white'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="border-t border-zinc-800 pt-2.5 space-y-2">
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Custom Date Range</div>
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setActivePreset('custom');
                  onChange(e.target.value, endDate);
                }}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-cf-orange/60 font-mono"
              />
              <span className="text-zinc-600 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setActivePreset('custom');
                  onChange(startDate, e.target.value);
                }}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-cf-orange/60 font-mono"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// Main AuditLogView View Component
// -------------------------------------------------------------
export const AuditLogView: React.FC<AuditLogViewProps> = ({ user }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter state
  const [filterUserId, setFilterUserId] = useState('');
  const [filterServerId, setFilterServerId] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'true' | 'false'>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Pagination
  const pageSize = 50;
  const [currentPage, setCurrentPage] = useState(1);

  // Reference data for filter dropdowns
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [servers, setServers] = useState<McpServer[]>([]);

  const isAdmin = user?.role === 'admin';

  // Load reference data for filters
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        const [serversData, membersData] = await Promise.all([
          api.getServers(),
          isAdmin ? api.getMembers() : Promise.resolve({ members: [] }),
        ]);
        setServers(serversData.servers);
        setMembers(membersData.members);
      } catch (_) {
        // Non-critical
      }
    };
    loadFilterData();
  }, [isAdmin]);

  const fetchLogs = useCallback(
    async (page: number = currentPage) => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getAuditLogs({
          limit: pageSize,
          offset: (page - 1) * pageSize,
          userId: filterUserId || undefined,
          serverId: filterServerId || undefined,
          success: filterStatus !== '' ? filterStatus === 'true' : undefined,
          search: filterSearch.trim() || undefined,
          startDate: filterStartDate || undefined,
          endDate: filterEndDate || undefined,
        });
        setLogs(data.logs);
        setTotal(data.total);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch audit logs');
      } finally {
        setLoading(false);
      }
    },
    [currentPage, filterUserId, filterServerId, filterStatus, filterSearch, filterStartDate, filterEndDate]
  );

  // Fetch on mount and when page changes
  useEffect(() => {
    fetchLogs(currentPage);
  }, [currentPage]);

  // Auto-apply filters (debounced for search, immediate for dropdowns)
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchLogs(1);
    }, filterSearch ? 350 : 0);
    return () => clearTimeout(timer);
  }, [filterUserId, filterServerId, filterStatus, filterStartDate, filterEndDate, filterSearch]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingEnd = Math.min(currentPage * pageSize, total);

  const hasActiveFilters = Boolean(
    filterUserId || filterServerId || filterStatus || filterSearch || filterStartDate || filterEndDate
  );

  const clearFilters = () => {
    setFilterUserId('');
    setFilterServerId('');
    setFilterStatus('');
    setFilterSearch('');
    setFilterStartDate('');
    setFilterEndDate('');
    setCurrentPage(1);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Audit Trail & Telemetry</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300">
              {total} events logged
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time audit log of all tool invocations, user sessions, duration metrics, and access rejections.
          </p>
        </div>

        <button
          onClick={() => fetchLogs(currentPage)}
          disabled={loading}
          className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition flex items-center space-x-1.5 text-xs font-medium shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cf-orange' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Kumo Styled Filter Dock */}
      <div className="p-3.5 bg-zinc-950/80 border border-zinc-800/90 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          {/* User Filter (admin only) */}
          {isAdmin && (
            <KumoSelect
              label="User / Actor"
              value={filterUserId}
              options={[{ value: '', label: 'All Users' }, ...members.map((m) => ({ value: m.id, label: m.name, sublabel: m.email }))]}
              onChange={setFilterUserId}
              icon={UserIcon}
              widthClass="w-44"
            />
          )}

          {/* Upstream Server Filter */}
          <KumoSelect
            label="Upstream Server"
            value={filterServerId}
            options={[{ value: '', label: 'All Servers' }, ...servers.map((s) => ({ value: s.id, label: s.name, sublabel: s.slug }))]}
            onChange={setFilterServerId}
            icon={Server}
            widthClass="w-44"
          />

          {/* Status Filter */}
          <KumoSelect
            label="Result"
            value={filterStatus}
            options={[
              { value: '', label: 'All Results' },
              { value: 'true', label: 'Success Only' },
              { value: 'false', label: 'Rejected / Failed' },
            ]}
            onChange={(val) => setFilterStatus(val as '' | 'true' | 'false')}
            icon={Activity}
            widthClass="w-36"
          />

          {/* Custom Date Range Filter */}
          <KumoDateFilter
            startDate={filterStartDate}
            endDate={filterEndDate}
            onChange={(start, end) => {
              setFilterStartDate(start);
              setFilterEndDate(end);
            }}
          />

          {/* Search Field */}
          <div className="flex flex-col flex-1 min-w-[13rem]">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1 flex items-center space-x-1">
              <Search className="w-2.5 h-2.5 text-zinc-500" />
              <span>Search Telemetry</span>
            </span>
            <div className="relative">
              <input
                type="text"
                placeholder="Search tool name or error trace..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full px-3 py-1.5 pl-8 bg-[#222222] hover:bg-[#282828] border border-zinc-800 focus:border-cf-orange/70 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none font-mono transition"
              />
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <div className="pb-0.5">
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl border border-zinc-800 transition"
                title="Reset all active filters"
              >
                <X className="w-3 h-3 text-cf-orange" />
                <span>Clear Filters</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
          <span>Total Records: {total}</span>
          <span>Showing {showingStart}-{showingEnd} of {total}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800">
            <thead className="bg-zinc-900/60">
              <tr>
                <th className="w-8 px-4 py-3"></th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Actor
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Tool Invoked
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Target Upstream
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Result
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  Latency
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 font-mono text-xs">
                    Loading audit stream...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 text-xs font-sans">
                    No audit records match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => toggleExpand(log.id)}
                        className="hover:bg-zinc-900/40 cursor-pointer transition select-none"
                      >
                        <td className="px-4 py-3 text-zinc-500">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-cf-orange" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-zinc-300">
                          {new Date(log.calledAt).toLocaleTimeString()}
                          <span className="text-[10px] text-zinc-500 ml-1.5">
                            {new Date(log.calledAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {log.user ? (
                            <div>
                              <div className="font-medium text-white flex items-center space-x-1.5">
                                <span>{log.user.name}</span>
                                {log.inputSummary?.keyName ? (
                                  <span
                                    className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                    title={`API Key: ${log.inputSummary.keyName}`}
                                  >
                                    key: {log.inputSummary.keyName}
                                  </span>
                                ) : log.inputSummary?.keyPrefix ? (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                    {log.inputSummary.keyPrefix}••••
                                  </span>
                                ) : log.inputSummary?.source === 'vynn_chat_agent' ? (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-cf-orange/15 text-cf-orange border border-cf-orange/30">
                                    VYNN Chat
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-500">{log.user.email}</div>
                            </div>
                          ) : (
                            <span className="text-amber-400 font-mono text-[11px]">Unauthenticated / Unknown</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-mono font-medium text-cf-orange">
                          {log.toolName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-300">
                          {log.server?.name || (log.serverId ? 'Server' : '—')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {log.success ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium font-sans">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Success</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-medium font-sans">
                              <XCircle className="w-3 h-3" />
                              <span>Rejected</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-mono text-zinc-400">
                          {log.durationMs}ms
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-black/60">
                          <td colSpan={7} className="px-8 py-4">
                            <div className="space-y-3.5">
                              {/* Auth / Client Attribution Banner */}
                              <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs">
                                <span className="text-zinc-500 font-mono text-[11px] uppercase tracking-wider">Auth Context:</span>
                                {(log.inputSummary?.keyPrefix || log.inputSummary?.apiKeyPrefix) ? (
                                  <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/25 font-mono text-[11px]">
                                    <Key className="w-3 h-3 text-amber-400" />
                                    <span>
                                      {log.inputSummary.keyName || log.inputSummary.apiKeyName || 'External Client'} ({log.inputSummary.keyPrefix || log.inputSummary.apiKeyPrefix}••••••••)
                                    </span>
                                  </span>
                                ) : log.inputSummary?.source === 'vynn_chat_agent' ? (
                                  <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-lg bg-cf-orange/10 text-cf-orange border border-cf-orange/30 font-mono text-[11px]">
                                    <Cpu className="w-3 h-3" />
                                    <span>VYNN Autonomous Studio Agent</span>
                                  </span>
                                ) : (
                                  <span className="text-zinc-400 font-mono text-[11px]">Web Console Session</span>
                                )}
                                <span className="text-zinc-700 font-mono">|</span>
                                <span className="text-zinc-500 font-mono text-[11px]">Server:</span>
                                <span className="text-zinc-200 font-mono text-[11px]">
                                  {log.server?.name || (log.serverId ? 'Internal MCP' : 'Gateway Hub')}
                                </span>
                                <span className="text-zinc-700 font-mono">|</span>
                                <span className="text-zinc-500 font-mono text-[11px]">Duration:</span>
                                <span className="text-zinc-200 font-mono text-[11px]">{log.durationMs}ms</span>
                              </div>

                              {log.errorMsg && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-mono">
                                  <strong>Execution Error:</strong> {log.errorMsg}
                                </div>
                              )}

                              {/* 2-Column Split: Input Parameters vs Response Output */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                                <div>
                                  <div className="text-[10px] font-mono uppercase text-zinc-500 mb-1.5 flex items-center justify-between">
                                    <span>Input Parameters JSON</span>
                                    <span className="text-[10px] text-zinc-600 font-mono">Sent to Tool</span>
                                  </div>
                                  <pre className="p-3 bg-zinc-950 rounded-xl text-xs font-mono text-zinc-300 overflow-x-auto border border-zinc-800 max-h-64 custom-scrollbar">
                                    {JSON.stringify(log.inputSummary?.parameters || log.inputSummary, null, 2)}
                                  </pre>
                                </div>

                                <div>
                                  <div className="text-[10px] font-mono uppercase text-zinc-500 mb-1.5 flex items-center justify-between">
                                    <span>Upstream Response / Output JSON</span>
                                    {log.inputSummary?.response !== undefined ? (
                                      <span className="text-[10px] text-emerald-400 font-mono">Captured Payload</span>
                                    ) : (
                                      <span className="text-[10px] text-zinc-500 font-mono">Status Output</span>
                                    )}
                                  </div>
                                  <pre className="p-3 bg-zinc-950 rounded-xl text-xs font-mono text-zinc-300 overflow-x-auto border border-zinc-800 max-h-64 custom-scrollbar">
                                    {log.inputSummary?.response !== undefined
                                      ? JSON.stringify(log.inputSummary.response, null, 2)
                                      : log.success
                                      ? JSON.stringify({ status: 'Success (Cleanly executed upstream)' }, null, 2)
                                      : JSON.stringify({ status: 'Failed', error: log.errorMsg }, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <div className="px-5 py-3 bg-zinc-900/40 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 font-mono">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Prev</span>
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
