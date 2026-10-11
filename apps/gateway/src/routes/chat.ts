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

// POST /api/chat
router.post('/', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    res.status(400).json({ error: 'Messages array is required' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  // 1. Fetch available aggregated tools from enabled MCP servers
  const upstreamTools = await upstreamManager.aggregateTools();
  const openAiTools = upstreamTools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.gatewayName,
      description: t.description || '',
      parameters: t.inputSchema || { type: 'object', properties: {} },
    },
  }));

  // If no OpenAI key is set, fallback to simulated LLM execution for local/offline testing
  if (!apiKey) {
    // Provide a clear fallback if no external key is present
    res.json({
      role: 'assistant',
      content: 'Note: OPENAI_API_KEY is not configured in the gateway environment. You can manage servers, API keys, and test MCP tools directly via the MCP endpoint /mcp or supply an API key in the Gateway deployment.',
      toolsDiscovered: upstreamTools.map((t) => t.gatewayName),
    });
    return;
  }

  // 2. Autonomous Multi-turn Agent Tool Calling Loop (max 5 rounds)
  const conversation: ChatMessage[] = [
    {
      role: 'system',
      content: `You are an AI assistant for the WooCommerce & MCP Gateway platform. You have access to tools across connected systems (e.g. WooCommerce store, Notes, FakeStore). When users ask to view or modify store products, orders, notes, etc., call the respective tools. Always provide clear, helpful markdown summaries of tool results.`,
    },
    ...messages,
  ];

  let rounds = 0;
  const maxRounds = 5;

  try {
    while (rounds < maxRounds) {
      rounds++;

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
        res.status(502).json({ error: `Upstream LLM error (${response.status}): ${errorText}` });
        return;
      }

      const data = (await response.json()) as any;
      const choice = data.choices?.[0];
      if (!choice) {
        res.status(502).json({ error: 'Empty response from LLM' });
        return;
      }

      const assistantMessage = choice.message;
      conversation.push(assistantMessage);

      // Check if the assistant called tools
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        // Final text answer ready
        res.json({
          role: 'assistant',
          content: assistantMessage.content,
        });
        return;
      }

      // Execute each tool call requested by LLM
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (_) {}

        const startTime = Date.now();
        let targetServerId: string | null = null;
        let toolOutputString = '';

        try {
          const { result, serverId } = await upstreamManager.callTool(toolName, args);
          targetServerId = serverId;
          toolOutputString = JSON.stringify(result);

          await recordAuditLog({
            userId: req.user!.id,
            serverId: targetServerId,
            toolName,
            inputSummary: args,
            durationMs: Date.now() - startTime,
            success: true,
          });
        } catch (err: any) {
          toolOutputString = JSON.stringify({ error: err.message || 'Execution failed' });

          await recordAuditLog({
            userId: req.user!.id,
            serverId: targetServerId,
            toolName,
            inputSummary: args,
            durationMs: Date.now() - startTime,
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

    res.json({
      role: 'assistant',
      content: conversation[conversation.length - 1].content || 'Tool execution cycle completed.',
    });
  } catch (err: any) {
    res.status(500).json({ error: `Agent execution failed: ${err.message}` });
  }
});

export default router;
