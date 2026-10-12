import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
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
        '👋 Welcome! I am your AI assistant connected to the **MCP Gateway**. I can autonomously execute tools across WooCommerce, FakeStore, and Team Notes. What would you like to do?',
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
      // Build conversation payload for Gateway
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
          'Conversation reset. I am ready to help you manage products, check orders, or manage team notes via MCP.',
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
    <div className="flex flex-col h-[calc(100vh-10rem)] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
      {/* Chat Header */}
      <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">AI Agent Console</h2>
            <div className="text-xs text-slate-400 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Multi-turn Gateway Tool Execution Loop Active</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleClear}
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 rounded-xl transition text-xs flex items-center space-x-1"
          title="Reset conversation"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div key={m.id} className={`flex space-x-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-emerald-600 text-white rounded-tr-none shadow-md shadow-emerald-950/20'
                    : 'bg-slate-800/90 border border-slate-700 text-slate-200 rounded-tl-none shadow-lg'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{m.content}</div>
                <div
                  className={`mt-1.5 text-[10px] font-mono ${
                    isUser ? 'text-emerald-200/70 text-right' : 'text-slate-500'
                  }`}
                >
                  {m.timestamp.toLocaleTimeString()}
                </div>
              </div>

              {isUser && (
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-300">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center space-x-3 text-slate-400 text-sm">
            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl px-4 py-3 rounded-tl-none flex items-center space-x-2">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              <span>Agent invoking tools via Gateway...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts Pill Container */}
      {messages.length <= 2 && (
        <div className="px-6 py-2 bg-slate-900/60 border-t border-slate-800/80">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Suggested Test Prompts</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(p.prompt)}
                className="text-left p-2.5 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 rounded-xl transition group flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-emerald-400">{p.title}</div>
                  <div className="text-[11px] text-slate-400 truncate max-w-xs">{p.prompt}</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition ml-2 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-4 bg-slate-800/80 border-t border-slate-700/80 flex items-center space-x-3"
      >
        <input
          type="text"
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI agent to inspect or modify store products, orders, notes..."
          className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 text-white rounded-xl transition shadow-lg shadow-emerald-950/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
