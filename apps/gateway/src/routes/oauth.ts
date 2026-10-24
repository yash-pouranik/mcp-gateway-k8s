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
    scopes_supported: ['mcp:read', 'mcp:write', 'mcp:admin'],
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
    scopes_supported: ['mcp:read', 'mcp:write', 'mcp:admin'],
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
    scopes_supported: ['mcp:read', 'mcp:write', 'mcp:admin'],
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
      const labels: Record<string, string> = {
        'mcp:read': '📖 Read Tools (list products, orders)',
        'mcp:write': '✏️ Write Tools (create/update)',
        'mcp:admin': '🔑 Admin Tools (delete, config)',
      };
      return labels[s] || s;
    })
    .join('<br/>');

  // Render consent HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize Access — VYNN MCP Gateway</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 40px; max-width: 440px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
    .logo { font-size: 32px; font-weight: 800; color: #6366f1; letter-spacing: -1px; margin-bottom: 8px; }
    .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 32px; }
    .client-name { font-size: 20px; font-weight: 700; color: #f1f5f9; margin-bottom: 4px; }
    .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 16px; }
    .scopes { background: #0f172a; border-radius: 12px; padding: 16px; margin: 20px 0; border: 1px solid #1e3a5f; }
    .scopes p { font-size: 13px; color: #94a3b8; margin-bottom: 10px; }
    .scopes .scope-list { font-size: 14px; color: #e2e8f0; line-height: 2; }
    .user-section { margin: 24px 0; padding: 16px; background: #0f172a; border-radius: 12px; border: 1px solid #334155; }
    .user-section label { display: block; font-size: 12px; color: #64748b; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.05em; }
    .user-section input { width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; color: #e2e8f0; font-size: 14px; outline: none; }
    .user-section input:focus { border-color: #6366f1; }
    .btn-row { display: flex; gap: 12px; margin-top: 24px; }
    .btn { flex: 1; padding: 12px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; border: none; transition: 0.2s; }
    .btn-approve { background: #6366f1; color: #fff; }
    .btn-approve:hover { background: #4f46e5; }
    .btn-deny { background: #334155; color: #94a3b8; }
    .btn-deny:hover { background: #475569; color: #e2e8f0; }
    .footer { margin-top: 20px; font-size: 12px; color: #475569; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">VYNN</div>
    <div class="subtitle">MCP Gateway Authorization</div>
    <div class="label">Application Requesting Access</div>
    <div class="client-name">${escapeHtml(client.name)}</div>
    <div class="scopes">
      <p>This application is requesting the following permissions:</p>
      <div class="scope-list">${scopeBadges}</div>
    </div>
    <form method="POST" action="/oauth/authorize" id="consent-form">
      <input type="hidden" name="client_id" value="${escapeHtml(client_id)}"/>
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri)}"/>
      <input type="hidden" name="scope" value="${escapeHtml(requestedScope)}"/>
      <input type="hidden" name="state" value="${escapeHtml(state || '')}"/>
      <input type="hidden" name="code_challenge" value="${escapeHtml(code_challenge || '')}"/>
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(code_challenge_method || '')}"/>
      <input type="hidden" name="action" value="" id="action-field"/>
      <div class="user-section">
        <label for="email">Your Gateway Email</label>
        <input type="email" id="email" name="email" placeholder="admin@example.com" required autocomplete="email"/>
        <br/><br/>
        <label for="password">Password</label>
        <input type="password" id="password" name="password" placeholder="••••••••" required autocomplete="current-password"/>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-deny" onclick="document.getElementById('action-field').value='deny';document.getElementById('consent-form').submit()">Deny</button>
        <button type="button" class="btn btn-approve" onclick="document.getElementById('action-field').value='approve';document.getElementById('consent-form').submit()">Allow Access</button>
      </div>
    </form>
    <div class="footer">VYNN MCP Gateway · Secure OAuth 2.0 Authorization</div>
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

    // Generate authorization code
    const code = await generateAuthCode({
      clientId: client_id,
      userId: user.id,
      redirectUri: redirect_uri,
      scope: scope || 'mcp:read',
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

// GET /api/oauth/clients — List OAuth apps for current user
router.get('/api/oauth/clients', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const clients = await prisma.oAuthClient.findMany({
    where: { userId },
    select: {
      id: true,
      clientId: true,
      name: true,
      redirectUris: true,
      scopes: true,
      trusted: true,
      createdAt: true,
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
  const id = req.params.id as string;
  const userId = req.user!.id;
  const client = await prisma.oAuthClient.findUnique({ where: { id } });
  if (!client || client.userId !== userId) {
    res.status(404).json({ error: 'OAuth client not found' });
    return;
  }

  // Cascade delete (Prisma handles refresh tokens and auth codes via onDelete: Cascade)
  await prisma.oAuthClient.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
