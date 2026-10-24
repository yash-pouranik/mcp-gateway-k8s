import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api, AuditLog, McpServer, TeamMember, User } from '../api';
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  ChevronLeft,
  Check,
} from 'lucide-react';

interface AuditLogViewProps {
  user: User | null;
}

interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

// Minimalist Dropdown Select
const MinimalSelect: React.FC<{
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (val: string) => void;
  placeholder?: string;
  widthClass?: string;
}> = ({ label, value, options, onChange, placeholder = 'Select...', widthClass = 'w-40' }) => {
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
      <span className="text-[11px] text-zinc-400 font-medium mb-1">{label}</span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-zinc-900 border text-xs transition ${
          isOpen ? 'border-zinc-700' : value ? 'border-zinc-700 text-zinc-200' : 'border-zinc-800 text-zinc-400'
        }`}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-500 transition-transform ml-1 shrink-0 ${
            isOpen ? 'rotate-180 text-zinc-300' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-[100%] mt-1 left-0 w-full min-w-[12rem] z-50 rounded-md bg-zinc-950 border border-zinc-800 shadow-xl p-1 text-xs">
          {options.length > 6 && (
            <div className="p-1 border-b border-zinc-850 mb-1">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="p-2 text-zinc-500 text-center">No options</div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left text-xs transition ${
                    opt.value === value
                      ? 'bg-zinc-800 text-white font-medium'
                      : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <div className="truncate">
                    <div>{opt.label}</div>
                    {opt.sublabel && <div className="text-[10px] text-zinc-500 font-mono truncate">{opt.sublabel}</div>}
                  </div>
                  {opt.value === value && <Check className="w-3 h-3 text-cf-orange shrink-0 ml-1.5" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Minimalist Date Preset Filter
const MinimalDateFilter: React.FC<{
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}> = ({ startDate, endDate, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('all');
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

  const applyPreset = (preset: 'all' | 'today' | '24h' | '7d' | '30d') => {
    setActivePreset(preset);
    const now = new Date();
    let start = '';
    let end = '';

    if (preset === 'today') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      start = d.toISOString().split('T')[0];
    } else if (preset === '24h') {
      const d = new Date(Date.now() - 24 * 3600 * 1000);
      start = d.toISOString().split('T')[0];
    } else if (preset === '7d') {
      const d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      start = d.toISOString().split('T')[0];
    } else if (preset === '30d') {
      const d = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      start = d.toISOString().split('T')[0];
    }

    if (preset !== 'all') {
      end = now.toISOString().split('T')[0];
    }

    onChange(start, end);
    setIsOpen(false);
  };

  const getLabel = () => {
    if (activePreset === 'all' && !startDate && !endDate) return 'All time';
    if (activePreset === 'today') return 'Today';
    if (activePreset === '24h') return 'Last 24h';
    if (activePreset === '7d') return 'Last 7 days';
    if (activePreset === '30d') return 'Last 30 days';
    if (startDate || endDate) return `${startDate || '...'} to ${endDate || '...'}`;
    return 'Time range';
  };

  return (
    <div className="relative flex flex-col w-36" ref={containerRef}>
      <span className="text-[11px] text-zinc-400 font-medium mb-1">Time range</span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-zinc-900 border text-xs transition ${
          isOpen ? 'border-zinc-700' : startDate || endDate ? 'border-zinc-700 text-zinc-200' : 'border-zinc-800 text-zinc-400'
        }`}
      >
        <span className="truncate">{getLabel()}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-500 transition-transform ml-1 shrink-0 ${
            isOpen ? 'rotate-180 text-zinc-300' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-[100%] mt-1 right-0 sm:left-0 w-60 z-50 rounded-md bg-zinc-950 border border-zinc-800 shadow-xl p-3 text-xs space-y-2.5">
          <div className="grid grid-cols-2 gap-1">
            {[
              { id: 'all', label: 'All time' },
              { id: 'today', label: 'Today' },
              { id: '24h', label: 'Last 24h' },
              { id: '7d', label: 'Last 7d' },
              { id: '30d', label: 'Last 30d' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id as any)}
                className={`px-2 py-1 rounded text-xs transition text-left ${
                  activePreset === p.id && !startDate && p.id === 'all'
                    ? 'bg-zinc-800 text-white font-medium'
                    : activePreset === p.id && startDate
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="border-t border-zinc-850 pt-2 space-y-1.5">
            <div className="text-[10px] text-zinc-500 font-mono">Custom range</div>
            <div className="flex items-center space-x-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setActivePreset('custom');
                  onChange(e.target.value, endDate);
                }}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-200 focus:outline-none font-mono"
              />
              <span className="text-zinc-600">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setActivePreset('custom');
                  onChange(startDate, e.target.value);
                }}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-200 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Distinct Origin & Caller Badges (OAuth AI / API Key / Internal Agent / Direct)
const renderCallerBadge = (log: AuditLog) => {
  const summary = log.inputSummary || {};
  const authType = summary.authType;
  const callerName = summary.callerName;
  const source = summary.source || summary.clientSource;

  // 1. Claude OAuth
  if (source === 'claude_oauth' || callerName?.toLowerCase().includes('claude')) {
    return (
      <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800/60 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
        <span>Claude (OAuth)</span>
      </span>
    );
  }

  // 2. ChatGPT OAuth
  if (source === 'chatgpt_oauth' || callerName?.toLowerCase().includes('chatgpt') || callerName?.toLowerCase().includes('openai')) {
    return (
      <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        <span>ChatGPT (OAuth)</span>
      </span>
    );
  }

  // 3. Generic OAuth AI Client
  if (authType === 'oauth' || source === 'oauth_client' || summary.clientId) {
    return (
      <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-800/60">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
        <span>{callerName || 'OAuth Client'}</span>
      </span>
    );
  }

  // 4. API Key (external developer / curl / script)
  if (summary.apiKeyName || summary.keyName || summary.apiKeyPrefix || authType === 'api_key') {
    return (
      <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/50">
        <span>🔑</span>
        <span className="truncate max-w-[110px]">{summary.apiKeyName || summary.keyName || 'API Key'}</span>
      </span>
    );
  }

  // 5. Dashboard Chat Agent
  if (source === 'vynn_chat_agent' || authType === 'dashboard_chat' || source === 'dashboard_chat_agent') {
    return (
      <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-950/50 text-cf-orange border border-orange-800/60">
        <span>🤖</span>
        <span>VYNN Agent</span>
      </span>
    );
  }

  // 6. Direct Dashboard Session
  return (
    <span className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
      Direct Session
    </span>
  );
};

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
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Reference data for filter dropdowns
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [servers, setServers] = useState<McpServer[]>([]);

  const isAdmin = user?.role === 'admin';

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

  useEffect(() => {
    fetchLogs(currentPage);
  }, [currentPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchLogs(1);
    }, filterSearch ? 300 : 0);
    return () => clearTimeout(timer);
  }, [filterUserId, filterServerId, filterStatus, filterStartDate, filterEndDate, filterSearch]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingEnd = Math.min(currentPage * pageSize, total);

  const hasActiveFilters = Boolean(
    filterUserId || filterServerId || filterStatus || filterSearch || filterStartDate || filterEndDate
  );

  const activeFilterCount =
    (filterUserId ? 1 : 0) +
    (filterServerId ? 1 : 0) +
    (filterStatus ? 1 : 0) +
    (filterStartDate ? 1 : 0) +
    (filterEndDate ? 1 : 0) +
    (filterSearch ? 1 : 0);

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
    <div className="space-y-3 sm:space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-3 border-b border-zinc-850">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base sm:text-lg font-semibold text-white tracking-tight">Audit Log</h1>
            <span className="text-[10px] sm:text-xs font-mono px-1.5 sm:px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              {total} events
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
            Immutable log of all tool invocations, durations, and authorization outcomes.
          </p>
        </div>

        <button
          onClick={() => fetchLogs(currentPage)}
          disabled={loading}
          className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition flex items-center space-x-1.5 text-xs font-medium self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cf-orange' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-2.5 sm:p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
        {/* Mobile Top Controls: Search + Filter Toggle */}
        <div className="flex sm:hidden items-center space-x-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search tool or error..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full px-2.5 py-1.5 pl-7 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono"
            />
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2 top-2 pointer-events-none" />
          </div>
          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition flex items-center space-x-1.5 shrink-0 ${
              showMobileFilters || activeFilterCount > 0
                ? 'bg-zinc-800 border-zinc-700 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
          >
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-cf-orange text-white text-[10px] font-mono flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-md"
              title="Reset"
            >
              <X className="w-3.5 h-3.5 text-cf-orange" />
            </button>
          )}
        </div>

        {/* Filters Dropdown / Row (Always visible on desktop, toggleable on mobile) */}
        <div className={`${showMobileFilters ? 'flex' : 'hidden'} sm:flex flex-wrap items-end gap-2.5 sm:gap-3 mt-2 sm:mt-0`}>
          {/* User Filter (admin only) */}
          {isAdmin && (
            <MinimalSelect
              label="Actor"
              value={filterUserId}
              options={[{ value: '', label: 'All users' }, ...members.map((m) => ({ value: m.id, label: m.name, sublabel: m.email }))]}
              onChange={setFilterUserId}
              widthClass="w-full sm:w-36"
            />
          )}

          {/* Upstream Server Filter */}
          <MinimalSelect
            label="Server"
            value={filterServerId}
            options={[{ value: '', label: 'All servers' }, ...servers.map((s) => ({ value: s.id, label: s.name, sublabel: s.slug }))]}
            onChange={setFilterServerId}
            widthClass="w-full sm:w-36"
          />

          {/* Status Filter */}
          <MinimalSelect
            label="Result"
            value={filterStatus}
            options={[
              { value: '', label: 'All results' },
              { value: 'true', label: 'Success only' },
              { value: 'false', label: 'Failures only' },
            ]}
            onChange={(val) => setFilterStatus(val as '' | 'true' | 'false')}
            widthClass="w-full sm:w-32"
          />

          {/* Date Range */}
          <MinimalDateFilter
            startDate={filterStartDate}
            endDate={filterEndDate}
            onChange={(start, end) => {
              setFilterStartDate(start);
              setFilterEndDate(end);
            }}
          />

          {/* Search Box (Desktop) */}
          <div className="hidden sm:flex flex-col flex-1 min-w-[12rem]">
            <span className="text-[11px] text-zinc-400 font-medium mb-1">Search</span>
            <div className="relative">
              <input
                type="text"
                placeholder="Tool name or error..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full px-2.5 py-1.5 pl-7 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono"
              />
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2 top-2 pointer-events-none" />
            </div>
          </div>

          {/* Clear Filters (Desktop) */}
          {hasActiveFilters && (
            <div className="hidden sm:block pb-0.5">
              <button
                type="button"
                onClick={clearFilters}
                className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-md border border-zinc-800 transition flex items-center space-x-1"
                title="Reset filters"
              >
                <X className="w-3 h-3 text-cf-orange" />
                <span>Reset</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Table Container */}
      <div className="border border-zinc-800 bg-zinc-950 rounded-lg overflow-hidden">
        <div className="px-3 sm:px-4 py-2 border-b border-zinc-800 flex items-center justify-between text-[10px] sm:text-[11px] text-zinc-500 font-mono">
          <span>{total} total records</span>
          <span>Showing {showingStart}–{showingEnd}</span>
        </div>

        {/* 1. Desktop Table View (Hidden on mobile) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-900/50 text-zinc-400 font-mono text-[11px] border-b border-zinc-800">
              <tr>
                <th className="w-8 px-3 py-2.5"></th>
                <th className="px-3 py-2.5 font-medium">Timestamp</th>
                <th className="px-3 py-2.5 font-medium">Actor</th>
                <th className="px-3 py-2.5 font-medium">Tool</th>
                <th className="px-3 py-2.5 font-medium">Server</th>
                <th className="px-3 py-2.5 font-medium">Result</th>
                <th className="px-3 py-2.5 font-medium text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500 font-mono text-xs">
                    Loading audit records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500 text-xs font-mono">
                    No audit records match the selected filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => toggleExpand(log.id)}
                        className="hover:bg-zinc-900/30 cursor-pointer transition-colors select-none"
                      >
                        <td className="px-3 py-2.5 text-zinc-500">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-300" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono text-zinc-400">
                          {new Date(log.calledAt).toLocaleTimeString()}
                          <span className="text-[10px] text-zinc-600 ml-1.5">
                            {new Date(log.calledAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {log.user ? (
                            <div className="flex flex-col space-y-1">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-medium text-white">{log.user.name}</span>
                                <span
                                  className={`text-[9px] font-mono px-1 rounded uppercase tracking-wider ${
                                    log.user?.role === 'admin'
                                      ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                                      : 'bg-zinc-900 text-zinc-500 border border-zinc-850'
                                  }`}
                                >
                                  {log.user?.role || 'member'}
                                </span>
                              </div>
                              <div>{renderCallerBadge(log)}</div>
                            </div>
                          ) : (
                            <div className="flex flex-col space-y-1">
                              <span className="text-zinc-500 font-mono text-[11px]">Unauthenticated</span>
                              <div>{renderCallerBadge(log)}</div>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs font-mono text-zinc-200">
                          {log.toolName}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs text-zinc-400">
                          {log.server?.name || (log.serverId ? 'Internal' : '—')}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center space-x-1.5 text-xs">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                log.success ? 'bg-emerald-400' : 'bg-rose-500'
                              }`}
                            />
                            <span className={log.success ? 'text-zinc-300' : 'text-rose-400'}>
                              {log.success ? 'Success' : 'Failed'}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-right text-xs font-mono text-zinc-400">
                          {log.durationMs}ms
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-black">
                          <td colSpan={7} className="px-6 py-4 border-y border-zinc-850">
                            <div className="space-y-3">
                              {/* Metadata Strip */}
                              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-zinc-400 pb-2 border-b border-zinc-900">
                                <span>Log ID: <span className="text-zinc-200">{log.id}</span></span>
                                <span>·</span>
                                <span>User: <span className="text-zinc-200">{log.user?.email || 'N/A'}</span> <span className="text-zinc-500">({log.user?.role || 'unauth'})</span></span>
                                <span>·</span>
                                <span>Origin: <span className="text-zinc-200">{log.inputSummary?.callerName || (log.inputSummary?.apiKeyName ? `API Key: ${log.inputSummary.apiKeyName}` : log.inputSummary?.source || 'Dashboard')}</span></span>
                                {log.inputSummary?.oauthScope && (
                                  <>
                                    <span>·</span>
                                    <span>Scope: <span className="text-zinc-200">{log.inputSummary.oauthScope}</span></span>
                                  </>
                                )}
                                <span>·</span>
                                <span>Duration: <span className="text-zinc-200">{log.durationMs}ms</span></span>
                                {log.inputSummary?.apiKeyPrefix && (
                                  <>
                                    <span>·</span>
                                    <span>Key: <span className="text-zinc-200">{log.inputSummary.apiKeyPrefix}••••</span></span>
                                  </>
                                )}
                              </div>

                              {log.errorMsg && (
                                <div className="p-2.5 bg-rose-950/20 border border-rose-900/40 rounded text-rose-300 text-xs font-mono">
                                  {log.errorMsg}
                                </div>
                              )}

                              {/* 2-Column Split: Input vs Output */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                <div>
                                  <div className="text-[10px] font-mono text-zinc-500 mb-1">Input Parameters</div>
                                  <pre className="p-2.5 bg-zinc-950 rounded text-xs font-mono text-zinc-300 overflow-x-auto border border-zinc-850 max-h-56">
                                    {JSON.stringify(log.inputSummary?.parameters || log.inputSummary, null, 2)}
                                  </pre>
                                </div>

                                <div>
                                  <div className="text-[10px] font-mono text-zinc-500 mb-1">Response Output</div>
                                  <pre className="p-2.5 bg-zinc-950 rounded text-xs font-mono text-zinc-300 overflow-x-auto border border-zinc-850 max-h-56">
                                    {log.inputSummary?.response !== undefined
                                      ? JSON.stringify(log.inputSummary.response, null, 2)
                                      : log.success
                                      ? JSON.stringify({ status: 'Success' }, null, 2)
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

        {/* 2. Mobile Card List View (Visible on phone) */}
        <div className="block sm:hidden divide-y divide-zinc-850">
          {loading ? (
            <div className="p-8 text-center text-zinc-500 font-mono text-xs">
              Loading audit records...
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs font-mono">
              No audit records match the selected filters.
            </div>
          ) : (
            logs.map((log) => {
              const isExpanded = expandedId === log.id;
              return (
                <div key={log.id} className="p-3 hover:bg-zinc-900/30 transition">
                  <div
                    className="flex items-start justify-between cursor-pointer select-none"
                    onClick={() => toggleExpand(log.id)}
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            log.success ? 'bg-emerald-400' : 'bg-rose-500'
                          }`}
                        />
                        <span className="font-mono text-xs font-semibold text-white truncate">
                          {log.toolName}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400 font-mono">
                        <span className="text-zinc-300 font-sans font-medium">{log.user?.name || 'Unauth'}</span>
                        <span className="text-zinc-600">·</span>
                        {renderCallerBadge(log)}
                        <span className="text-zinc-600">·</span>
                        <span className="text-zinc-500">{log.durationMs}ms</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-mono text-zinc-500">
                        {new Date(log.calledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <span
                        className={`inline-block mt-0.5 text-[10px] font-mono px-1 py-0.2 rounded ${
                          log.success ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {log.success ? '200' : 'ERR'}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2.5 pt-2 border-t border-zinc-900 text-xs font-mono space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                        <span>ID: {log.id.slice(0, 8)}</span>
                        <span>·</span>
                        <span>{new Date(log.calledAt).toLocaleString()}</span>
                      </div>

                      {log.errorMsg && (
                        <div className="p-2 bg-rose-950/20 border border-rose-900/40 rounded text-rose-300 text-[11px] break-all">
                          {log.errorMsg}
                        </div>
                      )}

                      <div>
                        <div className="text-[10px] text-zinc-500 mb-0.5">Parameters</div>
                        <pre className="p-2 bg-black rounded text-[10px] text-zinc-300 overflow-x-auto border border-zinc-900 max-h-36">
                          {JSON.stringify(log.inputSummary?.parameters || log.inputSummary, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <div className="text-[10px] text-zinc-500 mb-0.5">Response</div>
                        <pre className="p-2 bg-black rounded text-[10px] text-zinc-300 overflow-x-auto border border-zinc-900 max-h-36">
                          {log.inputSummary?.response !== undefined
                            ? JSON.stringify(log.inputSummary.response, null, 2)
                            : log.success
                            ? JSON.stringify({ status: 'Success' }, null, 2)
                            : JSON.stringify({ status: 'Failed', error: log.errorMsg }, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-zinc-900/30 border-t border-zinc-800 flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-500 text-[11px]">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center space-x-1 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center space-x-1 text-xs"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
