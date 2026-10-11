import { prisma } from '../db.js';
import { decryptCredential } from '../services/crypto.js';

export interface UpstreamTool {
  originalName: string;
  gatewayName: string; // {slug}__{tool}
  description?: string;
  inputSchema?: any;
  serverId: string;
  serverSlug: string;
}

class UpstreamManager {
  /**
   * Helper to perform JSON-RPC 2.0 calls over HTTP POST to upstream MCP servers
   */
  private async jsonRpcCall(server: {
    id: string;
    slug: string;
    url: string;
    credentialHeader?: string | null;
    credentialValueEncrypted?: string | null;
  }, method: string, params: any = {}): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (server.credentialValueEncrypted) {
      try {
        const decrypted = decryptCredential(server.credentialValueEncrypted);
        const headerName = server.credentialHeader || 'Authorization';
        headers[headerName] = decrypted;
      } catch (err) {
        console.error(`Failed to decrypt credentials for server ${server.slug}:`, err);
      }
    }

    const endpoint = server.url.endsWith('/mcp') ? server.url : `${server.url}/mcp`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upstream server returned HTTP ${response.status}: ${text}`);
      }

      const body = (await response.json()) as any;
      if (body.error) {
        throw new Error(`Upstream JSON-RPC error: ${body.error.message || JSON.stringify(body.error)}`);
      }

      return body.result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Aggregate all tools from all enabled upstream servers
   * Namespaces tools as: {serverSlug}__{toolName}
   */
  async aggregateTools(): Promise<UpstreamTool[]> {
    const servers = await prisma.mcpServer.findMany({
      where: { enabled: true },
    });

    const aggregatedTools: UpstreamTool[] = [];

    for (const s of servers) {
      try {
        const listResult = await this.jsonRpcCall(s, 'tools/list');
        const tools = listResult?.tools || [];

        for (const tool of tools) {
          aggregatedTools.push({
            originalName: tool.name,
            gatewayName: `${s.slug}__${tool.name}`,
            description: `[${s.name}] ${tool.description || ''}`,
            inputSchema: tool.inputSchema,
            serverId: s.id,
            serverSlug: s.slug,
          });
        }
      } catch (err) {
        console.warn(`Could not load tools from server ${s.slug}:`, (err as any).message);
        // Mark server status as unreachable in DB asynchronously
        prisma.mcpServer.update({
          where: { id: s.id },
          data: { status: 'unreachable' },
        }).catch(() => {});
      }
    }

    return aggregatedTools;
  }

  /**
   * Route tool execution to appropriate upstream server
   */
  async callTool(namespacedToolName: string, args: any): Promise<{ result: any; serverId: string; toolName: string }> {
    const separatorIdx = namespacedToolName.indexOf('__');
    if (separatorIdx === -1) {
      throw new Error(`Invalid tool name format: "${namespacedToolName}". Expected "{server_slug}__{tool_name}"`);
    }

    const serverSlug = namespacedToolName.substring(0, separatorIdx);
    const originalToolName = namespacedToolName.substring(separatorIdx + 2);

    const server = await prisma.mcpServer.findUnique({
      where: { slug: serverSlug },
    });

    if (!server) {
      throw new Error(`Upstream server with slug "${serverSlug}" not found`);
    }

    if (!server.enabled) {
      throw new Error(`Server "${serverSlug}" is currently disabled`);
    }

    const result = await this.jsonRpcCall(server, 'tools/call', {
      name: originalToolName,
      arguments: args || {},
    });

    return {
      result,
      serverId: server.id,
      toolName: originalToolName,
    };
  }

  /**
   * Health ping an upstream server
   */
  async pingServer(server: {
    id: string;
    slug: string;
    url: string;
    credentialHeader?: string | null;
    credentialValueEncrypted?: string | null;
  }): Promise<boolean> {
    try {
      await this.jsonRpcCall(server, 'tools/list');
      return true;
    } catch (_) {
      return false;
    }
  }
}

export const upstreamManager = new UpstreamManager();
