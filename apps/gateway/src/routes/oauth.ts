import { Router, Request, Response } from 'express';
import express from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { requireUserAuth } from '../middleware/auth.js';
import {
  generateAuthCode,
  validateAndConsumeAuthCode,
  issueAccessToken,
  issueRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  hashToken,
  generateSecureToken,
} from '../services/oauthService.js';

const router = Router();

const ISSUER = process.env.OAUTH_ISSUER || 'https://vynn.urbackend.in';

// Middleware for URL-encoded form bodies (POST /oauth/authorize)
const urlencodedParser = express.urlencoded({ extended: false });

/**
 * Flexible redirect URI matcher:
 * Handles exact matches, ChatGPT dynamic callback URLs, and wildcard prefixes.
 */
function isAllowedRedirectUri(registeredUris: string[], requestedUri: string): boolean {
  if (!requestedUri) return false;
  if (registeredUris.includes(requestedUri)) return true;

  for (const reg of registeredUris) {
    // If registered is chatgpt.com or starts with chatgpt.com
    if (reg.includes('chatgpt.com') && requestedUri.includes('chatgpt.com/aip/')) {
      return true;
    }
    // Prefix wildcard support (e.g. https://chatgpt.com/*)
    if (reg.endsWith('*') && requestedUri.startsWith(reg.slice(0, -1))) {
      return true;
    }
    // Match base URL without query/hash
    try {
      const regUrl = new URL(reg);
      const reqUrl = new URL(requestedUri);
      if (regUrl.origin === reqUrl.origin && reqUrl.pathname.startsWith(regUrl.pathname)) {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * Extract client_id and client_secret from both:
 *  1. HTTP Basic Auth header (client_secret_basic)
 *  2. Request body / query (client_secret_post)
 */
function extractClientCredentials(req: Request): { clientId?: string; clientSecret?: string } {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('basic ')) {
    try {
      const b64 = authHeader.substring(6).trim();
      const decoded = Buffer.from(b64, 'base64').toString('utf-8');
      const idx = decoded.indexOf(':');
      if (idx !== -1) {
        return {
          clientId: decodeURIComponent(decoded.substring(0, idx)),
          clientSecret: decodeURIComponent(decoded.substring(idx + 1)),
        };
      }
    } catch {
      // ignore
    }
  }

  const clientId = (req.body?.client_id || req.query?.client_id) as string | undefined;
  const clientSecret = (req.body?.client_secret || req.query?.client_secret) as string | undefined;
  return { clientId, clientSecret };
}

// ============================================================
// RFC 9728: OAuth 2.0 Protected Resource Metadata (PUBLIC - no auth)
// Used by Claude Custom Connectors and Model Context Protocol clients
// ============================================================
router.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response): void => {
  res.json({
    resource: `${ISSUER}/mcp`,
    authorization_servers: [ISSUER],
    scopes_supported: ['mcp:read', 'mcp:write', 'mcp:admin', 'offline_access'],
    bearer_methods_supported: ['header'],
    resource_documentation: `${ISSUER}/docs`,
  });
});

// ============================================================
// RFC 8414: Discovery Endpoint (PUBLIC - no auth)
// ============================================================
router.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response): void => {
  res.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/oauth/authorize`,
    token_endpoint: `${ISSUER}/oauth/token`,
    registration_endpoint: `${ISSUER}/oauth/register`,
    revocation_endpoint: `${ISSUER}/oauth/revoke`,
    userinfo_endpoint: `${ISSUER}/oauth/userinfo`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'client_credentials', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
    scopes_supported: ['mcp:read', 'mcp:write', 'mcp:admin', 'offline_access'],
    code_challenge_methods_supported: ['S256', 'plain'],
    service_documentation: `${ISSUER}/docs`,
  });
});

// Also serve at openid-configuration path for broader compatibility
router.get('/.well-known/openid-configuration', (_req: Request, res: Response): void => {
  res.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/oauth/authorize`,
    token_endpoint: `${ISSUER}/oauth/token`,
    registration_endpoint: `${ISSUER}/oauth/register`,
    revocation_endpoint: `${ISSUER}/oauth/revoke`,
    userinfo_endpoint: `${ISSUER}/oauth/userinfo`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'client_credentials', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
    scopes_supported: ['mcp:read', 'mcp:write', 'mcp:admin', 'offline_access'],
    code_challenge_methods_supported: ['S256', 'plain'],
  });
});

// ============================================================
// RFC 7591: Dynamic Client Registration (PUBLIC - used by Claude & ChatGPT)
// Allows AI clients to register themselves programmatically without manual client ID creation!
// ============================================================
router.post('/oauth/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { client_name, redirect_uris, grant_types, response_types, scope } = req.body as {
      client_name?: string;
      redirect_uris?: string[];
      grant_types?: string[];
      response_types?: string[];
      scope?: string;
    };

    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: 'redirect_uris array is required',
      });
      return;
    }

    // Associate dynamically registered clients with the admin user
    const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (!adminUser) {
      res.status(500).json({ error: 'server_error', error_description: 'No admin user configured' });
      return;
    }

    const clientId = `mcp_client_${generateSecureToken(8)}`;
    const clientSecret = `mcp_secret_${generateSecureToken(24)}`;
    const clientSecretHash = hashToken(clientSecret);
    const name = client_name || 'Dynamic MCP Client (Claude / ChatGPT)';
    const requestedScopes = scope ? scope.split(' ') : ['mcp:read', 'mcp:write'];

    const client = await prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecretHash,
        name,
        redirectUris: redirect_uris,
        scopes: requestedScopes,
        trusted: false,
        userId: adminUser.id,
      },
    });

    res.status(201).json({
      client_id: client.clientId,
      client_secret: clientSecret,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: grant_types || ['authorization_code', 'refresh_token'],
      response_types: response_types || ['code'],
      scope: client.scopes.join(' '),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0,
    });
  } catch (err) {
    console.error('Error in Dynamic Client Registration:', err);
    res.status(500).json({ error: 'server_error', error_description: 'Failed to dynamically register client' });
  }
});

// ============================================================
// GET /oauth/authorize — Show consent page (PUBLIC - no auth required for display)
// ============================================================
router.get('/oauth/authorize', async (req: Request, res: Response): Promise<void> => {
  const {
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method,
    response_type,
  } = req.query as Record<string, string>;

  if (response_type !== 'code') {
    res.status(400).json({
      error: 'unsupported_response_type',
      error_description: 'Only response_type=code is supported',
    });
    return;
  }
  if (!client_id || !redirect_uri) {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'client_id and redirect_uri are required',
    });
    return;
  }

  const client = await prisma.oAuthClient.findUnique({ where: { clientId: client_id } });
  if (!client) {
    res.status(400).json({ error: 'invalid_client', error_description: 'Unknown client_id' });
    return;
  }
  if (!isAllowedRedirectUri(client.redirectUris, redirect_uri)) {
    res.status(400).json({
      error: 'invalid_request',
      error_description: `redirect_uri '${redirect_uri}' not registered for this client. Registered: ${client.redirectUris.join(', ')}`,
    });
    return;
  }

  const requestedScope = scope || 'mcp:read';
  const scopeList = requestedScope.split(' ');
  const scopeBadges = scopeList
    .map((s: string) => {
      if (s === 'mcp:read') {
        return `<div class="scope-item"><span class="scope-tag scope-read">mcp:read</span><span class="scope-desc">Read tools (list products, orders, notes)</span></div>`;
      }
      if (s === 'mcp:write') {
        return `<div class="scope-item"><span class="scope-tag scope-write">mcp:write</span><span class="scope-desc">Write tools (create, update operations)</span></div>`;
      }
      if (s === 'mcp:admin') {
        return `<div class="scope-item"><span class="scope-tag scope-admin">mcp:admin</span><span class="scope-desc">Admin tools (delete with HITL guardrail)</span></div>`;
      }
      return `<div class="scope-item"><span class="scope-tag">${escapeHtml(s)}</span></div>`;
    })
    .join('');

  // Render consent HTML matching VYNN Dark Minimalist Design System
  const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize Connection — VYNN MCP Gateway</title>
  <link rel="icon" type="image/png" href="/vynn_ai_logo.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #000000;
      --card-bg: #09090b;
      --inner-bg: #18181b;
      --border: #27272a;
      --border-hover: #3f3f46;
      --text: #f4f4f5;
      --text-muted: #a1a1aa;
      --text-faint: #71717a;
      --cf-orange: #f38020;
      --cf-hover: #fa8c16;
      --cf-dark: #c45e0f;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 32px 28px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 1px 1px rgba(255, 255, 255, 0.05);
    }
    .brand-header {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo-box {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: var(--inner-bg);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 12px;
    }
    .logo-box img {
      width: 24px;
      height: 24px;
      object-fit: contain;
    }
    .brand-title {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 15px;
      font-weight: 600;
      color: #ffffff;
      letter-spacing: -0.01em;
    }
    .brand-slash { color: #52525b; font-weight: 400; }
    .brand-sub { color: var(--text-muted); font-weight: 500; font-size: 14px; }
    .k8s-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--inner-bg);
      color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .brand-desc {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 6px;
    }
    .app-card {
      background: var(--inner-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .app-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: var(--text-faint);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .app-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--cf-orange);
      box-shadow: 0 0 8px rgba(243, 128, 32, 0.6);
    }
    .app-name {
      font-size: 14px;
      font-weight: 600;
      color: #ffffff;
      word-break: break-word;
    }
    .scopes-box {
      background: var(--inner-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 20px;
    }
    .scopes-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: var(--text-faint);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .scopes-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .scope-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
    }
    .scope-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
      white-space: nowrap;
    }
    .scope-read {
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.25);
      color: #34d399;
    }
    .scope-write {
      background: rgba(243, 128, 32, 0.12);
      border: 1px solid rgba(243, 128, 32, 0.3);
      color: #fb923c;
    }
    .scope-admin {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.25);
      color: #f87171;
    }
    .scope-desc {
      color: var(--text-muted);
      font-size: 11px;
    }
    .form-group {
      margin-bottom: 14px;
    }
    .form-group label {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .input-wrap {
      position: relative;
    }
    .input-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      width: 14px;
      height: 14px;
      color: var(--text-faint);
      pointer-events: none;
    }
    .input-wrap input {
      width: 100%;
      background: var(--inner-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 9px 12px 9px 34px;
      color: #ffffff;
      font-size: 12px;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .input-wrap input::placeholder {
      color: #52525b;
    }
    .input-wrap input:focus {
      border-color: var(--cf-orange);
      box-shadow: 0 0 0 2px rgba(243, 128, 32, 0.2);
    }
    .btn-group {
      display: grid;
      grid-template-columns: 1fr 1.6fr;
      gap: 10px;
      margin-top: 20px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 9px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
    }
    .btn-secondary {
      background: var(--inner-bg);
      border-color: var(--border);
      color: var(--text-muted);
    }
    .btn-secondary:hover {
      background: #27272a;
      color: #ffffff;
      border-color: var(--border-hover);
    }
    .btn-primary {
      background: var(--cf-orange);
      color: #ffffff;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
    .btn-primary:hover {
      background: var(--cf-hover);
    }
    .btn-primary:active {
      background: var(--cf-dark);
    }
    .btn-arrow {
      width: 14px;
      height: 14px;
    }
    .footer {
      margin-top: 24px;
      text-align: center;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #52525b;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand-header">
      <div class="logo-box">
        <img src="/vynn_ai_logo.png" alt="VYNN">
      </div>
      <div class="brand-title">
        <span>VYNN</span>
        <span class="brand-slash">/</span>
        <span class="brand-sub">MCP Gateway</span>
        <span class="k8s-badge">k8s</span>
      </div>
      <p class="brand-desc">Sign in to authorize external AI connection</p>
    </div>

    <div class="app-card">
      <div class="app-header">
        <div class="app-dot"></div>
        <span>Application Requesting Access</span>
      </div>
      <div class="app-name">${escapeHtml(client.name)}</div>
    </div>

    <div class="scopes-box">
      <div class="scopes-title">Requested Permissions</div>
      <div class="scopes-list">
        ${scopeBadges}
      </div>
    </div>

    <div style="background: rgba(24, 24, 27, 0.7); border: 1px solid #27272a; border-radius: 6px; padding: 10px 12px; margin-bottom: 16px; font-size: 11px; color: #a1a1aa; line-height: 1.45;">
      <div style="display: flex; items-center; gap: 6px; color: #f38020; font-weight: 600; margin-bottom: 3px;">
        <svg style="width: 14px; height: 14px; shrink-0;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span>Role-Based Access Control (RBAC)</span>
      </div>
      <span>Permissions granted are strictly bounded by your user account role. <strong>Admin</strong> receives full read/write access. <strong>Member</strong> is automatically capped to read-only tools regardless of requested scopes.</span>
    </div>

    <form method="POST" action="/oauth/authorize" id="consent-form">
      <input type="hidden" name="client_id" value="${escapeHtml(client_id)}"/>
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri)}"/>
      <input type="hidden" name="scope" value="${escapeHtml(requestedScope)}"/>
      <input type="hidden" name="state" value="${escapeHtml(state || '')}"/>
      <input type="hidden" name="code_challenge" value="${escapeHtml(code_challenge || '')}"/>
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(code_challenge_method || '')}"/>
      <input type="hidden" name="action" value="" id="action-field"/>

      <div class="form-group">
        <label for="email">Gateway Email</label>
        <div class="input-wrap">
          <svg class="input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <input type="email" id="email" name="email" placeholder="you@domain.com" required autocomplete="email"/>
        </div>
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <div class="input-wrap">
          <svg class="input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <input type="password" id="password" name="password" placeholder="••••••••••••" required autocomplete="current-password"/>
        </div>
      </div>

      <div class="btn-row btn-group">
        <button type="button" class="btn btn-secondary" onclick="document.getElementById('action-field').value='deny';document.getElementById('consent-form').submit()">Deny</button>
        <button type="button" class="btn btn-primary" onclick="document.getElementById('action-field').value='approve';document.getElementById('consent-form').submit()">
          <span>Allow Access</span>
          <svg class="btn-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </form>

    <div class="footer">
      VYNN MCP Gateway · Production Multi-Tenant Hub
    </div>
  </div>
</body>
</html>`;

  res.send(html);
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// POST /oauth/authorize — Process consent form submission
// ============================================================
router.post('/oauth/authorize', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      client_id,
      redirect_uri,
      scope,
      state,
      code_challenge,
      code_challenge_method,
      action,
      email,
      password,
    } = req.body as Record<string, string>;

    if (action === 'deny') {
      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('error', 'access_denied');
      if (state) redirectUrl.searchParams.set('state', state);
      res.redirect(redirectUrl.toString());
      return;
    }

    if (!client_id || !redirect_uri) {
      res.status(400).json({ error: 'invalid_request', error_description: 'client_id and redirect_uri are required' });
      return;
    }

    // Validate client
    const client = await prisma.oAuthClient.findUnique({ where: { clientId: client_id } });
    if (!client || !isAllowedRedirectUri(client.redirectUris, redirect_uri)) {
      res.status(400).json({ error: 'invalid_client', error_description: 'Client or redirect_uri not valid' });
      return;
    }

    // Authenticate user credentials
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).send(`
        <div style="font-family: sans-serif; background: #0f172a; color: #f87171; padding: 40px; text-align: center; min-height: 100vh;">
          <h2>Invalid Credentials</h2>
          <p style="color: #94a3b8; margin: 16px 0;">No account found for "${escapeHtml(email || '')}". Please check your email.</p>
          <a href="javascript:history.back()" style="color: #6366f1; text-decoration: underline;">&larr; Try Again</a>
        </div>
      `);
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).send(`
        <div style="font-family: sans-serif; background: #0f172a; color: #f87171; padding: 40px; text-align: center; min-height: 100vh;">
          <h2>Invalid Password</h2>
          <p style="color: #94a3b8; margin: 16px 0;">Incorrect password. Please try again.</p>
          <a href="javascript:history.back()" style="color: #6366f1; text-decoration: underline;">&larr; Try Again</a>
        </div>
      `);
      return;
    }

    // RBAC Scope Assignment:
    // Granted permissions are strictly bounded by the authenticated user's role, NOT dictated solely by the AI client!
    const requestedScopes = (scope || 'mcp:read').split(' ').filter(Boolean);
    let finalScopes: string[] = ['mcp:read'];

    if (user.role === 'admin') {
      // Admins receive read, write, and admin permissions
      for (const s of requestedScopes) {
        if (['mcp:read', 'mcp:write', 'mcp:admin'].includes(s)) {
          if (!finalScopes.includes(s)) finalScopes.push(s);
        }
      }
      // Ensure admin has full operational access
      if (!finalScopes.includes('mcp:write')) finalScopes.push('mcp:write');
      if (!finalScopes.includes('mcp:admin')) finalScopes.push('mcp:admin');
    } else {
      // Regular members: Strictly bounded to read-only tools!
      // Mutating scopes (mcp:write, mcp:admin) are stripped and denied.
      finalScopes = ['mcp:read'];
    }

    // Preserve offline_access if requested (for persistent refresh tokens)
    if (requestedScopes.includes('offline_access')) {
      finalScopes.push('offline_access');
    }

    const grantedScope = finalScopes.join(' ');

    // Dynamic Client Ownership Binding:
    // If the client was dynamically registered by Claude Web, ChatGPT, or DCR before user authentication,
    // bind its ownership to the user who is actually authenticating and granting consent!
    const isDynamicAiClient =
      client.redirectUris.some((u) => u.includes('claude.ai') || u.includes('chatgpt.com')) ||
      client.name.includes('Dynamic');

    if (isDynamicAiClient && client.userId !== user.id) {
      const updatedName = client.name.includes(user.name) ? client.name : `${client.name} (${user.name})`;
      await prisma.oAuthClient.update({
        where: { id: client.id },
        data: {
          userId: user.id,
          name: updatedName,
        },
      });
    }

    // Generate authorization code with RBAC-enforced scope
    const code = await generateAuthCode({
      clientId: client_id,
      userId: user.id,
      redirectUri: redirect_uri,
      scope: grantedScope,
      codeChallenge: code_challenge || undefined,
      codeChallengeMethod: code_challenge_method || undefined,
    });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);
    res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error('Error processing OAuth authorization:', err);
    res.status(500).json({
      error: 'server_error',
      error_description: err instanceof Error ? err.message : 'Internal authorization error',
    });
  }
});

// ============================================================
// POST /oauth/token — Token Exchange (PUBLIC endpoint)
// ============================================================
router.post('/oauth/token', async (req: Request, res: Response): Promise<void> => {
  const credentials = extractClientCredentials(req);
  const client_id = credentials.clientId || (req.body?.client_id as string) || (req.query?.client_id as string);
  const client_secret = credentials.clientSecret || (req.body?.client_secret as string) || (req.query?.client_secret as string);

  const grant_type = (req.body?.grant_type || req.query?.grant_type) as string;
  const code = (req.body?.code || req.query?.code) as string;
  const redirect_uri = (req.body?.redirect_uri || req.query?.redirect_uri) as string;
  const code_verifier = (req.body?.code_verifier || req.query?.code_verifier) as string;
  const refresh_token = (req.body?.refresh_token || req.query?.refresh_token) as string;
  const scope = (req.body?.scope || req.query?.scope) as string;

  if (!grant_type) {
    res.status(400).json({ error: 'invalid_request', error_description: 'grant_type is required' });
    return;
  }

  // ---- Grant Type: authorization_code ----
  if (grant_type === 'authorization_code') {
    if (!code || !redirect_uri || !client_id) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'code, redirect_uri, client_id required',
      });
      return;
    }

    const client = await prisma.oAuthClient.findUnique({ where: { clientId: client_id } });
    if (!client) {
      res.status(400).json({ error: 'invalid_client', error_description: 'Client not found' });
      return;
    }

    if (client.clientSecretHash && client_secret) {
      const secretHash = hashToken(client_secret);
      if (secretHash !== client.clientSecretHash) {
        res.status(401).json({ error: 'invalid_client', error_description: 'Invalid client_secret' });
        return;
      }
    }

    const result = await validateAndConsumeAuthCode({
      code,
      clientId: client_id,
      redirectUri: redirect_uri,
      codeVerifier: code_verifier,
    });
    if (!result) {
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Authorization code is invalid, expired, or already used',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'User not found' });
      return;
    }

    const accessToken = issueAccessToken({
      userId: user.id,
      clientId: client_id,
      scope: result.scope,
      userEmail: user.email,
      userRole: user.role,
    });
    const refreshTokenValue = await issueRefreshToken({
      clientId: client_id,
      userId: user.id,
      scope: result.scope,
    });

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshTokenValue,
      scope: result.scope,
    });
    return;
  }

  // ---- Grant Type: client_credentials ----
  if (grant_type === 'client_credentials') {
    if (!client_id || !client_secret) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_id and client_secret required for client_credentials grant',
      });
      return;
    }

    const client = await prisma.oAuthClient.findUnique({
      where: { clientId: client_id },
      include: { user: true },
    });
    if (!client || !client.clientSecretHash) {
      res.status(401).json({
        error: 'invalid_client',
        error_description: 'Unknown client or public client cannot use client_credentials',
      });
      return;
    }

    const secretHash = hashToken(client_secret);
    if (secretHash !== client.clientSecretHash) {
      res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client_secret',
      });
      return;
    }

    const requestedScope = scope || 'mcp:read';
    const allowedScopes = client.scopes;
    const finalScope =
      requestedScope
        .split(' ')
        .filter((s: string) => allowedScopes.includes(s))
        .join(' ') || 'mcp:read';

    const accessToken = issueAccessToken({
      userId: client.user.id,
      clientId: client_id,
      scope: finalScope,
      userEmail: client.user.email,
      userRole: client.user.role,
    });

    res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 3600, scope: finalScope });
    return;
  }

  // ---- Grant Type: refresh_token ----
  if (grant_type === 'refresh_token') {
    if (!refresh_token || !client_id) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'refresh_token and client_id required',
      });
      return;
    }

    const tokenData = await validateRefreshToken(refresh_token);
    if (!tokenData || tokenData.clientId !== client_id) {
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Refresh token is invalid, expired, or revoked',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'User not found' });
      return;
    }

    const accessToken = issueAccessToken({
      userId: user.id,
      clientId: client_id,
      scope: tokenData.scope,
      userEmail: user.email,
      userRole: user.role,
    });

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: tokenData.scope,
    });
    return;
  }

  res.status(400).json({
    error: 'unsupported_grant_type',
    error_description: `Grant type '${grant_type}' is not supported`,
  });
});

// ============================================================
// POST /oauth/revoke — Token Revocation (RFC 7009)
// ============================================================
router.post('/oauth/revoke', async (req: Request, res: Response): Promise<void> => {
  const token = ((req.body?.token || req.query?.token) as string) || '';
  if (!token) {
    res.status(400).json({ error: 'invalid_request', error_description: 'token is required' });
    return;
  }
  // Try revoke as refresh token (access tokens are stateless JWT - just let them expire)
  await revokeRefreshToken(token);
  res.json({ success: true });
});

// ============================================================
// GET /oauth/userinfo — Return user info for active OAuth token
// ============================================================
router.get('/oauth/userinfo', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  res.json({ sub: user.id, email: user.email, name: user.name, role: user.role });
});

// ============================================================
// Dashboard: OAuth Client Management (AUTHENTICATED)
// ============================================================

// GET /api/oauth/clients — List OAuth apps (Team for Admin, Personal for Members)
router.get('/api/oauth/clients', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const showAll = req.user!.role === 'admin' && req.query.all === 'true';
  const where: any = {};

  if (!showAll) {
    where.userId = req.user!.id;
  } else if (req.query.userId && typeof req.query.userId === 'string') {
    where.userId = req.query.userId;
  }

  const clients = await prisma.oAuthClient.findMany({
    where,
    select: {
      id: true,
      clientId: true,
      name: true,
      redirectUris: true,
      scopes: true,
      trusted: true,
      userId: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(clients);
});

// POST /api/oauth/clients — Register a new OAuth app
router.post('/api/oauth/clients', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const { name, redirectUris, scopes } = req.body as {
    name: string;
    redirectUris: string[];
    scopes?: string[];
  };

  if (!name || !redirectUris || !Array.isArray(redirectUris) || redirectUris.length === 0) {
    res.status(400).json({ error: 'name and redirectUris (array) are required' });
    return;
  }

  const clientId = `mcp_client_${generateSecureToken(8)}`;
  const clientSecret = `mcp_secret_${generateSecureToken(24)}`;
  const clientSecretHash = hashToken(clientSecret);

  const client = await prisma.oAuthClient.create({
    data: {
      clientId,
      clientSecretHash,
      name,
      redirectUris,
      scopes: scopes || ['mcp:read', 'mcp:write'],
      userId: req.user!.id,
    },
  });

  // Return the raw secret ONCE — never again stored in plaintext
  res.status(201).json({
    id: client.id,
    clientId: client.clientId,
    clientSecret, // shown only once
    name: client.name,
    redirectUris: client.redirectUris,
    scopes: client.scopes,
    createdAt: client.createdAt,
  });
});

// DELETE /api/oauth/clients/:id — Delete OAuth app and revoke all tokens
router.delete('/api/oauth/clients/:id', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const client = await prisma.oAuthClient.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  if (!client) {
    res.status(404).json({ error: 'OAuth client not found' });
    return;
  }

  // Members can only delete their own apps; Admins can delete/revoke any app across the team
  if (req.user!.role !== 'admin' && client.userId !== req.user!.id) {
    res.status(403).json({ error: 'Forbidden — you can only delete your own OAuth applications' });
    return;
  }

  // Cascade delete (Prisma handles refresh tokens and auth codes via onDelete: Cascade)
  await prisma.oAuthClient.delete({ where: { id } });
  res.json({ success: true, message: 'OAuth application deleted successfully' });
});

export default router;
