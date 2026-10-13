import { Router, Request, Response } from 'express';
import { requireUserAuth } from '../middleware/auth.js';
import { upstreamManager } from '../mcp/upstream.js';
import { recordAuditLog } from '../services/audit.js';

const router = Router();

interface ChatMessage {
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

// POST /api/chat
router.post('/', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const { messages, stream } = req.body;
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
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  // 1. Fetch available aggregated tools from enabled MCP servers
  sendEvent('activity_started', {
    id: 'act-explore',
    type: 'explore_tools',
    label: 'Exploring available tools across connected MCP servers',
    timestamp: Date.now(),
  });

  const exploreStart = Date.now();
  let upstreamTools: any[] = [];
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

  const openAiTools = upstreamTools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.gatewayName,
      description: t.description || '',
      parameters: t.inputSchema || { type: 'object', properties: {} },
    },
  }));

  // If no OpenAI key is set, fallback to clear notification
  if (!apiKey) {
    const fallbackText = 'Note: OPENAI_API_KEY is not configured in the gateway environment. You can manage servers, API keys, and test MCP tools directly via the MCP endpoint /mcp or supply an API key in the Gateway deployment.';
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

  // 2. Autonomous Multi-turn Agent Tool Calling Loop (max 5 rounds)
  const conversation: ChatMessage[] = [
    {
      role: 'system',
      content: `You are Urumi Agent, an AI assistant for the WooCommerce & MCP Gateway platform. You have access to tools across connected systems (e.g. WooCommerce store, Notes, FakeStore). When users ask to view or modify store products, orders, notes, etc., call the respective tools. Always provide clear, helpful markdown summaries of tool results.`,
    },
    ...messages,
  ];

  let rounds = 0;
  const maxRounds = 5;

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

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: conversation,
          tools: openAiTools.length > 0 ? openAiTools : undefined,
          tool_choice: openAiTools.length > 0 ? 'auto' : undefined,
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

      // Check if the assistant called tools
      if (!hasTools) {
        // Final text answer ready
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
          durationMs: 40,
        });

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
        return;
      }

      // Execute each tool call requested by LLM
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

          sendEvent('tool_call_completed', {
            id: callId,
            tool: toolName,
            cleanTool,
            server: serverSlug,
            durationMs: duration,
            summary,
          });

          await recordAuditLog({
            userId: req.user!.id,
            serverId: targetServerId,
            toolName,
            inputSummary: sanitizedArgs,
            durationMs: duration,
            success: true,
          });
        } catch (err: any) {
          const duration = Date.now() - startTime;
          toolOutputString = JSON.stringify({ error: err.message || 'Execution failed' });

          sendEvent('tool_call_failed', {
            id: callId,
            tool: toolName,
            cleanTool,
            server: serverSlug,
            durationMs: duration,
            error: err.message || 'Execution failed',
          });

          await recordAuditLog({
            userId: req.user!.id,
            serverId: targetServerId,
            toolName,
            inputSummary: sanitizedArgs,
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
