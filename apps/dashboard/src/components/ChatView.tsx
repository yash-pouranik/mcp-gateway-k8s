import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api, ActivityItem, ChatSessionSummary, AiProviderInfo } from '../api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  User,
  Sparkles,
  Trash2,
  Loader2,
  ArrowRight,
  X,
  ZoomIn,
  ChevronRight,
  Check,
  AlertCircle,
  Square,
  History,
  MessageSquare,
  Plus,
  Cpu,
  ChevronUp,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  activities?: ActivityItem[];
  isStreaming?: boolean;
  totalDurationMs?: number;
  provider?: string;
  model?: string;
}

function cleanMessageContent(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('{"content":') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed.content)) {
        const textBlocks: string[] = [];
        for (const block of parsed.content) {
          if (block.type === 'text' && typeof block.text === 'string') {
            textBlocks.push(block.text);
          }
        }
        if (textBlocks.length > 0) {
          const combined = textBlocks.join('\n\n');
          try {
            const innerJson = JSON.parse(combined);
            if (Array.isArray(innerJson)) {
              return `### Retrieved ${innerJson.length} item(s):\n\n` +
                innerJson.slice(0, 10).map((item: any) => {
                  const title = item.name || item.title || `Item #${item.id || ''}`;
                  const rawPrice = item.price !== undefined && item.price !== '' ? item.price : item.regular_price;
                  const priceStr = (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') ? ` — Price: ${rawPrice}` : '';
                  const statusStr = item.status ? ` (Status: ${item.status})` : '';
                  return `- **#${item.id || ''} ${title}**${priceStr}${statusStr}`;
                }).join('\n') +
                (innerJson.length > 10 ? `\n\n*...and ${innerJson.length - 10} more items.*` : '');
            }
          } catch (_) {
            return combined;
          }
          return combined;
        }
      }
    } catch (_) {
      // not JSON envelope, return as-is
    }
  }
  return raw;
}

function generateActivitySummary(activities: ActivityItem[], totalDurationMs?: number): string {
  if (!activities || activities.length === 0) return 'Completed';

  const toolCalls = activities.filter((a) => a.type === 'tool_call');
  const durationSec = totalDurationMs
    ? (totalDurationMs / 1000).toFixed(1)
    : (() => {
        const first = activities[0]?.startTime || 0;
        const last = activities[activities.length - 1]?.endTime || Date.now();
        const diff = Math.max(0.1, (last - first) / 1000);
        return diff.toFixed(1);
      })();

  if (toolCalls.length === 0) {
    return `Explored tools · ${durationSec}s`;
  }

  const serverNames = Array.from(new Set(toolCalls.map((t) => t.server).filter(Boolean)));
  const failedCount = toolCalls.filter((t) => t.status === 'failed').length;

  let toolText = '';
  if (toolCalls.length === 1) {
    const clean = (toolCalls[0].cleanTool || toolCalls[0].toolName || 'tool').replace(/_/g, ' ');
    toolText = `ran ${clean}`;
  } else {
    toolText = `ran ${toolCalls.length} tools`;
    if (serverNames.length > 0) {
      toolText += ` (${serverNames.join(', ')})`;
    }
  }

  if (failedCount > 0) {
    toolText += ` (${failedCount} failed)`;
  }

  return `Explored tools, ${toolText} · ${durationSec}s`;
}

const ExecutionTimeline: React.FC<{
  activities: ActivityItem[];
  isStreaming: boolean;
  totalDurationMs?: number;
}> = ({ activities, isStreaming, totalDurationMs }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!activities || activities.length === 0) {
    if (isStreaming) {
      return (
        <div className="flex items-center space-x-2 text-xs text-zinc-400 font-mono py-1">
          <Loader2 className="w-3.5 h-3.5 text-cf-orange animate-spin" />
          <span>Connecting to MCP Gateway & analyzing request...</span>
        </div>
      );
    }
    return null;
  }

  const summary = generateActivitySummary(activities, totalDurationMs);
  const showFullTimeline = isStreaming || isExpanded;

  return (
    <div className="mb-3 font-sans">
      {!isStreaming && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#252525] hover:bg-[#2c2c2c] border border-[#363636] text-xs text-zinc-300 transition group"
          title="Click to view execution details"
        >
          <ChevronRight
            className={`w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
          <span className="font-sans font-medium text-zinc-300">{summary}</span>
          <span className="text-[10px] text-zinc-500 font-mono pl-1">
            {isExpanded ? 'Hide' : 'Details'}
          </span>
        </button>
      )}

      {showFullTimeline && (
        <div className="mt-2 rounded-xl bg-[#222222] border border-[#333333] p-3 text-xs space-y-2.5 transition-all shadow-inner">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 border-b border-[#2e2e2e] pb-1.5 mb-1.5">
            <span className="flex items-center space-x-1.5">
              <img src="/vynn_ai_logo.png" alt="VYNN" className="w-3.5 h-3.5 object-contain" />
              <span>VYNN Execution Activity</span>
            </span>
            {isStreaming ? (
              <span className="flex items-center space-x-1 text-cf-orange">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Running...</span>
              </span>
            ) : (
              <span className="text-zinc-500">{summary}</span>
            )}
          </div>

          <div className="space-y-2">
            {activities.map((act) => {
              const isTool = act.type === 'tool_call';
              return (
                <div key={act.id} className="flex items-start space-x-2.5">
                  <div className="mt-0.5 flex-shrink-0">
                    {act.status === 'running' && (
                      <Loader2 className="w-3.5 h-3.5 text-cf-orange animate-spin" />
                    )}
                    {act.status === 'completed' && (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    {act.status === 'failed' && (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-1.5 truncate">
                        {isTool && act.server && (
                          <span className="px-1.5 py-0.5 rounded bg-[#2e2e2e] border border-[#3e3e3e] text-[10px] font-mono uppercase text-zinc-400 tracking-wider">
                            {act.server}
                          </span>
                        )}
                        <span className={`text-[12.5px] ${isTool ? 'font-mono text-zinc-200' : 'font-sans text-zinc-300'}`}>
                          {act.title || act.cleanTool || act.toolName}
                        </span>
                      </div>
                      {act.durationMs !== undefined && (
                        <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0">
                          {act.durationMs}ms
                        </span>
                      )}
                    </div>

                    {isTool && (
                      <div className="mt-1 pl-1 space-y-0.5 text-[11px] font-mono">
                        {act.inputSummary && Object.keys(act.inputSummary).length > 0 && (
                          <div className="text-zinc-500 truncate">
                            params: {JSON.stringify(act.inputSummary)}
                          </div>
                        )}
                        {act.outputSummary && (
                          <div className="text-emerald-400/90 truncate">
                            result: {act.outputSummary}
                          </div>
                        )}
                        {act.error && (
                          <div className="text-rose-400 truncate">
                            error: {act.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const ChatView: React.FC = () => {
  const initialWelcome: ChatMessage = {
    id: 'welcome',
    role: 'assistant',
    content:
      'Welcome! I am **VYNN**, your autonomous AI assistant connected directly to the **MCP Gateway**. I can execute tools across WooCommerce, FakeStore, and Team Notes. What would you like to inspect or manage?',
    timestamp: new Date(),
  };

  const [messages, setMessages] = useState<ChatMessage[]>([initialWelcome]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Persistence & Sessions
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Multi-Provider AI
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('auto');
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const providerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(e.target as Node)) {
        setProviderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load chat sessions & available providers on mount
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const data = await api.getChatSessions();
      setSessions(data.sessions || []);
    } catch (_) {
      // non-fatal
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    const loadProviders = async () => {
      try {
        const data = await api.getAiProviders();
        setProviders(data.providers || []);
      } catch (_) {}
    };
    loadProviders();
  }, [loadSessions]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  };

  const handleNewChat = () => {
    handleStop();
    setCurrentSessionId(null);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content:
          'New conversation started. Ask me to manage products, check orders, create notes, or answer questions.',
        timestamp: new Date(),
      },
    ]);
  };

  const handleSelectSession = async (session: ChatSessionSummary) => {
    if (loading) return;
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
    try {
      setLoading(true);
      const data = await api.getChatSession(session.id);
      setCurrentSessionId(session.id);

      if (data.session && data.session.messages.length > 0) {
        const restored: ChatMessage[] = data.session.messages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.createdAt),
          activities: Array.isArray(m.activities) ? m.activities : undefined,
          provider: m.provider || undefined,
          model: m.model || undefined,
        }));
        setMessages(restored);
      } else {
        setMessages([initialWelcome]);
      }
    } catch (err: any) {
      alert(`Failed to load chat history: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, session: ChatSessionSummary) => {
    e.stopPropagation();
    setSessionToDelete({ id: session.id, title: session.title });
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete || isDeleting) return;
    try {
      setIsDeleting(true);
      await api.deleteChatSession(sessionToDelete.id);
      setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id));
      if (currentSessionId === sessionToDelete.id) {
        handleNewChat();
      }
      setSessionToDelete(null);
    } catch (err: any) {
      console.error('Delete session error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      activities: [],
      isStreaming: true,
      provider: selectedProvider,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const payload = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      await api.streamChatMessage(
        payload,
        (event, data) => {
          if (event === 'session_info' && data.sessionId) {
            setCurrentSessionId(data.sessionId);
          }

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== assistantMsgId) return msg;

              const activities = [...(msg.activities || [])];

              if (event === 'activity_started') {
                activities.push({
                  id: data.id,
                  type: data.type,
                  title: data.label,
                  status: 'running',
                  startTime: data.timestamp || Date.now(),
                });
              } else if (event === 'activity_updated') {
                const act = activities.find((a) => a.id === data.id);
                if (act) {
                  act.status = data.status || 'completed';
                  if (data.label) act.title = data.label;
                  if (data.durationMs !== undefined) act.durationMs = data.durationMs;
                  if (data.error) act.error = data.error;
                  act.endTime = Date.now();
                }
              } else if (event === 'tool_call_started') {
                activities.push({
                  id: data.id,
                  type: 'tool_call',
                  title: `Calling ${data.cleanTool || data.tool}`,
                  status: 'running',
                  toolName: data.tool,
                  cleanTool: data.cleanTool,
                  server: data.server,
                  inputSummary: data.inputSummary,
                  startTime: data.timestamp || Date.now(),
                });
              } else if (event === 'tool_call_completed') {
                const act = activities.find((a) => a.id === data.id);
                if (act) {
                  act.status = 'completed';
                  act.durationMs = data.durationMs;
                  act.outputSummary = data.summary;
                  act.endTime = Date.now();
                }
              } else if (event === 'tool_call_failed') {
                const act = activities.find((a) => a.id === data.id);
                if (act) {
                  act.status = 'failed';
                  act.durationMs = data.durationMs;
                  act.error = data.error;
                  act.endTime = Date.now();
                }
              } else if (event === 'assistant_response_chunk') {
                return {
                  ...msg,
                  content: (msg.content || '') + (data.delta || ''),
                  activities,
                };
              } else if (event === 'assistant_response_completed') {
                return {
                  ...msg,
                  content: data.content || msg.content,
                  isStreaming: false,
                  totalDurationMs: data.totalDurationMs,
                  provider: data.provider || msg.provider,
                  model: data.model,
                  activities,
                };
              } else if (event === 'execution_failed') {
                return {
                  ...msg,
                  content: msg.content ? `${msg.content}\n\n**Error:** ${data.error}` : `**Agent Error:** ${data.error}`,
                  isStreaming: false,
                  activities,
                };
              } else if (event === 'execution_cancelled') {
                return {
                  ...msg,
                  isStreaming: false,
                  activities,
                };
              }

              return { ...msg, activities };
            })
          );
        },
        controller.signal,
        {
          sessionId: currentSessionId,
          provider: selectedProvider !== 'auto' ? selectedProvider : undefined,
        }
      );

      // Refresh session sidebar list on completion
      loadSessions();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: msg.content || `**Agent Error:** ${err.message || 'Failed to reach AI agent'}`,
                  isStreaming: false,
                }
              : msg
          )
        );
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg
        )
      );
    }
  };

  const samplePrompts = [
    { title: 'List Products', prompt: 'List products currently available in the WooCommerce store.' },
    { title: 'Create Product', prompt: 'Create a t-shirt product in WooCommerce for $25.' },
    { title: 'Check Orders', prompt: 'What orders came in today in WooCommerce?' },
    { title: 'Create Note', prompt: 'Create a note titled "Sprint Planning" with content "Review MCP Gateway k8s architecture".' },
  ];

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  return (
    <div className="flex h-full w-full bg-[#1e1e1e] overflow-hidden relative">
      {/* ------------------------------------------------------------- */}
      {/* 1. Left Chat History Sidebar (Collapsible Drawer on Mobile)  */}
      {/* ------------------------------------------------------------- */}
      {sidebarOpen && (
        <>
          {/* Mobile Backdrop */}
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 md:relative md:w-64 lg:w-72 md:z-auto bg-[#171717] border-r border-[#2d2d2d] flex flex-col flex-shrink-0 shadow-2xl md:shadow-none animate-in slide-in-from-left-4 duration-150">
            <div className="p-3.5 border-b border-[#2d2d2d] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-cf-orange" />
                <span className="text-xs font-semibold text-white tracking-tight">Chat History</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
                title="Close History Sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-[#242424] hover:bg-[#2b2b2b] border border-[#353535] hover:border-cf-orange/40 text-white rounded-xl text-xs font-medium transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-cf-orange" />
                <span>New Conversation</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
              {sessionsLoading ? (
                <div className="text-center py-8 text-zinc-500 font-mono text-xs">
                  <Loader2 className="w-4 h-4 text-cf-orange animate-spin mx-auto mb-1.5" />
                  <span>Loading sessions...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs font-sans px-4">
                  No saved chats yet. Start chatting with VYNN to save session history.
                </div>
              ) : (
                sessions.map((sess) => {
                  const isActive = currentSessionId === sess.id;
                  return (
                    <div
                      key={sess.id}
                      onClick={() => handleSelectSession(sess)}
                      className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition text-xs ${
                        isActive
                          ? 'bg-[#262626] border border-cf-orange/50 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-white hover:bg-[#202020] border border-transparent'
                      }`}
                    >
                      <div className="flex items-start space-x-2 min-w-0 pr-2">
                        <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isActive ? 'text-cf-orange' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                        <div className="min-w-0 truncate">
                          <div className="truncate font-medium">{sess.title}</div>
                          <div className="text-[10px] text-zinc-500 font-mono flex items-center space-x-1.5 mt-0.5">
                            <span>{new Date(sess.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            {sess.totalTokens > 0 && <span>· {sess.totalTokens} tokens</span>}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, sess)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-2.5 border-t border-[#2d2d2d] bg-[#141414] text-[10px] sm:text-[11px] font-mono text-zinc-500 text-center">
              {sessions.length} conversation{sessions.length === 1 ? '' : 's'} stored
            </div>
          </aside>
        </>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. Main Conversation Panel                                   */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Studio Bar */}
        <div className="px-3 sm:px-5 py-2 sm:py-2.5 bg-[#252525] border-b border-[#333333] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-1.5 rounded-lg border transition flex items-center space-x-1.5 text-xs font-medium ${
                sidebarOpen
                  ? 'bg-cf-orange/15 border-cf-orange/40 text-cf-orange'
                  : 'bg-[#2c2c2c] hover:bg-[#333333] border-[#3d3d3d] text-zinc-300 hover:text-white'
              }`}
              title="Toggle Chat History Sidebar"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">History</span>
            </button>

            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#272727] border border-cf-orange/30 flex items-center justify-center p-1 shadow-sm shrink-0">
              <img src="/vynn_ai_logo.png" alt="VYNN Logo" className="w-full h-full object-contain drop-shadow" />
            </div>

            <div>
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="text-xs font-semibold text-white tracking-tight">VYNN Studio</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[10px] font-mono text-zinc-400 hidden sm:inline">Autonomous Tool Loop Active</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <button
              onClick={handleNewChat}
              className="px-2 sm:px-2.5 py-1 text-zinc-400 hover:text-white hover:bg-[#303030] border border-transparent hover:border-[#404040] rounded-md transition text-xs flex items-center space-x-1 font-medium"
              title="New Chat / Reset Conversation"
            >
              <Plus className="w-3.5 h-3.5 text-cf-orange" />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Centered Conversation Area (Claude-style Charcoal Canvas) */}
        <div className="flex-1 overflow-y-auto px-4 py-8 scroll-smooth">
          <div className="max-w-[820px] mx-auto space-y-7">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div key={m.id} className="group relative flex space-x-4">
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium overflow-hidden ${
                      isUser
                        ? 'bg-[#333333] text-zinc-200 border border-[#444444]'
                        : 'bg-[#252525] border border-cf-orange/35 p-1 shadow-sm'
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <img src="/vynn_ai_logo.png" alt="VYNN" className="w-full h-full object-contain drop-shadow" />}
                  </div>

                  <div className="flex-1 space-y-1.5 overflow-hidden pt-0.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium text-zinc-300">
                          {isUser ? 'You' : 'VYNN'}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">
                          {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {m.provider && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60 uppercase">
                            {m.provider}
                          </span>
                        )}
                      </div>

                      {!isUser && m.content && (
                        <button
                          onClick={() => handleCopy(m.content, m.id)}
                          className="opacity-0 group-hover:opacity-100 transition p-1 text-zinc-400 hover:text-zinc-200 hover:bg-[#2d2d2d] rounded text-[11px] flex items-center space-x-1"
                          title="Copy Response"
                        >
                          <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>

                    {isUser ? (
                      <div className="text-[15px] text-[#f0f0f0] whitespace-pre-wrap leading-[1.65] font-sans">
                        {m.content}
                      </div>
                    ) : (
                      <div>
                        {m.activities && m.activities.length > 0 && (
                          <ExecutionTimeline
                            activities={m.activities}
                            isStreaming={!!m.isStreaming}
                            totalDurationMs={m.totalDurationMs}
                          />
                        )}

                        {m.content && (
                          <div className="prose prose-invert prose-base max-w-none text-[#d4d4d4] leading-[1.7] font-sans">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({ ...props }) => <h1 className="text-lg font-semibold text-[#f5f5f5] mb-2.5 mt-5" {...props} />,
                                h2: ({ ...props }) => <h2 className="text-base font-semibold text-[#f5f5f5] mb-2 mt-4" {...props} />,
                                h3: ({ ...props }) => <h3 className="text-sm font-semibold text-cf-orange mb-1.5 mt-3" {...props} />,
                                p: ({ ...props }) => <p className="mb-3 leading-[1.7] text-[15px] text-[#d6d6d6]" {...props} />,
                                ul: ({ ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-[15px] text-[#d6d6d6]" {...props} />,
                                ol: ({ ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-[15px] text-[#d6d6d6]" {...props} />,
                                li: ({ ...props }) => <li className="leading-[1.65]" {...props} />,
                                strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
                                a: ({ ...props }) => (
                                  <a
                                    className="text-cf-orange hover:text-amber-400 underline font-medium underline-offset-2"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    {...props}
                                  />
                                ),
                                table: ({ ...props }) => (
                                  <div className="my-4 overflow-x-auto rounded-xl border border-[#333333] bg-[#1a1a1a] shadow-lg">
                                    <table className="w-full text-left text-sm text-zinc-200 border-collapse" {...props} />
                                  </div>
                                ),
                                thead: ({ ...props }) => (
                                  <thead className="bg-[#262626] border-b border-[#383838] text-[12px] font-mono uppercase tracking-wider text-zinc-400" {...props} />
                                ),
                                tbody: ({ ...props }) => (
                                  <tbody className="divide-y divide-[#2a2a2a]" {...props} />
                                ),
                                tr: ({ ...props }) => (
                                  <tr className="hover:bg-[#222222] transition-colors" {...props} />
                                ),
                                th: ({ ...props }) => (
                                  <th className="px-4 py-3 font-semibold text-zinc-300" {...props} />
                                ),
                                td: ({ children, ...props }) => {
                                  // Special styling for In Stock / Out of Stock status
                                  const textVal = String(children || '').trim();
                                  if (textVal === 'In Stock') {
                                    return (
                                      <td className="px-4 py-3 text-zinc-300" {...props}>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950/70 border border-emerald-500/30 text-emerald-400">
                                          ● In Stock
                                        </span>
                                      </td>
                                    );
                                  }
                                  if (textVal === 'Out of Stock') {
                                    return (
                                      <td className="px-4 py-3 text-zinc-300" {...props}>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-950/70 border border-rose-500/30 text-rose-400">
                                          ● Out of Stock
                                        </span>
                                      </td>
                                    );
                                  }
                                  return <td className="px-4 py-3 text-zinc-300" {...props}>{children}</td>;
                                },
                                code: ({ ...props }) => (
                                  <code className="px-1.5 py-0.5 rounded bg-[#2b2b2b] border border-[#3a3a3a] text-cf-orange font-mono text-[13px]" {...props} />
                                ),
                                pre: ({ ...props }) => (
                                  <pre className="p-3.5 my-3 rounded-xl bg-[#171717] border border-[#2d2d2d] overflow-x-auto text-[13px] font-mono leading-relaxed text-zinc-300" {...props} />
                                ),
                                img: ({ src, alt }) => (
                                  <div className="my-3 inline-block group relative cursor-pointer" onClick={() => src && setPreviewImage(src)}>
                                    <div className="w-52 h-40 rounded-xl overflow-hidden bg-[#262626] border border-[#383838] flex items-center justify-center relative shadow-md group-hover:border-cf-orange/50 transition">
                                      <img
                                        src={src}
                                        alt={alt || 'Embedded image'}
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                        loading="lazy"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                        <div className="p-1.5 rounded-full bg-black/80 text-white flex items-center space-x-1.5 text-xs font-sans px-3">
                                          <ZoomIn className="w-3.5 h-3.5 text-cf-orange" />
                                          <span>Preview</span>
                                        </div>
                                      </div>
                                    </div>
                                    {alt && <div className="text-xs text-zinc-400 mt-1.5 truncate max-w-[13rem]">{alt}</div>}
                                  </div>
                                ),
                              }}
                            >
                              {cleanMessageContent(m.content)}
                            </ReactMarkdown>
                          </div>
                        )}

                        {m.isStreaming && !m.content && (!m.activities || m.activities.length === 0) && (
                          <div className="flex items-center space-x-2 text-xs text-zinc-400 font-mono py-1">
                            <img src="/vynn_ai_logo.png" alt="VYNN" className="w-4 h-4 object-contain animate-pulse" />
                            <span>Thinking & resolving tool calls...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 3. Floating Bottom Claude Composer Dock with Provider Routing */}
        {/* ------------------------------------------------------------- */}
        <div className="p-2 sm:p-4 bg-gradient-to-t from-[#1e1e1e] via-[#1e1e1e]/95 to-transparent flex-shrink-0">
          <div className="max-w-[820px] mx-auto space-y-2 sm:space-y-3">
            {messages.length <= 2 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <div className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center space-x-1 shrink-0 mr-1">
                  <Sparkles className="w-3 h-3 text-cf-orange" />
                  <span className="hidden sm:inline">Suggestions:</span>
                </div>
                {samplePrompts.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(p.prompt)}
                    className="px-2.5 py-1 rounded-full bg-[#2b2b2b] hover:bg-[#333333] border border-[#3d3d3d] text-[11px] sm:text-xs text-zinc-300 hover:text-white transition flex items-center space-x-1.5 shrink-0 whitespace-nowrap group"
                  >
                    <span>{p.title}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-zinc-500 group-hover:text-cf-orange transition" />
                  </button>
                ))}
              </div>
            )}

            {/* Multiline Rounded Composer */}
            <div className="relative bg-[#262626] hover:bg-[#282828] border border-[#3a3a3a] focus-within:border-cf-orange/70 rounded-xl sm:rounded-2xl shadow-xl transition-all p-2 sm:p-2.5">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                disabled={loading}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Reply to VYNN or ask to manage WooCommerce store, products, or notes..."
                className="w-full px-2 py-1 sm:px-2.5 sm:py-1.5 pr-10 sm:pr-12 bg-transparent text-[#f2f2f2] placeholder-zinc-500 text-sm sm:text-[15px] leading-relaxed resize-none focus:outline-none disabled:opacity-50 max-h-[140px] sm:max-h-[200px]"
              />

              <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 pt-1.5 sm:pt-2 px-1 border-t border-[#313131]">
                {/* Provider Selector Dock (Custom Kumo Popover) */}
                <div className="flex items-center space-x-2">
                  <div className="relative" ref={providerDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setProviderDropdownOpen(!providerDropdownOpen)}
                      className={`flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-[#1e1e1e] hover:bg-[#252525] border transition text-[10px] sm:text-[11px] font-mono ${
                        providerDropdownOpen
                          ? 'border-cf-orange/70 text-white shadow-sm'
                          : 'border-[#383838] text-zinc-300 hover:text-white'
                      }`}
                    >
                      <Cpu className="w-3 h-3 text-cf-orange flex-shrink-0" />
                      <span className="truncate max-w-[120px] sm:max-w-[200px]">
                        {selectedProvider === 'auto'
                          ? 'Auto Router'
                          : providers.find((p) => p.name === selectedProvider)?.displayName || selectedProvider}
                      </span>
                      <ChevronUp
                        className={`w-3 h-3 text-zinc-400 transition-transform duration-150 flex-shrink-0 ${
                          providerDropdownOpen ? 'rotate-180 text-cf-orange' : ''
                        }`}
                      />
                    </button>

                    {/* Floating Kumo Dropdown Menu (Opens upwards above composer) */}
                    {providerDropdownOpen && (
                      <div className="absolute bottom-[100%] mb-1.5 left-0 w-72 z-50 rounded-xl bg-[#1a1a1a] border border-zinc-700/80 shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100 font-sans">
                        <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 border-b border-zinc-800 mb-1">
                          Select AI Engine & Route
                        </div>
                        <div className="space-y-0.5">
                          {/* Auto Router Option */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProvider('auto');
                              setProviderDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition ${
                              selectedProvider === 'auto'
                                ? 'bg-cf-orange/15 text-cf-orange font-medium'
                                : 'hover:bg-zinc-800/70 text-zinc-300'
                            }`}
                          >
                            <div>
                              <div className="flex items-center space-x-1.5 font-medium">
                                <span>Auto Router</span>
                                <span className="px-1.5 py-0.2 rounded bg-cf-orange/20 text-[9px] font-mono text-cf-orange uppercase">
                                  Smart
                                </span>
                              </div>
                              <div className="text-[10px] text-zinc-500 font-sans mt-0.5">
                                Intelligently switches based on query intent & tools
                              </div>
                            </div>
                            {selectedProvider === 'auto' && <Check className="w-3.5 h-3.5 text-cf-orange flex-shrink-0" />}
                          </button>

                          {/* Dynamic / Fallback Providers */}
                          {(providers.length > 0 ? providers : [
                            { name: 'openai', displayName: 'OpenAI (GPT-6 Luna)', supportsTools: true, costTier: 'cheap' },
                            { name: 'gemini', displayName: 'Google (Gemini 3.1 Flash-Lite)', supportsTools: true, costTier: 'cheap' },
                            { name: 'groq', displayName: 'Groq (GPT-OSS 120B / Free)', supportsTools: false, costTier: 'free' },
                          ]).map((p) => {
                            const isSelected = selectedProvider === p.name;
                            return (
                              <button
                                key={p.name}
                                type="button"
                                onClick={() => {
                                  setSelectedProvider(p.name);
                                  setProviderDropdownOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition ${
                                  isSelected
                                    ? 'bg-cf-orange/15 text-cf-orange font-medium'
                                    : 'hover:bg-zinc-800/70 text-zinc-300'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center space-x-1.5 font-medium">
                                    <span>{p.displayName}</span>
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase ${
                                        p.costTier === 'free'
                                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                                      }`}
                                    >
                                      {p.supportsTools ? 'Actions' : 'Free Chat'}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-zinc-500 font-sans mt-0.5">
                                    {p.supportsTools
                                      ? 'Executes WooCommerce & team tools with precision'
                                      : 'Ultra-fast token response for Q&A and conversation'}
                                  </div>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-cf-orange flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="text-[11px] text-zinc-500 font-sans hidden sm:inline">
                    Use <kbd className="px-1 py-0.5 rounded bg-[#1e1e1e] border border-[#383838] text-[10px] text-zinc-400">Shift + Enter</kbd> for newline
                  </span>
                </div>

                {loading ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="p-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl transition shadow-sm flex items-center space-x-1.5 text-xs font-medium"
                    title="Stop generating"
                  >
                    <Square className="w-3.5 h-3.5 fill-current text-white" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={!input.trim()}
                    className="p-2 bg-cf-orange hover:bg-cf-hover active:bg-cf-dark disabled:opacity-30 disabled:hover:bg-cf-orange text-white rounded-xl transition shadow-sm"
                    title="Send message (Enter)"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="text-center">
              <span className="text-[11px] text-zinc-500">
                VYNN autonomously executes tools across connected MCP servers with user-attributed audit logging.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Image Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Enlarged preview"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Kumo Custom Delete Confirmation Modal */}
      {sessionToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !isDeleting && setSessionToDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#1e1e1e] border border-zinc-700/80 shadow-2xl p-5 text-left animate-in zoom-in-95 duration-150 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center flex-shrink-0 text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Delete Conversation?</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Are you sure you want to permanently delete this chat history?
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#171717] border border-zinc-800 text-xs text-zinc-300 font-mono truncate">
              "{sessionToDelete.title}"
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setSessionToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl bg-[#282828] hover:bg-[#303030] text-zinc-300 hover:text-white border border-zinc-700 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteSession}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-medium transition flex items-center space-x-1.5 disabled:opacity-50 shadow-md"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
