import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Sparkles, Trash2, Loader2, ArrowRight, X, ZoomIn } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '👋 Welcome! I am your AI assistant connected to the **MCP Gateway**. I can autonomously execute tools across WooCommerce, FakeStore, and Team Notes. What would you like to inspect or manage?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const payload = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.sendChatMessage(payload);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `assistant-err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Agent Error:** ${err.message || 'Failed to reach AI agent'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
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

  return (
    <div className="flex flex-col h-full w-full bg-black">
      {/* Top Studio Bar */}
      <div className="px-6 py-2.5 bg-zinc-950/80 border-b border-zinc-800/80 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="p-1 rounded-md bg-zinc-900 border border-zinc-800 text-cf-orange">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-white tracking-tight">AI Agent Studio</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-[10px] font-mono text-zinc-400">Autonomous Tool Loop Active</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleClear}
          className="px-2.5 py-1 text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded-md transition text-xs flex items-center space-x-1.5 font-medium"
          title="New Chat / Reset Conversation"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Centered Chat Container (Claude / ChatGPT style) */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div key={m.id} className="flex space-x-4">
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    isUser
                      ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                      : 'bg-cf-orange/15 text-cf-orange border border-cf-orange/30'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className="flex-1 space-y-1 overflow-hidden pt-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-white">
                      {isUser ? 'You' : 'Agent'}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {m.timestamp.toLocaleTimeString()}
                    </span>
                  </div>

                  {isUser ? (
                    <div className="text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed font-sans">
                      {m.content}
                    </div>
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none text-zinc-300 leading-relaxed font-sans">
                      <ReactMarkdown
                        components={{
                          h1: ({ ...props }) => <h1 className="text-base font-bold text-white mb-2 mt-4" {...props} />,
                          h2: ({ ...props }) => <h2 className="text-sm font-bold text-white mb-2 mt-3" {...props} />,
                          h3: ({ ...props }) => <h3 className="text-xs font-bold text-cf-orange mb-1.5 mt-2" {...props} />,
                          p: ({ ...props }) => <p className="mb-2.5 leading-relaxed text-sm text-zinc-200" {...props} />,
                          ul: ({ ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-sm text-zinc-300" {...props} />,
                          ol: ({ ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-sm text-zinc-300" {...props} />,
                          li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
                          strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
                          a: ({ ...props }) => (
                            <a
                              className="text-cf-orange hover:text-amber-400 underline font-medium"
                              target="_blank"
                              rel="noopener noreferrer"
                              {...props}
                            />
                          ),
                          code: ({ ...props }) => (
                            <code className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-cf-orange font-mono text-xs" {...props} />
                          ),
                          img: ({ src, alt }) => (
                            <div className="my-2.5 inline-block group relative cursor-pointer" onClick={() => src && setPreviewImage(src)}>
                              <div className="w-48 h-36 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center relative shadow-sm group-hover:border-cf-orange/50 transition">
                                <img
                                  src={src}
                                  alt={alt || 'Embedded image'}
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                  <div className="p-1.5 rounded-full bg-black/80 text-white flex items-center space-x-1 text-[11px] font-sans px-2.5">
                                    <ZoomIn className="w-3.5 h-3.5 text-cf-orange" />
                                    <span>Preview</span>
                                  </div>
                                </div>
                              </div>
                              {alt && <div className="text-[11px] text-zinc-500 mt-1 truncate max-w-[12rem]">{alt}</div>}
                            </div>
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex space-x-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cf-orange/15 text-cf-orange border border-cf-orange/30 flex items-center justify-center">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="flex-1 pt-1.5">
                <div className="flex items-center space-x-2 text-xs text-zinc-400 font-mono">
                  <Loader2 className="w-3.5 h-3.5 text-cf-orange animate-spin" />
                  <span>Executing autonomous tool loops via Gateway...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Bottom Prompt Bar (Claude / ChatGPT style) */}
      <div className="p-4 bg-gradient-to-t from-black via-black/95 to-transparent flex-shrink-0">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Quick prompt suggestions when conversation is fresh */}
          {messages.length <= 2 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center space-x-1 mr-1">
                <Sparkles className="w-3 h-3 text-cf-orange" />
                <span>Suggestions:</span>
              </div>
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(p.prompt)}
                  className="px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 hover:text-white transition flex items-center space-x-1.5 group"
                >
                  <span>{p.title}</span>
                  <ArrowRight className="w-2.5 h-2.5 text-zinc-500 group-hover:text-cf-orange transition" />
                </button>
              ))}
            </div>
          )}

          {/* Large Floating Input Card */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="relative flex items-center bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800 focus-within:border-cf-orange/60 rounded-2xl shadow-lg transition-all"
          >
            <input
              type="text"
              value={input}
              disabled={loading}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything across WooCommerce, store orders, products, or team notes..."
              className="w-full px-4 py-3.5 pr-14 bg-transparent text-white placeholder-zinc-500 text-sm focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2.5 p-2 bg-cf-orange hover:bg-cf-hover active:bg-cf-dark disabled:opacity-30 disabled:hover:bg-cf-orange text-white rounded-xl transition shadow-sm"
              title="Send prompt"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center">
            <span className="text-[11px] text-zinc-500">
              Agent executes live tools across Kubernetes-hosted MCP servers with session audit attribution.
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
