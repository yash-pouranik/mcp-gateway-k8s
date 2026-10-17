export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  createdAt: string;
  _count?: {
    apiKeys: number;
  };
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  revokedAt: string | null;
  createdAt: string;
  rawKey?: string;
  userId?: string;
  callCount?: number;
  user?: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'member';
  };
}

export interface McpServer {
  id: string;
  name: string;
  slug: string;
  url: string;
  credentialHeader: string | null;
  enabled: boolean;
  status: 'connected' | 'unreachable' | 'disabled';
  createdAt: string;
}

export interface McpTool {
  originalName: string;
  gatewayName: string;
  description?: string;
  inputSchema?: any;
}

export interface AiProviderInfo {
  name: string;
  displayName: string;
  supportsTools: boolean;
  costTier: string;
  defaultModel: string;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  provider?: string | null;
  totalTokens: number;
  messageCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  provider?: string | null;
  model?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  activities?: any;
  createdAt: string;
}

export interface UserUsageSummary {
  userId: string;
  name: string;
  email: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestCount: number;
  providers: Record<string, number>;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  serverId: string | null;
  toolName: string;
  inputSummary: any;
  calledAt: string;
  durationMs: number;
  success: boolean;
  errorMsg: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  server?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface ActivityItem {
  id: string;
  type: 'explore_tools' | 'reasoning' | 'tool_call' | 'process_output' | 'generating_response';
  title: string;
  status: 'running' | 'completed' | 'failed';
  toolName?: string;
  cleanTool?: string;
  server?: string;
  inputSummary?: Record<string, any>;
  outputSummary?: string;
  error?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('mcp_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const api = {
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('mcp_token', data.token);
    return data;
  },

  async getMe(): Promise<{ user: User }> {
    const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load user profile');
    return res.json();
  },

  async getApiKeys(all?: boolean, userId?: string): Promise<{ keys: ApiKey[] }> {
    const params = new URLSearchParams();
    if (all) params.append('all', 'true');
    if (userId) params.append('userId', userId);
    const qs = params.toString();
    const res = await fetch(`/api/auth/api-keys${qs ? `?${qs}` : ''}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load API keys');
    return res.json();
  },

  async createApiKey(name: string): Promise<{ apiKey: ApiKey & { rawKey: string } }> {
    const res = await fetch('/api/auth/api-keys', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to create API key');
    return res.json();
  },

  async revokeApiKey(id: string): Promise<void> {
    const res = await fetch(`/api/auth/api-keys/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to revoke API key');
  },

  async getServers(): Promise<{ servers: McpServer[] }> {
    const res = await fetch('/api/servers', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load servers');
    return res.json();
  },

  async toggleServer(id: string): Promise<{ server: McpServer }> {
    const res = await fetch(`/api/servers/${id}/toggle`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to toggle server');
    return res.json();
  },

  async addServer(payload: {
    name: string;
    slug: string;
    url: string;
    credentialHeader?: string;
    credentialValue?: string;
  }): Promise<{ server: McpServer }> {
    const res = await fetch('/api/servers', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add server');
    }
    return res.json();
  },

  async updateServer(id: string, payload: {
    name?: string;
    url?: string;
    credentialHeader?: string;
    credentialValue?: string;
  }): Promise<{ server: McpServer }> {
    const res = await fetch(`/api/servers/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update server');
    }
    return res.json();
  },

  async getServerTools(id: string): Promise<{ tools: McpTool[] }> {
    const res = await fetch(`/api/servers/${id}/tools`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load server tools');
    return res.json();
  },

  async getAuditLogs(params?: {
    limit?: number;
    offset?: number;
    toolName?: string;
    userId?: string;
    serverId?: string;
    success?: boolean;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<{
    logs: AuditLog[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.toolName) query.set('toolName', params.toolName);
    if (params?.userId) query.set('userId', params.userId);
    if (params?.serverId) query.set('serverId', params.serverId);
    if (params?.success !== undefined) query.set('success', String(params.success));
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.search) query.set('search', params.search);

    const res = await fetch(`/api/audit?${query.toString()}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load audit logs');
    return res.json();
  },

  async streamChatMessage(
    messages: Array<{ role: string; content: string }>,
    onEvent: (event: string, data: any) => void,
    signal?: AbortSignal,
    options?: { sessionId?: string | null; provider?: string }
  ): Promise<{ content: string; totalDurationMs?: number }> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        messages,
        stream: true,
        sessionId: options?.sessionId || undefined,
        provider: options?.provider || undefined,
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Request failed with status ${res.status}`);
    }

    if (res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      onEvent('assistant_response_completed', { content: data.content });
      return { content: data.content };
    }

    if (!res.body) {
      throw new Error('ReadableStream not supported by response');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalContent = '';
    let totalDurationMs: number | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const block of parts) {
        if (!block.trim()) continue;
        const lines = block.split('\n');
        let eventType = 'message';
        let dataStr = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            dataStr = line.substring(5).trim();
          }
        }

        if (dataStr) {
          try {
            const parsed = JSON.parse(dataStr);
            onEvent(eventType, parsed);
            if (eventType === 'assistant_response_chunk' && parsed.delta) {
              finalContent += parsed.delta;
            } else if (eventType === 'assistant_response_completed') {
              if (parsed.content) finalContent = parsed.content;
              if (parsed.totalDurationMs) totalDurationMs = parsed.totalDurationMs;
            }
          } catch (e) {
            console.error('Error parsing SSE event data', e);
          }
        }
      }
    }

    return { content: finalContent, totalDurationMs };
  },

  async sendChatMessage(messages: Array<{ role: string; content: string }>): Promise<{
    role: string;
    content: string;
    toolsDiscovered?: string[];
  }> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Chat request failed');
    }
    return res.json();
  },

  async getMembers(): Promise<{ members: TeamMember[] }> {
    const res = await fetch('/api/members', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load team members');
    return res.json();
  },

  async createMember(payload: {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'member';
  }): Promise<{ user: TeamMember }> {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create member');
    }
    return res.json();
  },

  async getAiProviders(): Promise<{ providers: AiProviderInfo[] }> {
    const res = await fetch('/api/chat/providers', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load AI providers');
    return res.json();
  },

  async getChatSessions(userId?: string): Promise<{ sessions: ChatSessionSummary[] }> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await fetch(`/api/chat/sessions${query}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load chat sessions');
    return res.json();
  },

  async getChatSession(id: string): Promise<{ session: ChatSessionSummary & { messages: ChatMessageRecord[] } }> {
    const res = await fetch(`/api/chat/sessions/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load chat session');
    return res.json();
  },

  async deleteChatSession(id: string): Promise<void> {
    const res = await fetch(`/api/chat/sessions/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete chat session');
  },

  async getChatUsage(): Promise<{
    summary: UserUsageSummary[];
    dailyRecords: any[];
  }> {
    const res = await fetch('/api/chat/usage', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load chat usage analytics');
    return res.json();
  },
};
