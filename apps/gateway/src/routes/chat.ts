import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { requireUserAuth, requireAdmin } from '../middleware/auth.js';
import { upstreamManager } from '../mcp/upstream.js';
import { recordAuditLog } from '../services/audit.js';
import { aiRouter } from '../services/aiRouter.js';

const router = Router();

interface ChatMessageInput {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

function sanitizeInput(args: any): Record<string, any> {
  if (!args || typeof args !== 'object') return {};
  const sanitized: Record<string, any> = {};
  for (const [k, v] of Object.entries(args)) {
    const lower = k.toLowerCase();
    if (lower.includes('key') || lower.includes('secret') || lower.includes('token') || lower.includes('auth') || lower.includes('password')) {
      sanitized[k] = '***';
    } else if (typeof v === 'string' && v.length > 100) {
      sanitized[k] = v.substring(0, 100) + '...';
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

function generateToolOutputSummary(cleanTool: string, result: any): string {
  if (!result) return 'Completed successfully';

  let data = result;
  if (result.content && Array.isArray(result.content)) {
    const textItem = result.content.find((c: any) => c.type === 'text');
    if (textItem && textItem.text) {
      try {
        data = JSON.parse(textItem.text);
      } catch {
        data = textItem.text;
      }
    }
  }

  if (Array.isArray(data)) {
    return `Retrieved ${data.length} item(s)`;
  }
  if (typeof data === 'object' && data !== null) {
    if (data.id) return `Processed record #${data.id}`;
    if (data.name) return `Item: ${data.name}`;
    if (data.title) return `Item: ${data.title}`;
    if (data.total !== undefined) return `Found ${data.total} records`;
    const keys = Object.keys(data);
    return `Returned ${keys.length} fields`;
  }
  if (typeof data === 'string') {
    return data.length > 60 ? data.substring(0, 60) + '...' : data;
  }
  return 'Completed successfully';
}

// ==========================================
// 1. GET /api/chat/providers — List AI Providers
// ==========================================
router.get('/providers', requireUserAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const providers = await aiRouter.getProviders();
    res.json({
      providers: providers.map((p) => ({
        name: p.name,
        displayName: p.displayName,
        supportsTools: p.supportsTools,
        costTier: p.costTier,
        defaultModel: p.defaultModel,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to load providers: ${err.message}` });
  }
});

// ==========================================
// 2. GET /api/chat/sessions — List Chat Sessions
// ==========================================
router.get('/sessions', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const targetUserId = (req.user!.role === 'admin' && typeof req.query.userId === 'string')
      ? req.query.userId
      : req.user!.id;

    const sessions = await prisma.chatSession.findMany({
      where: { userId: targetUserId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        provider: true,
        totalTokens: true,
        messageCount: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to load sessions: ${err.message}` });
  }
});

// ==========================================
// 3. GET /api/chat/sessions/:id — Load Session History
// ==========================================
router.get('/sessions/:id', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const session = await prisma.chatSession.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { sequenceNumber: 'asc' },
          include: {
            toolExecutions: true,
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.userId !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: You do not own this chat session' });
      return;
    }

    res.json({ session });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to load session messages: ${err.message}` });
  }
});

// ==========================================
// 4. DELETE /api/chat/sessions/:id — Delete Session
// ==========================================
router.delete('/sessions/:id', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const session = await prisma.chatSession.findUnique({ where: { id } });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.userId !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    await prisma.chatSession.delete({ where: { id } });
    res.json({ message: 'Session deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to delete session: ${err.message}` });
  }
});

// ==========================================
// 5. GET /api/chat/usage — Admin Token Analytics
// ==========================================
router.get('/usage', requireUserAuth, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const usage = await prisma.dailyTokenUsage.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { date: 'desc' },
      take: 200,
    });

    // Aggregate by user
    const userSummaryMap: Record<string, {
      userId: string;
      name: string;
      email: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      requestCount: number;
      providers: Record<string, number>;
    }> = {};

    for (const record of usage) {
      const uId = record.userId;
      if (!userSummaryMap[uId]) {
        userSummaryMap[uId] = {
          userId: uId,
          name: record.user.name,
          email: record.user.email,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          requestCount: 0,
          providers: {},
        };
      }

      userSummaryMap[uId].promptTokens += record.promptTokens;
      userSummaryMap[uId].completionTokens += record.completionTokens;
      userSummaryMap[uId].totalTokens += record.totalTokens;
      userSummaryMap[uId].requestCount += record.requestCount;
      userSummaryMap[uId].providers[record.provider] =
        (userSummaryMap[uId].providers[record.provider] || 0) + record.totalTokens;
    }

    res.json({
      summary: Object.values(userSummaryMap),
      dailyRecords: usage,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to load usage statistics: ${err.message}` });
  }
});

// ==========================================
// 6. POST /api/chat — Multi-Turn Agent Loop with Persistence & Multi-Provider
// ==========================================
router.post('/', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const { messages, stream, sessionId, provider: requestedProvider } = req.body;
  if (!Array.isArray(messages)) {
    res.status(400).json({ error: 'Messages array is required' });
    return;
  }

  const isStream = stream === true || req.headers.accept?.includes('text/event-stream');

  let isAborted = false;
  req.on('close', () => {
    isAborted = true;
  });

  if (isStream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
  }

  const sendEvent = (event: string, data: any) => {
    if (isStream && !res.writableEnded && !isAborted) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  const overallStartTime = Date.now();
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  // 1. Session Persistence: Ensure ChatSession exists
  let currentSessionId = sessionId;
  try {
    if (currentSessionId) {
      const existing = await prisma.chatSession.findUnique({ where: { id: currentSessionId } });
      if (!existing || (existing.userId !== req.user!.id && req.user!.role !== 'admin')) {
        currentSessionId = null;
      }
    }

    if (!currentSessionId) {
      const title = lastUserMsg.length > 80
        ? lastUserMsg.substring(0, 80).replace(/\s+\S*$/, '...')
        : lastUserMsg || 'New Conversation';

      const newSession = await prisma.chatSession.create({
        data: {
          userId: req.user!.id,
          title,
          provider: requestedProvider || 'auto',
        },
      });
      currentSessionId = newSession.id;
    }

    // Persist incoming user message
    if (lastUserMsg) {
      const msgCount = await prisma.chatMessage.count({ where: { sessionId: currentSessionId } });
      await prisma.chatMessage.create({
        data: {
          sessionId: currentSessionId,
          sequenceNumber: msgCount + 1,
          role: 'user',
          content: lastUserMsg,
        },
      });
    }

    sendEvent('session_info', { sessionId: currentSessionId });
  } catch (err) {
    console.warn('Session persistence notice:', err);
  }

  // 2. Intent Classification: Detect Greetings & Pure Conversational Chit-Chat
  const cleanMsg = lastUserMsg.trim().toLowerCase();
  const greetingPatterns = [
    /^(hi|hello|hlo|hey|heyy|namaste|greetings|good\s*(morning|afternoon|evening)|howdy)\b/i,
    /^(who\s+are\s+you|what\s+can\s+you\s+do|help|what\s+are\s+your\s+capabilities)\b/i,
    /^(thanks|thank\s+you|bye|goodbye|ok|okay|cool|nice)\b/i,
  ];
  const isPureGreeting = cleanMsg.length <= 40 && greetingPatterns.some((pattern) => pattern.test(cleanMsg));

  // 3. Discover MCP tools (Skip activity noise for pure greetings)
  let upstreamTools: any[] = [];
  if (!isPureGreeting) {
    sendEvent('activity_started', {
      id: 'act-explore',
      type: 'explore_tools',
      label: 'Exploring available tools across connected MCP servers',
      timestamp: Date.now(),
    });

    const exploreStart = Date.now();
    try {
      upstreamTools = await upstreamManager.aggregateTools();
      sendEvent('activity_updated', {
        id: 'act-explore',
        status: 'completed',
        label: `Discovered ${upstreamTools.length} tools across upstream servers`,
        durationMs: Date.now() - exploreStart,
      });
    } catch (err: any) {
      sendEvent('activity_updated', {
        id: 'act-explore',
        status: 'failed',
        label: 'Failed to aggregate upstream tools',
        error: err.message,
        durationMs: Date.now() - exploreStart,
      });
    }
  }

  // 4. Resolve AI Provider via Multi-Provider Router
  const executionConfig = await aiRouter.resolveProvider(
    requestedProvider,
    lastUserMsg,
    upstreamTools
  );

  // Clean activity label without duplicate model mention
  const modelLabel = executionConfig.displayName.includes(executionConfig.model)
    ? executionConfig.displayName
    : `${executionConfig.displayName} (${executionConfig.model})`;

  sendEvent('activity_started', {
    id: 'act-router',
    type: 'reasoning',
    label: `Model Router: ${executionConfig.displayName}`,
    timestamp: Date.now(),
  });
  sendEvent('activity_updated', {
    id: 'act-router',
    status: 'completed',
    label: isPureGreeting ? `Fast-Path Active · ${modelLabel}` : `Selected ${modelLabel}`,
    durationMs: 15,
  });

  // Only attach tools if not a pure greeting and provider supports tools
  const openAiTools = (!isPureGreeting && executionConfig.supportsTools)
    ? upstreamTools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.gatewayName,
          description: t.description || '',
          parameters: t.inputSchema || { type: 'object', properties: {} },
        },
      }))
    : [];

  // Fallback if no API key is available
  if (!executionConfig.apiKey) {
    const fallbackText = `Note: API key for ${executionConfig.displayName} is not configured in the gateway environment. You can manage upstream servers, API keys, or configure ${executionConfig.providerName.toUpperCase()}_API_KEY in the Gateway deployment.`;
    if (isStream) {
      sendEvent('assistant_response_started', { timestamp: Date.now() });
      sendEvent('assistant_response_chunk', { delta: fallbackText });
      sendEvent('assistant_response_completed', {
        content: fallbackText,
        totalDurationMs: Date.now() - overallStartTime,
      });
      res.end();
    } else {
      res.json({
        role: 'assistant',
        content: fallbackText,
        toolsDiscovered: upstreamTools.map((t) => t.gatewayName),
      });
    }
    return;
  }

  // 4. Autonomous Agent Loop with User Context Injection
  const userName = req.user?.name || 'Team Member';
  const userEmail = req.user?.email || '';
  const userRole = req.user?.role || 'member';

  const conversation: ChatMessageInput[] = [
    {
      role: 'system',
      content: `You are VYNN, an autonomous AI assistant for the WooCommerce & MCP Gateway platform. You have access to tools across connected systems (e.g. WooCommerce store, Notes, FakeStore). When users ask to view or modify store products, orders, notes, etc., call the respective tools. Always provide clear, helpful markdown summaries of tool results.

You are currently assisting ${userName} (${userEmail}, Role: ${userRole}). Greet or refer to the user by their name (${userName}) naturally when appropriate or when asked about their identity.`,
    },
    ...messages,
  ];

  let rounds = 0;
  const maxRounds = executionConfig.supportsTools ? 5 : 1;
  const recordedActivities: any[] = [];
  let promptTokensTotal = 0;
  let completionTokensTotal = 0;

  try {
    while (rounds < maxRounds) {
      rounds++;

      if (isAborted) {
        sendEvent('execution_cancelled', { timestamp: Date.now() });
        return;
      }

      const roundId = `act-round-${rounds}`;
      sendEvent('activity_started', {
        id: roundId,
        type: 'reasoning',
        label: rounds === 1 ? 'Analyzing request & selecting tools' : 'Analyzing tool outputs & continuing reasoning',
        timestamp: Date.now(),
      });
      const roundStart = Date.now();

      const response = await fetch(`${executionConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${executionConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: executionConfig.model,
          messages: conversation,
          tools: openAiTools.length > 0 ? openAiTools : undefined,
          tool_choice: openAiTools.length > 0 ? 'auto' : undefined,
          // GPT-6 Luna / reasoning models require reasoning_effort: "none" when using function tools in /v1/chat/completions
          ...(executionConfig.providerName === 'openai' && openAiTools.length > 0
            ? { reasoning_effort: 'none' }
            : {}),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        sendEvent('activity_updated', {
          id: roundId,
          status: 'failed',
          label: `LLM reasoning failed (${response.status})`,
          error: errorText,
          durationMs: Date.now() - roundStart,
        });

        if (isStream) {
          sendEvent('execution_failed', { error: `Upstream LLM error (${response.status}): ${errorText}` });
          res.end();
        } else {
          res.status(502).json({ error: `Upstream LLM error (${response.status}): ${errorText}` });
        }
        return;
      }

      const data = (await response.json()) as any;
      if (data.usage) {
        promptTokensTotal += data.usage.prompt_tokens || 0;
        completionTokensTotal += data.usage.completion_tokens || 0;
      }

      const choice = data.choices?.[0];
      if (!choice) {
        if (isStream) {
          sendEvent('execution_failed', { error: 'Empty response from LLM' });
          res.end();
        } else {
          res.status(502).json({ error: 'Empty response from LLM' });
        }
        return;
      }

      const assistantMessage = choice.message;
      conversation.push(assistantMessage);

      const hasTools = assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0;
      sendEvent('activity_updated', {
        id: roundId,
        status: 'completed',
        label: hasTools ? `Selected ${assistantMessage.tool_calls.length} tool(s) to execute` : 'Reasoning completed',
        durationMs: Date.now() - roundStart,
      });

      // Final answer reached
      if (!hasTools) {
        const finalContent = assistantMessage.content || '';
        sendEvent('activity_started', {
          id: 'act-final',
          type: 'generating_response',
          label: 'Preparing final response',
          timestamp: Date.now(),
        });
        sendEvent('activity_updated', {
          id: 'act-final',
          status: 'completed',
          label: 'Response generated',
          durationMs: 35,
        });

        // 5. Persist Assistant Response & Rollup Token Usage
        const totalTokens = promptTokensTotal + completionTokensTotal;
        if (currentSessionId) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          try {
            const currentCount = await prisma.chatMessage.count({ where: { sessionId: currentSessionId } });
            const assistantMsg = await prisma.chatMessage.create({
              data: {
                sessionId: currentSessionId,
                sequenceNumber: currentCount + 1,
                role: 'assistant',
                content: finalContent,
                provider: executionConfig.providerName,
                model: executionConfig.model,
                promptTokens: promptTokensTotal || null,
                completionTokens: completionTokensTotal || null,
                totalTokens: totalTokens || null,
              },
            });

            // Persist separated tool executions (isolated payload)
            if (recordedActivities.length > 0) {
              await prisma.chatToolExecution.createMany({
                data: recordedActivities.map((act) => ({
                  messageId: assistantMsg.id,
                  toolName: act.tool,
                  input: act.inputSummary ?? undefined,
                  output: act.summary ? { summary: act.summary } : undefined,
                  isError: act.status === 'failed',
                  durationMs: act.durationMs || 0,
                })),
              });
            }

            // Rollup token analytics & session counters
            await Promise.all([
              prisma.dailyTokenUsage.upsert({
                where: {
                  userId_provider_model_date: {
                    userId: req.user!.id,
                    provider: executionConfig.providerName,
                    model: executionConfig.model,
                    date: today,
                  },
                },
                update: {
                  promptTokens: { increment: promptTokensTotal },
                  completionTokens: { increment: completionTokensTotal },
                  totalTokens: { increment: totalTokens },
                  requestCount: { increment: 1 },
                },
                create: {
                  userId: req.user!.id,
                  provider: executionConfig.providerName,
                  model: executionConfig.model,
                  date: today,
                  promptTokens: promptTokensTotal,
                  completionTokens: completionTokensTotal,
                  totalTokens,
                  requestCount: 1,
                },
              }),
              prisma.chatSession.update({
                where: { id: currentSessionId },
                data: {
                  provider: executionConfig.providerName,
                  messageCount: { increment: 2 },
                  totalTokens: { increment: totalTokens },
                  updatedAt: new Date(),
                },
              }),
            ]);
          } catch (err) {
            console.error('Persistence error:', err);
          }
        }

        if (isStream) {
          sendEvent('assistant_response_started', { timestamp: Date.now() });
          sendEvent('assistant_response_chunk', { delta: finalContent });
          sendEvent('assistant_response_completed', {
            content: finalContent,
            totalDurationMs: Date.now() - overallStartTime,
            provider: executionConfig.providerName,
            model: executionConfig.model,
            tokens: { prompt: promptTokensTotal, completion: completionTokensTotal, total: totalTokens },
          });
          res.end();
        } else {
          res.json({
            role: 'assistant',
            content: finalContent,
            provider: executionConfig.providerName,
            model: executionConfig.model,
            tokens: { prompt: promptTokensTotal, completion: completionTokensTotal, total: totalTokens },
          });
        }
        return;
      }

      // Execute tools requested by LLM
      for (const toolCall of assistantMessage.tool_calls) {
        if (isAborted) {
          sendEvent('execution_cancelled', { timestamp: Date.now() });
          return;
        }

        const toolName = toolCall.function.name;
        const separatorIdx = toolName.indexOf('__');
        const serverSlug = separatorIdx !== -1 ? toolName.substring(0, separatorIdx) : 'system';
        const cleanTool = separatorIdx !== -1 ? toolName.substring(separatorIdx + 2) : toolName;

        let args: any = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (_) {}

        const callId = toolCall.id || `call-${Date.now()}`;
        const sanitizedArgs = sanitizeInput(args);

        sendEvent('tool_call_started', {
          id: callId,
          tool: toolName,
          cleanTool,
          server: serverSlug,
          inputSummary: sanitizedArgs,
          timestamp: Date.now(),
        });

        const startTime = Date.now();
        let targetServerId: string | null = null;
        let toolOutputString = '';

        try {
          const { result, serverId } = await upstreamManager.callTool(toolName, args);
          targetServerId = serverId;
          toolOutputString = JSON.stringify(result);
          const duration = Date.now() - startTime;
          const summary = generateToolOutputSummary(cleanTool, result);

          const toolActivity = {
            id: callId,
            tool: toolName,
            cleanTool,
            server: serverSlug,
            durationMs: duration,
            summary,
            status: 'completed',
          };
          recordedActivities.push(toolActivity);

          sendEvent('tool_call_completed', toolActivity);

          await recordAuditLog({
            userId: req.user!.id,
            serverId: targetServerId,
            toolName,
            inputSummary: {
              parameters: sanitizedArgs,
              response: result,
              source: 'vynn_chat_agent',
            },
            durationMs: duration,
            success: true,
          });
        } catch (err: any) {
          const duration = Date.now() - startTime;
          toolOutputString = JSON.stringify({ error: err.message || 'Execution failed' });

          const failedActivity = {
            id: callId,
            tool: toolName,
            cleanTool,
            server: serverSlug,
            durationMs: duration,
            error: err.message || 'Execution failed',
            status: 'failed',
          };
          recordedActivities.push(failedActivity);

          sendEvent('tool_call_failed', failedActivity);

          await recordAuditLog({
            userId: req.user!.id,
            serverId: targetServerId,
            toolName,
            inputSummary: {
              parameters: sanitizedArgs,
              source: 'vynn_chat_agent',
            },
            durationMs: duration,
            success: false,
            errorMsg: err.message || 'Execution failed',
          });
        }

        conversation.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: toolOutputString,
        });
      }
    }

    const finalContent = conversation[conversation.length - 1].content || 'Tool execution cycle completed.';
    if (isStream) {
      sendEvent('assistant_response_started', { timestamp: Date.now() });
      sendEvent('assistant_response_chunk', { delta: finalContent });
      sendEvent('assistant_response_completed', {
        content: finalContent,
        totalDurationMs: Date.now() - overallStartTime,
      });
      res.end();
    } else {
      res.json({
        role: 'assistant',
        content: finalContent,
      });
    }
  } catch (err: any) {
    if (isStream) {
      sendEvent('execution_failed', { error: `Agent execution failed: ${err.message}` });
      res.end();
    } else {
      res.status(500).json({ error: `Agent execution failed: ${err.message}` });
    }
  }
});

export default router;
