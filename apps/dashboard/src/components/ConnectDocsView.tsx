import React, { useState } from 'react';
import {
  Copy,
  Check,
  ShieldCheck,
  Key,
  Globe,
  Terminal,
  Code,
  Sparkles,
  Layers
} from 'lucide-react';

interface ConnectDocsViewProps {
  user: { id: string; email: string; name: string; role: 'admin' | 'member' };
  onNavigateToTab?: (tab: 'keys' | 'oauth') => void;
}

export const ConnectDocsView: React.FC<ConnectDocsViewProps> = ({ user: _user, onNavigateToTab }) => {
  const [activeClient, setActiveClient] = useState<'chatgpt' | 'claude' | 'cursor' | 'sdk' | 'curl'>('chatgpt');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const origin = window.location.origin;
  const gatewayUrl = origin.includes('localhost') ? 'https://vynn.urbackend.in' : origin;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={() => handleCopy(text, id)}
      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-mono transition"
      title="Copy to clipboard"
    >
      {copiedKey === id ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 border border-zinc-800 rounded-xl p-5 sm:p-7 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Universal MCP Hub</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Connect External AI to VYNN MCP Gateway
            </h1>
            <p className="text-sm text-zinc-400 max-w-2xl">
              Connect ChatGPT, Claude, Cursor, LibreChat, or custom agents to WooCommerce & upstream tools using standard{' '}
              <span className="text-zinc-200 font-medium">OAuth 2.0 (RFC 8414 + PKCE)</span> or{' '}
              <span className="text-zinc-200 font-medium">Bearer API Keys</span>.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onNavigateToTab && (
              <>
                <button
                  onClick={() => onNavigateToTab('oauth')}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium flex items-center space-x-1.5 transition"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Create OAuth App</span>
                </button>
                <button
                  onClick={() => onNavigateToTab('keys')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-medium flex items-center space-x-1.5 transition"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Get API Key</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Client Platform Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-zinc-800">
        {[
          { id: 'chatgpt', label: 'ChatGPT Web / Actions', icon: Globe },
          { id: 'claude', label: 'Claude Desktop', icon: Terminal },
          { id: 'cursor', label: 'Cursor / Windsurf IDE', icon: Code },
          { id: 'sdk', label: 'Python & Node.js SDK', icon: Layers },
          { id: 'curl', label: 'cURL & Direct HTTP', icon: Terminal },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeClient === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveClient(tab.id as any)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-t-lg text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-orange-500 bg-zinc-900 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-orange-400' : 'text-zinc-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: ChatGPT */}
      {activeClient === 'chatgpt' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <span>Connecting to ChatGPT (Custom GPT / Actions)</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    OAuth 2.0 Ready
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  ChatGPT Custom GPTs natively support standard OAuth 2.0 authorization code flow.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-4 space-y-3">
                <div className="text-xs font-semibold text-zinc-200 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-[10px] font-mono">1</span>
                  <span>Register ChatGPT App in Dashboard</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Go to <strong className="text-zinc-200">OAuth Apps</strong> tab and click <strong className="text-zinc-200">New Application</strong>.
                </p>
                <div className="space-y-1.5 text-xs">
                  <div className="text-zinc-400">ChatGPT Redirect URI:</div>
                  <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded font-mono text-[11px] text-zinc-300">
                    <span className="truncate">https://chatgpt.com/aip/g-.../oauth/callback</span>
                    <CopyButton text="https://chatgpt.com/aip/plugin-oauth/callback" id="gpt-redirect" />
                  </div>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-4 space-y-3">
                <div className="text-xs font-semibold text-zinc-200 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-[10px] font-mono">2</span>
                  <span>Configure GPT Action Authentication</span>
                </div>
                <p className="text-xs text-zinc-400">
                  In GPT Builder &rarr; Configure &rarr; Actions &rarr; Authentication, select <strong className="text-zinc-200">OAuth</strong>:
                </p>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Auth Type:</span>
                    <span className="text-white">OAuth</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Authorization URL:</span>
                    <CopyButton text={`${gatewayUrl}/oauth/authorize`} id="gpt-auth-url" />
                  </div>
                  <div className="text-[11px] text-orange-300/90 break-all">{gatewayUrl}/oauth/authorize</div>
                  <div className="flex items-center justify-between text-zinc-400 pt-1">
                    <span>Token URL:</span>
                    <CopyButton text={`${gatewayUrl}/oauth/token`} id="gpt-token-url" />
                  </div>
                  <div className="text-[11px] text-orange-300/90 break-all">{gatewayUrl}/oauth/token</div>
                  <div className="flex items-center justify-between text-zinc-400 pt-1">
                    <span>Scope:</span>
                    <span className="text-zinc-200">mcp:read mcp:write</span>
                  </div>
                </div>
              </div>
            </div>

            {/* OpenAPI / Action Schema */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-200 flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-[10px] font-mono">3</span>
                  <span>OpenAPI Schema for ChatGPT Action</span>
                </span>
                <CopyButton
                  text={JSON.stringify({
                    openapi: '3.1.0',
                    info: { title: 'VYNN MCP Gateway', version: '1.0.0', description: 'Universal MCP Hub for WooCommerce, Notes, and FakeStore' },
                    servers: [{ url: gatewayUrl }],
                    paths: {
                      '/mcp': {
                        post: {
                          operationId: 'callMcp',
                          summary: 'Execute MCP JSON-RPC protocol methods or tools',
                          requestBody: {
                            required: true,
                            content: {
                              'application/json': {
                                schema: {
                                  type: 'object',
                                  properties: {
                                    jsonrpc: { type: 'string', example: '2.0' },
                                    id: { type: 'integer', example: 1 },
                                    method: { type: 'string', example: 'tools/call' },
                                    params: { type: 'object' }
                                  },
                                  required: ['jsonrpc', 'method']
                                }
                              }
                            }
                          },
                          responses: {
                            '200': { description: 'Successful JSON-RPC result' },
                            '401': { description: 'Unauthorized' },
                            '403': { description: 'Insufficient Scope' }
                          }
                        }
                      }
                    }
                  }, null, 2)}
                  id="gpt-schema"
                />
              </div>
              <div className="bg-black border border-zinc-850 rounded-lg p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto max-h-48">
                <pre>{`openapi: 3.1.0
info:
  title: VYNN MCP Gateway
  version: 1.0.0
servers:
  - url: ${gatewayUrl}
paths:
  /mcp:
    post:
      operationId: callMcp
      summary: Execute MCP protocol tools (WooCommerce, Store, Notes)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                jsonrpc: { type: string, example: "2.0" }
                id: { type: integer, example: 1 }
                method: { type: string, example: "tools/call" }
                params: { type: object }
              required: [jsonrpc, method]`}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Claude Desktop */}
      {activeClient === 'claude' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <span>Connecting to Claude Desktop</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Streamable HTTP
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Claude Desktop connects directly using standard MCP over Streamable HTTP or through the official remote MCP bridge.
              </p>
            </div>

            <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-200">
                  Configuration File: <code className="text-orange-400 font-mono">claude_desktop_config.json</code>
                </div>
                <CopyButton
                  text={JSON.stringify({
                    mcpServers: {
                      'vynn-gateway': {
                        command: 'npx',
                        args: [
                          '-y',
                          'mcp-remote',
                          `${gatewayUrl}/mcp`,
                          '--header',
                          'Authorization: Bearer mcp_live_YOUR_API_KEY_HERE'
                        ]
                      }
                    }
                  }, null, 2)}
                  id="claude-config"
                />
              </div>

              <div className="bg-black border border-zinc-850 rounded-lg p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto">
                <pre>{`{
  "mcpServers": {
    "vynn-gateway": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${gatewayUrl}/mcp",
        "--header",
        "Authorization: Bearer mcp_live_YOUR_API_KEY_HERE"
      ]
    }
  }
}`}</pre>
              </div>

              <div className="space-y-1.5 text-xs text-zinc-400 pt-1">
                <div className="font-medium text-zinc-300">File location:</div>
                <div className="font-mono text-[11px] text-zinc-400">
                  • <strong>macOS:</strong> ~/Library/Application Support/Claude/claude_desktop_config.json
                </div>
                <div className="font-mono text-[11px] text-zinc-400">
                  • <strong>Windows:</strong> %APPDATA%\Claude\claude_desktop_config.json
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Cursor & Windsurf */}
      {activeClient === 'cursor' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <span>Connecting to Cursor / Windsurf IDE</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  SSE / Streamable HTTP
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Add VYNN Gateway in Cursor Settings &rarr; Features &rarr; MCP Servers or via project-level config.
              </p>
            </div>

            <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-200">
                  File: <code className="text-orange-400 font-mono">.cursor/mcp.json</code>
                </div>
                <CopyButton
                  text={JSON.stringify({
                    mcpServers: {
                      'vynn-gateway': {
                        url: `${gatewayUrl}/mcp`,
                        headers: {
                          Authorization: 'Bearer mcp_live_YOUR_API_KEY_HERE'
                        }
                      }
                    }
                  }, null, 2)}
                  id="cursor-config"
                />
              </div>

              <div className="bg-black border border-zinc-850 rounded-lg p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto">
                <pre>{`{
  "mcpServers": {
    "vynn-gateway": {
      "url": "${gatewayUrl}/mcp",
      "headers": {
        "Authorization": "Bearer mcp_live_YOUR_API_KEY_HERE"
      }
    }
  }
}`}</pre>
              </div>

              <div className="text-xs text-zinc-400">
                Cursor will automatically discover all 11+ aggregated WooCommerce and upstream tools in Composer and Agent modes!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Python & Node.js SDK */}
      {activeClient === 'sdk' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">
                Programmatic Integration (Python & TypeScript MCP SDK)
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Call tools directly from autonomous scripts or server-side agents.
              </p>
            </div>

            {/* TypeScript Example */}
            <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">TypeScript / Node.js MCP SDK</span>
                <CopyButton
                  text={`import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
  new URL("${gatewayUrl}/mcp"),
  {
    headers: {
      Authorization: "Bearer mcp_live_YOUR_API_KEY"
    }
  }
);

const client = new Client({ name: "my-app", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);

// List tools
const tools = await client.listTools();
console.log("Tools available:", tools);

// Execute tool
const result = await client.callTool({
  name: "woocommerce__list_products",
  arguments: { per_page: 5 }
});
console.log("Products:", result);`}
                  id="ts-sdk"
                />
              </div>
              <div className="bg-black border border-zinc-850 rounded-lg p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto">
                <pre>{`import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
  new URL("${gatewayUrl}/mcp"),
  { headers: { Authorization: "Bearer mcp_live_YOUR_API_KEY" } }
);

const client = new Client({ name: "my-app", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);

const products = await client.callTool({
  name: "woocommerce__list_products",
  arguments: { per_page: 5 }
});`}</pre>
              </div>
            </div>

            {/* Python Example */}
            <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">Python MCP SDK</span>
                <CopyButton
                  text={`import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client

async def main():
    headers = {"Authorization": "Bearer mcp_live_YOUR_API_KEY"}
    async with sse_client("${gatewayUrl}/mcp", headers=headers) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            print("Tools:", [t.name for t in tools.tools])

asyncio.run(main())`}
                  id="py-sdk"
                />
              </div>
              <div className="bg-black border border-zinc-850 rounded-lg p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto">
                <pre>{`import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client

async def main():
    headers = {"Authorization": "Bearer mcp_live_YOUR_API_KEY"}
    async with sse_client("${gatewayUrl}/mcp", headers=headers) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            print("Connected tools:", [t.name for t in tools.tools])

asyncio.run(main())`}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: cURL & Direct HTTP */}
      {activeClient === 'curl' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/80 border border-zinc-850 rounded-xl p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">Direct Terminal & cURL Examples</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Test and execute MCP commands directly in terminal using standard JSON-RPC 2.0.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">1. List Available Tools (`tools/list`)</span>
                  <CopyButton
                    text={`curl -X POST ${gatewayUrl}/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer mcp_live_YOUR_KEY" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`}
                    id="curl-list"
                  />
                </div>
                <div className="bg-black border border-zinc-850 rounded-lg p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto">
                  <pre>{`curl -X POST ${gatewayUrl}/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer mcp_live_YOUR_KEY" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`}</pre>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">2. Execute WooCommerce Tool (`tools/call`)</span>
                  <CopyButton
                    text={`curl -X POST ${gatewayUrl}/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer mcp_live_YOUR_KEY" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "woocommerce__list_products",
      "arguments": { "per_page": 3 }
    }
  }'`}
                    id="curl-call"
                  />
                </div>
                <div className="bg-black border border-zinc-850 rounded-lg p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto">
                  <pre>{`curl -X POST ${gatewayUrl}/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer mcp_live_YOUR_KEY" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "woocommerce__list_products",
      "arguments": { "per_page": 3 }
    }
  }'`}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security & Scopes Reference Table */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
          <ShieldCheck className="w-4 h-4 text-orange-400" />
          <span>Security & Guardrails Reference</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-3">
            <div className="font-mono text-xs text-emerald-400 font-semibold">mcp:read</div>
            <div className="text-[11px] text-zinc-400 mt-1">
              Read operations only: `list_products`, `get_product`, `list_orders`, `list_notes`, `list_categories`.
            </div>
          </div>
          <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-3">
            <div className="font-mono text-xs text-indigo-400 font-semibold">mcp:write</div>
            <div className="text-[11px] text-zinc-400 mt-1">
              Mutating operations: `create_product`, `update_product`, `update_order_status`, `create_note`. Enforced by RBAC.
            </div>
          </div>
          <div className="bg-zinc-950 border border-zinc-850 rounded-lg p-3">
            <div className="font-mono text-xs text-amber-400 font-semibold">mcp:admin + HITL</div>
            <div className="text-[11px] text-zinc-400 mt-1">
              Destructive actions: `delete_product`, `delete_note`. Requires Human-In-The-Loop explicit target confirmation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
