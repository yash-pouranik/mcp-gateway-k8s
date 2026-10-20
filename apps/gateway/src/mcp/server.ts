import { Request, Response } from 'express';
import { upstreamManager } from './upstream.js';
import { recordAuditLog } from '../services/audit.js';
import {
  trackActiveRequest,
  recordToolCallMetric,
  recordUpstreamTimeout,
  recordAuthFailure,
} from '../services/metrics.js';

/**
 * Restricted tools that require 'admin' role.
 * Regular 'member' users can only read/query (e.g. list_products, get_product, list_orders, get_order, list_notes, get_note).
 * Mutating or destructive actions (create, update, delete) are strictly restricted.
 */
export const RESTRICTED_ADMIN_TOOLS = new Set([
  'woocommerce__create_product',
  'woocommerce__update_product',
  'woocommerce__delete_product',
  'woocommerce__update_order_status',
  'woocommerce__update_order',
  'notes__create_note',
  'notes__update_note',
  'notes__delete_note',
]);

export function isRestrictedTool(toolName: string): boolean {
  if (RESTRICTED_ADMIN_TOOLS.has(toolName)) return true;
  if (toolName.includes('__create_') || toolName.includes('__delete_') || toolName.includes('__update_')) {
    return true;
  }
  return false;
}

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
  const userRole = user?.role || 'member';

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
      let tools = await upstreamManager.aggregateTools();

      // Granular RBAC: Filter out mutating tools for non-admin users
      if (userRole !== 'admin') {
        tools = tools.filter((t) => !isRestrictedTool(t.gatewayName));
      }

      result = {
        tools: tools.map((t) => ({
          name: t.gatewayName,
          description: t.description,
          inputSchema: t.inputSchema || { type: 'object', properties: {} },
        })),
      };
    } else if (method === 'tools/call') {
      const startTime = Date.now();
      const toolName = params?.name || '';
      const toolArgs = params?.arguments || {};
      let targetServerId: string | null = null;

      const sepIdx = toolName.indexOf('__');
      const serverSlug = sepIdx !== -1 ? toolName.substring(0, sepIdx) : 'gateway';
      const cleanTool = sepIdx !== -1 ? toolName.substring(sepIdx + 2) : toolName || 'unknown';

      // Granular RBAC: Enforce role-based tool restrictions
      if (userRole !== 'admin' && isRestrictedTool(toolName)) {
        recordAuthFailure('rbac_denied');
        const errorMsg = `Permission Denied: Tool '${toolName}' requires admin privileges. User role '${userRole}' is not authorized.`;

        await recordAuditLog({
          userId,
          serverId: null,
          toolName,
          inputSummary: {
            parameters: toolArgs,
            apiKeyId: req.apiKeyId || null,
            apiKeyPrefix: req.apiKeyPrefix || null,
            keyPrefix: req.apiKeyPrefix || null,
            apiKeyName: req.apiKeyName || null,
            keyName: req.apiKeyName || null,
            source: req.apiKeyPrefix ? 'external_client' : 'dashboard_jwt',
            rejectionReason: 'RBAC_PERMISSION_DENIED',
          },
          durationMs: Date.now() - startTime,
          success: false,
          errorMsg,
        });

        res.status(403).json({
          jsonrpc: '2.0',
          id: id ?? null,
          error: {
            code: -32003,
            message: errorMsg,
          },
        });
        return;
      }

      const endActiveRequest = trackActiveRequest();
      try {
        const callRes = await upstreamManager.callTool(toolName, toolArgs);
        targetServerId = callRes.serverId;
        result = callRes.result;
        const durationMs = Date.now() - startTime;

        recordToolCallMetric({
          server: serverSlug,
          tool: cleanTool,
          durationMs,
          outcome: 'success',
        });

        await recordAuditLog({
          userId,
          serverId: targetServerId,
          toolName,
          inputSummary: {
            parameters: toolArgs,
            response: result,
            apiKeyId: req.apiKeyId || null,
            apiKeyPrefix: req.apiKeyPrefix || null,
            keyPrefix: req.apiKeyPrefix || null,
            apiKeyName: req.apiKeyName || null,
            keyName: req.apiKeyName || null,
            source: req.apiKeyPrefix ? 'external_client' : 'dashboard_jwt',
          },
          durationMs,
          success: true,
        });
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        const errorMsg = err.message || 'Tool execution error';
        const isTimeout = err.name === 'AbortError' || errorMsg.toLowerCase().includes('timeout');

        if (isTimeout) {
          recordUpstreamTimeout(serverSlug);
        }

        recordToolCallMetric({
          server: serverSlug,
          tool: cleanTool,
          durationMs,
          outcome: isTimeout ? 'timeout' : 'failure',
        });

        await recordAuditLog({
          userId,
          serverId: targetServerId,
          toolName,
          inputSummary: {
            parameters: toolArgs,
            apiKeyId: req.apiKeyId || null,
            apiKeyPrefix: req.apiKeyPrefix || null,
            keyPrefix: req.apiKeyPrefix || null,
            apiKeyName: req.apiKeyName || null,
            keyName: req.apiKeyName || null,
            source: req.apiKeyPrefix ? 'external_client' : 'dashboard_jwt',
          },
          durationMs,
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
      } finally {
        endActiveRequest();
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
