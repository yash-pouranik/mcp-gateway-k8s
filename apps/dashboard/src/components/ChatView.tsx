import React, { useState, useRef, useEffect } from 'react';
import { api, ActivityItem } from '../api';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Bot,
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
  Terminal,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  activities?: ActivityItem[];
  isStreaming?: boolean;
  totalDurationMs?: number;
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
      {/* Collapsed summary pill (when not streaming) */}
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

      {/* Expanded / Live Activity Timeline */}
      {showFullTimeline && (
        <div className="mt-2 rounded-xl bg-[#222222] border border-[#333333] p-3 text-xs space-y-2.5 transition-all shadow-inner">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 border-b border-[#2e2e2e] pb-1.5 mb-1.5">
            <span className="flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5 text-cf-orange" />
              <span>Agent Execution Activity</span>
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Welcome! I am **Urumi Agent**, connected directly to the **MCP Gateway**. I can autonomously execute tools across WooCommerce, FakeStore, and Team Notes. What would you like to inspect or manage?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
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
        controller.signal
      );
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

  const handleClear = () => {
    handleStop();
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          'Conversation reset. Ask me to list products, create inventory items, or search notes across connected MCP servers.',
        timestamp: new Date(),
      },
    ]);
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
    <div className="flex flex-col h-full w-full bg-[#1e1e1e]">
      {/* Top Studio Bar (Preserved) */}
      <div className="px-6 py-2.5 bg-[#252525] border-b border-[#333333] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="p-1 rounded-md bg-[#2d2d2d] border border-[#3d3d3d] text-cf-orange">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-zinc-200 tracking-tight">AI Agent Studio</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-[10px] font-mono text-zinc-400">Autonomous Tool Loop Active</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleClear}
          className="px-2.5 py-1 text-zinc-400 hover:text-white hover:bg-[#303030] border border-transparent hover:border-[#404040] rounded-md transition text-xs flex items-center space-x-1.5 font-medium"
          title="New Chat / Reset Conversation"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Centered Conversation Area (Claude-style Charcoal Canvas) */}
      <div className="flex-1 overflow-y-auto px-4 py-8 scroll-smooth">
        <div className="max-w-[820px] mx-auto space-y-7">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div key={m.id} className="group relative flex space-x-4">
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    isUser
                      ? 'bg-[#333333] text-zinc-200 border border-[#444444]'
                      : 'bg-[#2a241f] text-cf-orange border border-cf-orange/25'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className="flex-1 space-y-1.5 overflow-hidden pt-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-zinc-300">
                        {isUser ? 'You' : 'Urumi Agent'}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
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
                      {/* 1. Execution Activity Disclosure (Separate UI Section) */}
                      {m.activities && m.activities.length > 0 && (
                        <ExecutionTimeline
                          activities={m.activities}
                          isStreaming={!!m.isStreaming}
                          totalDurationMs={m.totalDurationMs}
                        />
                      )}

                      {/* 2. Normal Assistant Response (Fully Visible) */}
                      {m.content && (
                        <div className="prose prose-invert prose-base max-w-none text-[#d4d4d4] leading-[1.7] font-sans">
                          <ReactMarkdown
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
                            {m.content}
                          </ReactMarkdown>
                        </div>
                      )}

                      {/* Fallback spinner while awaiting initial activity */}
                      {m.isStreaming && !m.content && (!m.activities || m.activities.length === 0) && (
                        <div className="flex items-center space-x-2 text-xs text-zinc-400 font-mono py-1">
                          <Loader2 className="w-3.5 h-3.5 text-cf-orange animate-spin" />
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

      {/* Floating Bottom Claude Composer Dock */}
      <div className="p-4 bg-gradient-to-t from-[#1e1e1e] via-[#1e1e1e]/95 to-transparent flex-shrink-0">
        <div className="max-w-[820px] mx-auto space-y-3">
          {/* Quick prompt suggestions when conversation is fresh */}
          {messages.length <= 2 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 flex items-center space-x-1 mr-1">
                <Sparkles className="w-3 h-3 text-cf-orange" />
                <span>Suggestions:</span>
              </div>
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(p.prompt)}
                  className="px-3 py-1 rounded-full bg-[#2b2b2b] hover:bg-[#333333] border border-[#3d3d3d] text-xs text-zinc-300 hover:text-white transition flex items-center space-x-1.5 group"
                >
                  <span>{p.title}</span>
                  <ArrowRight className="w-2.5 h-2.5 text-zinc-500 group-hover:text-cf-orange transition" />
                </button>
              ))}
            </div>
          )}

          {/* Claude Multiline Rounded Composer */}
          <div className="relative bg-[#262626] hover:bg-[#282828] border border-[#3a3a3a] focus-within:border-cf-orange/70 rounded-2xl shadow-xl transition-all p-2.5">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              disabled={loading}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Reply to Urumi Agent or ask to manage WooCommerce store, products, or notes..."
              className="w-full px-2.5 py-1.5 pr-12 bg-transparent text-[#f2f2f2] placeholder-zinc-500 text-[15px] leading-relaxed resize-none focus:outline-none disabled:opacity-50 max-h-[200px]"
            />
            <div className="flex items-center justify-between pt-1 px-1">
              <span className="text-[11px] text-zinc-500 font-sans">
                Use <kbd className="px-1 py-0.5 rounded bg-[#1e1e1e] border border-[#383838] text-[10px] text-zinc-400">Shift + Enter</kbd> for new line
              </span>

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
              Agent autonomously executes tools across connected MCP servers with user-attributed audit logging.
            </span>
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
    </div>
  );
};
