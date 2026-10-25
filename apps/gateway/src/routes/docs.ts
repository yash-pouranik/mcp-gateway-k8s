import { Router, Request, Response } from 'express';

const router = Router();
const ISSUER = process.env.OAUTH_ISSUER || 'https://vynn.urbackend.in';

router.get(['/docs', '/api/docs'], (_req: Request, res: Response): void => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect External AI — VYNN MCP Gateway Documentation</title>
  <link rel="icon" href="/vynn_ai_logo.png" type="image/png">
  <style>
    :root {
      --bg: #09090b;
      --card-bg: #121215;
      --card-sub: #18181c;
      --border: #27272a;
      --text: #f4f4f5;
      --text-muted: #a1a1aa;
      --orange: #f97316;
      --code-bg: #050507;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 24px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      background: rgba(249, 115, 22, 0.12);
      border: 1px solid rgba(249, 115, 22, 0.3);
      color: #fb923c;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 12px;
      letter-spacing: 0.04em;
    }
    h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }
    p.lead {
      color: var(--text-muted);
      font-size: 15px;
    }
    .section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    h2 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h3 {
      font-size: 14px;
      font-weight: 600;
      color: #e4e4e7;
      margin: 16px 0 8px 0;
    }
    pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: #38bdf8;
      overflow-x: auto;
      margin: 8px 0 16px 0;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, monospace;
      background: rgba(255,255,255,0.06);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      color: #fb923c;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 12px 0;
    }
    @media (max-width: 640px) {
      .grid { grid-template-columns: 1fr; }
    }
    .info-box {
      background: var(--card-sub);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
    }
    .info-box strong {
      display: block;
      color: #fff;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .info-box p {
      color: var(--text-muted);
      font-size: 12px;
    }
    .tag {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }
    footer {
      text-align: center;
      color: var(--text-muted);
      font-size: 12px;
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <span class="badge">INTEGRATION GUIDE · RFC 9728 & OAUTH 2.0</span>
      <h1>Connecting External AI to VYNN MCP Gateway</h1>
      <p class="lead">
        Step-by-step instructions to connect Claude Web, ChatGPT, Claude Desktop, Cursor, and custom autonomous agents to your WooCommerce store and upstream MCP tools.
      </p>
    </header>

    <!-- RBAC Banner -->
    <div style="background: rgba(249, 115, 22, 0.08); border: 1px solid rgba(249, 115, 22, 0.25); border-radius: 10px; padding: 16px; margin-bottom: 24px;">
      <strong style="color: #fb923c; font-size: 13px; display: block; margin-bottom: 4px;">Role-Based Access Control (RBAC) Governed</strong>
      <p style="color: #d4d4d8; font-size: 12px; margin: 0;">
        Whichever client or protocol you connect, actual permissions are strictly determined by your user account role: 
        <strong>Admin</strong> accounts receive full operational access (Read + Write + Delete). 
        <strong>Member</strong> accounts are automatically capped to read-only tools regardless of requested scopes.
      </p>
    </div>

    <!-- Section 1: Claude Web -->
    <div class="section">
      <h2>Claude Web (claude.ai Custom Connectors) <span class="tag">1-Click OAuth 2.0</span></h2>
      <p style="color: var(--text-muted); font-size: 13px;">
        Claude Web natively discovers tools and authenticates via RFC 9728 Protected Resource metadata. Zero configuration files needed!
      </p>

      <div class="grid">
        <div class="info-box">
          <strong>Step 1: Open Claude Connectors</strong>
          <p>In <a href="https://claude.ai" target="_blank" style="color: #38bdf8;">claude.ai</a>, open <code>Settings &rarr; Connectors</code> (or click the plug icon in any chat), then select <code>Add custom connector</code>.</p>
        </div>
        <div class="info-box">
          <strong>Step 2: Enter Server Endpoint</strong>
          <p>Name: <code>VYNN Gateway</code><br/>URL:</p>
          <pre>${ISSUER}/mcp</pre>
        </div>
      </div>
      <p style="color: var(--text-muted); font-size: 12px; margin-top: 8px;">
        Claude will automatically redirect you to our login screen. Sign in with your gateway credentials and click <strong>Allow Access</strong>. Claude will immediately discover all 11+ WooCommerce and upstream tools.
      </p>
    </div>

    <!-- Section 2: ChatGPT -->
    <div class="section">
      <h2>ChatGPT (Web Custom GPTs & Actions) <span class="tag">OAuth 2.0 + PKCE</span></h2>
      <p style="color: var(--text-muted); font-size: 13px;">
        ChatGPT Custom GPTs connect via OAuth 2.0 authorization code flow with persistent refresh tokens (<code>offline_access</code>).
      </p>

      <div class="grid">
        <div class="info-box">
          <strong>Step 1: Create OAuth Client in Dashboard</strong>
          <p>Go to Dashboard &rarr; <code>Access &rarr; OAuth Apps</code> &rarr; <code>New Application</code>. Set Redirect URI:</p>
          <pre>https://chatgpt.com/aip/plugin-oauth/callback</pre>
        </div>
        <div class="info-box">
          <strong>Step 2: Configure GPT Action Auth</strong>
          <p>In GPT Editor &rarr; Actions &rarr; Authentication &rarr; select <code>OAuth</code>:</p>
          <p style="font-size: 11px; font-family: monospace; color: #a1a1aa; margin-top: 6px;">
            • Auth URL: ${ISSUER}/oauth/authorize<br/>
            • Token URL: ${ISSUER}/oauth/token<br/>
            • Scope: mcp:read mcp:write offline_access
          </p>
        </div>
      </div>

      <h3>OpenAPI Action Schema for ChatGPT</h3>
      <pre>{
  "openapi": "3.1.0",
  "info": { "title": "VYNN MCP Gateway", "version": "1.0.0" },
  "servers": [{ "url": "${ISSUER}" }],
  "paths": {
    "/mcp": {
      "post": {
        "operationId": "callMcp",
        "summary": "Execute MCP tools (WooCommerce, Store, Notes)",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "jsonrpc": { "type": "string", "example": "2.0" },
                  "id": { "type": "integer", "example": 1 },
                  "method": { "type": "string", "example": "tools/call" },
                  "params": { "type": "object" }
                },
                "required": ["jsonrpc", "method"]
              }
            }
          }
        },
        "responses": {
          "200": { "description": "JSON-RPC tool result" }
        }
      }
    }
  }
}</pre>
    </div>

    <!-- Section 3: Claude Desktop & Claude Code -->
    <div class="section">
      <h2>Claude Desktop & Claude Code (CLI) <span class="tag">Streamable HTTP</span></h2>
      <h3>Method 1: Claude Code CLI (1-line setup)</h3>
      <pre>claude mcp add --transport http vynn-gateway ${ISSUER}/mcp --header "Authorization: Bearer mcp_live_YOUR_API_KEY"</pre>

      <h3>Method 2: Claude Desktop Config</h3>
      <p style="color: var(--text-muted); font-size: 13px;">
        Add the gateway configuration to your <code>claude_desktop_config.json</code>:
      </p>

      <pre>{
  "mcpServers": {
    "vynn-gateway": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${ISSUER}/mcp",
        "--header",
        "Authorization: Bearer mcp_live_YOUR_API_KEY_HERE"
      ]
    }
  }
}</pre>
      <p style="color: var(--text-muted); font-size: 12px;">
        Configuration file location:
        <br/>• <strong>Windows:</strong> <code>%APPDATA%\\Claude\\claude_desktop_config.json</code>
        <br/>• <strong>macOS:</strong> <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>
      </p>
    </div>

    <!-- Section 3: Cursor / Windsurf -->
    <div class="section">
      <h2>Cursor & Windsurf IDE <span class="tag">Direct MCP</span></h2>
      <p style="color: var(--text-muted); font-size: 13px;">
        Add to <code>.cursor/mcp.json</code> in your project or Cursor MCP Settings:
      </p>
      <pre>{
  "mcpServers": {
    "vynn-gateway": {
      "url": "${ISSUER}/mcp",
      "headers": {
        "Authorization": "Bearer mcp_live_YOUR_API_KEY_HERE"
      }
    }
  }
}</pre>
    </div>

    <!-- Section 4: Python & Node.js SDK -->
    <div class="section">
      <h2>Python & Node.js MCP SDK</h2>
      <h3>Node.js / TypeScript Example</h3>
      <pre>import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
  new URL("${ISSUER}/mcp"),
  { headers: { Authorization: "Bearer mcp_live_YOUR_API_KEY" } }
);

const client = new Client({ name: "my-agent", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);

const products = await client.callTool({
  name: "woocommerce__list_products",
  arguments: { per_page: 5 }
});
console.log(products);</pre>

      <h3>Python Example</h3>
      <pre>import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client

async def main():
    headers = {"Authorization": "Bearer mcp_live_YOUR_API_KEY"}
    async with sse_client("${ISSUER}/mcp", headers=headers) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool("woocommerce__list_products", {"per_page": 5})
            print(result)

async def run():
    await main()

asyncio.run(main())</pre>
    </div>

    <!-- Section 5: cURL -->
    <div class="section">
      <h2>Terminal & cURL Test</h2>
      <pre>curl -X POST ${ISSUER}/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer mcp_live_YOUR_API_KEY" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "woocommerce__list_products",
      "arguments": { "per_page": 3 }
    }
  }'</pre>
    </div>

    <footer>
      VYNN MCP Gateway · Production Multi-Tenant Kubernetes Hub
    </footer>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
