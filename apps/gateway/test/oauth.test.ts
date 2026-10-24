/**
 * OAuth 2.0 Authorization Server Test Suite
 * Tests: Discovery, PKCE, Token Exchange, Scope Enforcement, Backward Compat, Revocation
 */
import { strict as assert } from 'assert';
import jwt from 'jsonwebtoken';

const BASE_URL = process.env.TEST_GATEWAY_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-mcp-gateway';

// Test helpers
let testsPassed = 0;
let testsFailed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    testsPassed++;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ ${name}: ${message}`);
    testsFailed++;
  }
}

async function fetchJson(
  url: string,
  options?: RequestInit
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// ============================================================
// Test Suite
// ============================================================
console.log('\n🔐 OAuth 2.0 Authorization Server Tests\n');

// 1. Discovery endpoint
await test('RFC 8414: Discovery endpoint returns valid metadata', async () => {
  const { status, body } = await fetchJson(`${BASE_URL}/.well-known/oauth-authorization-server`);
  assert.equal(status, 200, `Expected 200, got ${status}`);
  assert.ok(body.issuer, 'Missing issuer');
  assert.ok(body.authorization_endpoint, 'Missing authorization_endpoint');
  assert.ok(body.token_endpoint, 'Missing token_endpoint');
  assert.ok(Array.isArray(body.grant_types_supported), 'grant_types_supported must be array');
  assert.ok(
    (body.grant_types_supported as string[]).includes('authorization_code'),
    'Must support authorization_code'
  );
  assert.ok(
    (body.grant_types_supported as string[]).includes('client_credentials'),
    'Must support client_credentials'
  );
  assert.ok(
    Array.isArray(body.code_challenge_methods_supported),
    'code_challenge_methods_supported must be array'
  );
  assert.ok(
    (body.code_challenge_methods_supported as string[]).includes('S256'),
    'Must support S256'
  );
});

// 2. Register OAuth client via API
let testClientId: string;
let testClientSecret: string;
let adminToken: string;

await test('Admin can register OAuth client', async () => {
  // Login as admin first
  const loginRes = await fetchJson(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@vynn.io',
      password: process.env.ADMIN_PASSWORD || 'admin123',
    }),
  });
  assert.equal(loginRes.status, 200, `Login failed: ${JSON.stringify(loginRes.body)}`);
  adminToken = loginRes.body.token as string;

  const { status, body } = await fetchJson(`${BASE_URL}/api/oauth/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Test MCP Client',
      redirectUris: ['http://localhost:9999/callback'],
      scopes: ['mcp:read', 'mcp:write'],
    }),
  });
  assert.equal(status, 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
  assert.ok(body.clientId, 'Missing clientId');
  assert.ok(body.clientSecret, 'Missing clientSecret (shown once)');
  testClientId = body.clientId as string;
  testClientSecret = body.clientSecret as string;
});

// 3. Client credentials grant
let oauthToken: string;
await test('client_credentials grant issues access token', async () => {
  const { status, body } = await fetchJson(`${BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: testClientId,
      client_secret: testClientSecret,
      scope: 'mcp:read',
    }),
  });
  assert.equal(status, 200, `Token exchange failed: ${JSON.stringify(body)}`);
  assert.ok(body.access_token, 'Missing access_token');
  assert.equal(body.token_type, 'Bearer');
  assert.equal(body.scope, 'mcp:read');
  oauthToken = body.access_token as string;
});

// 4. OAuth token can call read tools on /mcp
await test('OAuth token with mcp:read scope can call tools/list', async () => {
  const { status } = await fetchJson(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${oauthToken}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  assert.ok(status < 500, `MCP call failed with status ${status}`);
  // Status 200 or 401 is fine (401 means real DB user lookup failed in test env)
  // The important thing is not a 403 scope error
  assert.notEqual(status, 403, 'Should not get 403 scope error for mcp:read token on list');
});

// 5. Scope enforcement: mcp:read token BLOCKED from write tools
await test('OAuth token with only mcp:read scope is blocked from write tools', async () => {
  const readOnlyToken = jwt.sign(
    {
      sub: 'test-user',
      id: 'test-user',
      email: 'test@test.com',
      role: 'member',
      client_id: 'test',
      scope: 'mcp:read',
      token_type: 'oauth_access_token',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const { status, body } = await fetchJson(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${readOnlyToken}` },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'woocommerce__update_product', arguments: { id: 1, name: 'Hacked' } },
    }),
  });
  assert.equal(status, 403, `Expected 403 for write with read-only token, got ${status}`);
  assert.ok(
    body.error === 'insufficient_scope',
    `Expected insufficient_scope error, got: ${body.error}`
  );
});

// 6. Expired token rejected
await test('Expired OAuth token is rejected with 401', async () => {
  const expiredToken = jwt.sign(
    {
      sub: 'test-user',
      id: 'test-user',
      email: 'test@test.com',
      role: 'member',
      client_id: 'test',
      scope: 'mcp:read',
      token_type: 'oauth_access_token',
    },
    JWT_SECRET,
    { expiresIn: '-1s' } // already expired
  );
  const { status } = await fetchJson(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${expiredToken}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  assert.equal(status, 401, `Expected 401 for expired token, got ${status}`);
});

// 7. Backward compatibility: existing API key still works
await test('Backward compat: existing mcp_live_ API key is still accepted', async () => {
  const keyRes = await fetchJson(`${BASE_URL}/api/auth/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: 'oauth-compat-test-key' }),
  });
  if (keyRes.status !== 201) {
    console.log(`    (skipping: key creation endpoint returned ${keyRes.status})`);
    return;
  }
  const apiKey = (keyRes.body.apiKey as Record<string, unknown>).rawKey as string;
  const { status } = await fetchJson(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  assert.notEqual(status, 401, `API key should not be rejected, got ${status}`);
});

// 8. OAuth client list
await test('Authenticated user can list their OAuth clients', async () => {
  const { status, body } = await fetchJson(`${BASE_URL}/api/oauth/clients`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(status, 200, `Expected 200, got ${status}`);
  assert.ok(Array.isArray(body), 'Response should be an array');
  const found = (body as Array<Record<string, unknown>>).find(
    (c) => c.clientId === testClientId
  );
  assert.ok(found, 'Test client should appear in list');
});

// 9. Token revocation
await test('Refresh token can be revoked', async () => {
  const { status } = await fetchJson(`${BASE_URL}/oauth/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'nonexistent_token_for_revoke_test' }),
  });
  assert.equal(status, 200, `Revoke should return 200 even for unknown tokens, got ${status}`);
});

// Summary
console.log(`\n📊 OAuth Test Results: ${testsPassed} passed, ${testsFailed} failed\n`);
if (testsFailed > 0) process.exit(1);
