/**
 * Demo: External OAuth Client connecting to VYNN MCP Gateway
 * Simulates how ChatGPT / Claude Web would connect via OAuth
 *
 * Usage:
 *   DEMO_CLIENT_ID=mcp_client_xxx DEMO_CLIENT_SECRET=mcp_secret_yyy tsx scripts/demo-oauth-client.ts
 */
import crypto from 'crypto';

const GATEWAY_URL = process.env.GATEWAY_URL || 'https://vynn.urbackend.in';
const CLIENT_ID = process.env.DEMO_CLIENT_ID || '';
const CLIENT_SECRET = process.env.DEMO_CLIENT_SECRET || '';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Set DEMO_CLIENT_ID and DEMO_CLIENT_SECRET environment variables');
  console.error('   Create a client first via: POST /api/oauth/clients');
  process.exit(1);
}

// Suppress unused import warning — crypto is available in Node built-in
void crypto;

async function main(): Promise<void> {
  console.log('\n🤖 VYNN MCP Gateway — OAuth External Client Demo\n');
  console.log(`Gateway: ${GATEWAY_URL}\n`);

  // Step 1: Discover OAuth metadata
  console.log('Step 1: Discovering OAuth metadata (RFC 8414)...');
  const discoveryRes = await fetch(`${GATEWAY_URL}/.well-known/oauth-authorization-server`);
  const metadata = (await discoveryRes.json()) as Record<string, unknown>;
  console.log(`  ✅ Issuer: ${metadata.issuer}`);
  console.log(`  ✅ Token endpoint: ${metadata.token_endpoint}`);
  console.log(`  ✅ Scopes supported: ${(metadata.scopes_supported as string[])?.join(', ')}\n`);

  // Step 2: Client Credentials Grant (M2M — like Codex CLI or a server-side integration)
  console.log('Step 2: Obtaining access token via client_credentials grant...');
  const tokenRes = await fetch(`${GATEWAY_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'mcp:read mcp:write',
    }),
  });
  const tokenData = (await tokenRes.json()) as Record<string, unknown>;

  if (!tokenData.access_token) {
    console.error('❌ Token exchange failed:', tokenData);
    process.exit(1);
  }

  const accessToken = tokenData.access_token as string;
  console.log(`  ✅ Access token obtained (type: ${tokenData.token_type})`);
  console.log(`  ✅ Scope granted: ${tokenData.scope}`);
  console.log(`  ✅ Expires in: ${tokenData.expires_in}s\n`);

  // Step 3: List MCP tools
  console.log('Step 3: Listing available MCP tools with OAuth Bearer token...');
  const toolsRes = await fetch(`${GATEWAY_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  const toolsData = (await toolsRes.json()) as Record<string, unknown>;
  const toolsResult = toolsData.result as Record<string, unknown> | undefined;

  if (toolsResult?.tools) {
    const tools = toolsResult.tools as Array<Record<string, unknown>>;
    console.log(`  ✅ ${tools.length} tools available via OAuth:`);
    tools.slice(0, 5).forEach((t) => console.log(`     - ${t.name}`));
    if (tools.length > 5) console.log(`     ... and ${tools.length - 5} more`);
  } else {
    console.log(
      `  Response (status ${toolsRes.status}):`,
      JSON.stringify(toolsData).slice(0, 200)
    );
  }

  // Step 4: Call woocommerce__list_products
  console.log('\nStep 4: Calling woocommerce__list_products via OAuth token...');
  const mcpRes = await fetch(`${GATEWAY_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'woocommerce__list_products', arguments: { per_page: 3 } },
    }),
  });
  const mcpData = (await mcpRes.json()) as Record<string, unknown>;
  console.log(`  Status: ${mcpRes.status}`);
  if (mcpData.result) {
    console.log(
      `  ✅ Tool call succeeded! Response snippet:`,
      JSON.stringify(mcpData.result).slice(0, 200)
    );
  } else {
    console.log(`  Response:`, JSON.stringify(mcpData).slice(0, 300));
  }

  console.log('\n✅ OAuth demo complete! Check dashboard audit log for "authType: oauth" attribution.\n');
}

main().catch(console.error);
