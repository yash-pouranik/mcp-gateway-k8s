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
  const ISSUER = process.env.OAUTH_ISSUER || 'https://vynn.urbackend.in';

  // 1. Handle GET /mcp (Capabilities Discovery or SSE stream)
  if (req.method === 'GET') {
    const isSSE = req.headers.accept?.includes('text/event-stream');
    if (isSSE) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'MCP-Protocol-Version': '2026-07-28',
      });
      res.write(`event: endpoint\ndata: ${ISSUER}/mcp\n\n`);
      const interval = setInterval(() => {
        res.write(': ping\n\n');
      }, 15000);
      req.on('close', () => clearInterval(interval));
      return;
    }

    // Standard HTTP GET capability probe
    res.status(200).json({
      status: 'ok',
      protocolVersion: '2026-07-28',
      capabilities: { tools: { listChanged: true } },
      serverInfo: { name: 'mcp-gateway-hub', version: '2.0.0' },
      endpoint: `${ISSUER}/mcp`,
    });
    return;
  }

  const jsonRpcMessage = req.body;

  // Handle empty probe or missing body
  if (!jsonRpcMessage || typeof jsonRpcMessage !== 'object' || Object.keys(jsonRpcMessage).length === 0) {
    res.status(200).json({
      jsonrpc: '2.0',
      id: null,
      result: {
        protocolVersion: '2026-07-28',
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: 'mcp-gateway-hub', version: '2.0.0' },
      },
    });
    return;
  }

  const { method, params, id } = jsonRpcMessage;
  const user = req.user;
  const userId = user?.id || null;
  const userRole = user?.role || 'member';

  const requestedVersion =
    (req.headers['mcp-protocol-version'] as string) ||
    jsonRpcMessage._meta?.['io.modelcontextprotocol/protocolVersion'] ||
    params?.protocolVersion ||
    '2026-07-28';

  res.setHeader('MCP-Protocol-Version', String(requestedVersion));

  // Determine rich caller context for audit logging
  let authType = 'dashboard_jwt';
  let callerName = user?.name || 'Dashboard User';
  let clientSource = 'dashboard';

  if (req.oauthClientId) {
    authType = 'oauth';
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const clientNameLower = (req.oauthClientName || '').toLowerCase();

    if (clientNameLower.includes('claude') || ua.includes('claude')) {
      callerName = 'Claude (OAuth)';
      clientSource = 'claude_oauth';
    } else if (clientNameLower.includes('chatgpt') || ua.includes('chatgpt') || ua.includes('openai')) {
      callerName = 'ChatGPT (OAuth)';
      clientSource = 'chatgpt_oauth';
    } else {
      callerName = req.oauthClientName ? `${req.oauthClientName} (OAuth)` : `OAuth Client (${req.oauthClientId.slice(0, 14)})`;
      clientSource = 'oauth_client';
    }
  } else if (req.apiKeyPrefix) {
    authType = 'api_key';
    callerName = `API Key: ${req.apiKeyName || req.apiKeyPrefix}`;
    clientSource = 'api_key';
  }

  try {
    let result: any;

    if (method === 'initialize') {
      result = {
        protocolVersion: requestedVersion,
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: 'mcp-gateway-hub', version: '2.0.0' },
      };
    } else if (method === 'server/discover') {
      result = {
        protocolVersion: '2026-07-28',
        supportedProtocolVersions: ['2026-07-28', '2025-11-25', '2025-06-18', '2024-11-05'],
        serverInfo: { name: 'mcp-gateway-hub', version: '2.0.0' },
        capabilities: { tools: { listChanged: true } },
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
        ttlMs: 60000,
      };
    } else if (method === 'tools/call') {
      const startTime = Date.now();
      const toolName = params?.name || '';
      const toolArgs = params?.arguments || {};
      let targetServerId: string | null = null;

      const sepIdx = toolName.indexOf('__');
      const serverSlug = sepIdx !== -1 ? toolName.substring(0, sepIdx) : 'gateway';
      const cleanTool = sepIdx !== -1 ? toolName.substring(sepIdx + 2) : toolName || 'unknown';

      // Scope enforcement for OAuth tokens
      if (req.oauthScope !== undefined) {
        const writeTools = ['create_product', 'update_product', 'delete_product', 'update_order_status', 'create_note', 'delete_note'];
        const adminTools = ['delete_product', 'delete_note'];

        const needsWrite = writeTools.some(t => toolName.includes(t));
        const needsAdmin = adminTools.some(t => toolName.includes(t));

        const scopes = req.oauthScope.split(' ');

        if (needsAdmin && !scopes.includes('mcp:admin')) {
          res.status(403).json({
            error: 'insufficient_scope',
            error_description: `Tool '${toolName}' requires 'mcp:admin' scope`,
          });
          return;
        }
        if (needsWrite && !scopes.includes('mcp:write')) {
          res.status(403).json({
            error: 'insufficient_scope',
            error_description: `Tool '${toolName}' requires 'mcp:write' scope`,
          });
          return;
        }
      }

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
            authType,
            callerName,
            clientSource,
            source: clientSource,
            clientId: req.oauthClientId || null,
            oauthScope: req.oauthScope || null,
            apiKeyId: req.apiKeyId || null,
            apiKeyPrefix: req.apiKeyPrefix || null,
            keyPrefix: req.apiKeyPrefix || null,
            apiKeyName: req.apiKeyName || null,
            keyName: req.apiKeyName || null,
            userRole,
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
            authType,
            callerName,
            clientSource,
            source: clientSource,
            clientId: req.oauthClientId || null,
            oauthScope: req.oauthScope || null,
            apiKeyId: req.apiKeyId || null,
            apiKeyPrefix: req.apiKeyPrefix || null,
            keyPrefix: req.apiKeyPrefix || null,
            apiKeyName: req.apiKeyName || null,
            keyName: req.apiKeyName || null,
            userRole,
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
            authType,
            callerName,
            clientSource,
            source: clientSource,
            clientId: req.oauthClientId || null,
            oauthScope: req.oauthScope || null,
            apiKeyId: req.apiKeyId || null,
            apiKeyPrefix: req.apiKeyPrefix || null,
            keyPrefix: req.apiKeyPrefix || null,
            apiKeyName: req.apiKeyName || null,
            keyName: req.apiKeyName || null,
            userRole,
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
