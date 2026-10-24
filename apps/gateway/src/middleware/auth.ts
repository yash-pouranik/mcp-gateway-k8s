import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { hashApiKey } from '../services/crypto.js';
import { recordAuditLog } from '../services/audit.js';
import { recordAuthFailure } from '../services/metrics.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-mcp-gateway';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'admin' | 'member';
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      apiKeyId?: string;
      apiKeyPrefix?: string;
      apiKeyName?: string;
      oauthScope?: string;
      oauthClientId?: string;
    }
  }
}

/**
 * Middleware: Requires valid JWT from Authorization: Bearer <jwt>
 */
/**
 * Sanitize incoming token string:
 * Strips whitespace, quotes ("..."), and angle brackets (<...>).
 */
function sanitizeToken(raw: string): string {
  let cleaned = raw.trim();
  // Strip surrounding quotes
  cleaned = cleaned.replace(/^["']|["']$/g, '').trim();
  // Strip surrounding angle brackets e.g. <token> from docs/prompts
  cleaned = cleaned.replace(/^<|>$/g, '').trim();
  return cleaned;
}

/**
 * Extract token from Authorization header or x-api-key header.
 * Case-insensitive match on Bearer / bearer.
 */
function extractBearerToken(req: Request): string | undefined {
  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey.trim()) {
    return sanitizeToken(xApiKey);
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.*)$/i);
    if (match && match[1]) {
      return sanitizeToken(match[1]);
    }
  }

  return undefined;
}

/**
 * Middleware: Requires valid JWT from Authorization: Bearer <jwt>
 */
export async function requireUserAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User no longer exists' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
}

/**
 * Middleware: Requires admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return;
  }
  next();
}

/**
 * Middleware for MCP endpoint:
 * Accepts either:
 *  1. API Key via `Authorization: Bearer <key>` or `x-api-key: <key>`
 *  2. Dashboard JWT via `Authorization: Bearer <jwt>`
 * If an API key is revoked or invalid, an audit log rejection entry is recorded!
 */
export async function authenticateMcpClient(req: Request, res: Response, next: NextFunction): Promise<void> {
  const startTime = Date.now();
  const token = extractBearerToken(req);

  if (!token) {
    recordAuthFailure('missing_auth');
    // Log unauthenticated attempt
    await recordAuditLog({
      userId: null,
      toolName: 'mcp.authenticate',
      inputSummary: { ip: req.ip, endpoint: req.originalUrl },
      durationMs: Date.now() - startTime,
      success: false,
      errorMsg: 'Missing authentication credentials',
    });
    const ISSUER = process.env.OAUTH_ISSUER || 'https://vynn.urbackend.in';
    res.setHeader(
      'WWW-Authenticate',
      `Bearer error="unauthorized", resource_metadata="${ISSUER}/.well-known/oauth-protected-resource"`
    );
    res.status(401).json({ error: 'Missing API key or Bearer token' });
    return;
  }

  // 1. First check if it matches an API key in the database via SHA-256 hash lookup
  const hashed = hashApiKey(token);
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hashed },
    include: { user: true },
  });

  if (apiKey) {
    if (apiKey.revokedAt !== null) {
      recordAuthFailure('revoked_key');
      await recordAuditLog({
        userId: apiKey.userId,
        toolName: 'mcp.authenticate',
        inputSummary: { keyId: apiKey.id, keyPrefix: apiKey.keyPrefix, keyName: apiKey.name },
        durationMs: Date.now() - startTime,
        success: false,
        errorMsg: 'API key revoked',
      });
      res.status(401).json({ error: 'API key revoked' });
      return;
    }

    req.user = {
      id: apiKey.user.id,
      email: apiKey.user.email,
      name: apiKey.user.name,
      role: apiKey.user.role,
    };
    req.apiKeyId = apiKey.id;
    req.apiKeyPrefix = apiKey.keyPrefix;
    req.apiKeyName = apiKey.name;
    next();
    return;
  }

  // 2. If not an API key, check if it is a JWT token (split by dots has 3 segments)
  if (token.split('.').length === 3) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, name: true, role: true },
      });

      if (!user) {
        recordAuthFailure('invalid_jwt');
        res.status(401).json({ error: 'User no longer exists' });
        return;
      }

      req.user = { id: user.id, email: user.email, name: user.name, role: user.role };

      // Check if this is an OAuth token (has scope + token_type fields)
      const rawPayload = payload as unknown as Record<string, unknown>;
      if (rawPayload.token_type === 'oauth_access_token' && rawPayload.scope) {
        req.oauthScope = rawPayload.scope as string;
        req.oauthClientId = rawPayload.client_id as string;
      }

      next();
      return;
    } catch (err) {
      recordAuthFailure('invalid_jwt');
      await recordAuditLog({
        userId: null,
        toolName: 'mcp.authenticate',
        inputSummary: { ip: req.ip, authType: 'jwt' },
        durationMs: Date.now() - startTime,
        success: false,
        errorMsg: 'Invalid or expired session token',
      });
      res.status(401).json({ error: 'Invalid or expired session token' });
      return;
    }
  }

  // 3. Otherwise, it is an invalid API key
  recordAuthFailure('invalid_key');
  await recordAuditLog({
    userId: null,
    toolName: 'mcp.authenticate',
    inputSummary: { ip: req.ip, keyPrefix: token.slice(0, 16) },
    durationMs: Date.now() - startTime,
    success: false,
    errorMsg: 'Invalid API key',
  });
  res.status(401).json({ error: 'Invalid API key' });
}
