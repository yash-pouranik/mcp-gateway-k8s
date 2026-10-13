import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Sparkles, Trash2, Loader2, ArrowRight } from 'lucide-react';

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
    <div className="flex flex-col h-[calc(100vh-9.5rem)] bg-zinc-950/90 border border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 bg-black/60 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-cf-orange">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">AI Agent Studio</h2>
            <div className="text-[11px] text-zinc-500 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Autonomous Multi-Turn Tool Loop Active</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleClear}
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded-lg transition text-xs flex items-center space-x-1"
          title="Reset conversation"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div key={m.id} className={`flex space-x-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-cf-orange">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-xl px-4 py-3 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-cf-orange text-white rounded-tr-none shadow-sm'
                    : 'bg-zinc-900/80 border border-zinc-800 text-zinc-200 rounded-tl-none shadow-sm'
                }`}
              >
                {isUser ? (
                  <div className="whitespace-pre-wrap font-sans">{m.content}</div>
                ) : (
                  <div className="prose prose-invert prose-xs max-w-none text-zinc-200">
                    <ReactMarkdown
                      components={{
                        h1: ({ ...props }) => <h1 className="text-sm font-bold text-white mb-2 mt-3" {...props} />,
                        h2: ({ ...props }) => <h2 className="text-xs font-bold text-white mb-1.5 mt-2.5" {...props} />,
                        h3: ({ ...props }) => <h3 className="text-xs font-semibold text-cf-orange mb-1 mt-2" {...props} />,
                        p: ({ ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
                        ul: ({ ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                        ol: ({ ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
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
                          <code className="px-1 py-0.5 rounded bg-zinc-800 text-cf-orange font-mono text-[11px]" {...props} />
                        ),
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                )}
                <div
                  className={`mt-1.5 text-[10px] font-mono ${
                    isUser ? 'text-white/80 text-right' : 'text-zinc-500'
                  }`}
                >
                  {m.timestamp.toLocaleTimeString()}
                </div>
              </div>

              {isUser && (
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center space-x-2.5 text-zinc-400 text-xs">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-cf-orange">
              <Bot className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 rounded-tl-none flex items-center space-x-2 font-mono">
              <Loader2 className="w-3.5 h-3.5 text-cf-orange animate-spin" />
              <span>Resolving tool calls through Gateway...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      {messages.length <= 2 && (
        <div className="px-5 py-2.5 bg-black/40 border-t border-zinc-800/80">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2 flex items-center space-x-1.5 font-mono">
            <Sparkles className="w-3 h-3 text-cf-orange" />
            <span>Quick Test Actions</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(p.prompt)}
                className="text-left p-2.5 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-lg transition group flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-white group-hover:text-cf-orange transition">
                    {p.title}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate max-w-xs">{p.prompt}</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-cf-orange transition ml-2 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3.5 bg-black/60 border-t border-zinc-800 flex items-center space-x-2.5"
      >
        <input
          type="text"
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI agent to inspect WooCommerce store, create product, query orders, or notes..."
          className="flex-1 px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-xs focus:outline-none focus:ring-1 focus:ring-cf-orange disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2.5 bg-cf-orange hover:bg-cf-hover active:bg-cf-dark disabled:opacity-40 text-white rounded-xl transition shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
