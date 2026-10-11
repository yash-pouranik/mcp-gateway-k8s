import { Request, Response } from 'express';
import { upstreamManager } from './upstream.js';
import { recordAuditLog } from '../services/audit.js';

/**
 * Handle incoming JSON-RPC 2.0 requests at /mcp
 * Compliant with Streamable HTTP MCP transport specifications.
 */
export async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  const jsonRpcMessage = req.body;

  if (!jsonRpcMessage || typeof jsonRpcMessage !== 'object') {
    res.status(400).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Invalid Request: body must be a JSON-RPC object' },
    });
    return;
  }

  const { method, params, id } = jsonRpcMessage;
  const user = req.user;
  const userId = user?.id || null;

  try {
    let result: any;

    if (method === 'initialize') {
      result = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'mcp-gateway-hub', version: '1.0.0' },
      };
    } else if (method === 'notifications/initialized') {
      res.status(204).end();
      return;
    } else if (method === 'tools/list') {
      const tools = await upstreamManager.aggregateTools();
      result = {
        tools: tools.map((t) => ({
          name: t.gatewayName,
          description: t.description,
          inputSchema: t.inputSchema || { type: 'object', properties: {} },
        })),
      };
    } else if (method === 'tools/call') {
      const startTime = Date.now();
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      let targetServerId: string | null = null;

      try {
        const callRes = await upstreamManager.callTool(toolName, toolArgs);
        targetServerId = callRes.serverId;
        result = callRes.result;

        await recordAuditLog({
          userId,
          serverId: targetServerId,
          toolName,
          inputSummary: toolArgs,
          durationMs: Date.now() - startTime,
          success: true,
        });
      } catch (err: any) {
        const errorMsg = err.message || 'Tool execution error';
        await recordAuditLog({
          userId,
          serverId: targetServerId,
          toolName,
          inputSummary: toolArgs,
          durationMs: Date.now() - startTime,
          success: false,
          errorMsg,
        });

        result = {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Tool execution failed: ${errorMsg}`,
            },
          ],
        };
      }
    } else if (method === 'ping') {
      result = {};
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
      return;
    }

    res.json({
      jsonrpc: '2.0',
      id: id ?? null,
      result,
    });
  } catch (err: any) {
    res.status(500).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32603, message: err.message || 'Internal server error' },
    });
  }
}
