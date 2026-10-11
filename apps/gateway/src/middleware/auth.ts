import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { hashApiKey } from '../services/crypto.js';
import { recordAuditLog } from '../services/audit.js';

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
    }
  }
}

/**
 * Middleware: Requires valid JWT from Authorization: Bearer <jwt>
 */
export async function requireUserAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];
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
 *  1. API Key via `Authorization: Bearer mcp_live_...` or `x-api-key: mcp_live_...`
 *  2. Dashboard JWT via `Authorization: Bearer <jwt>`
 * If an API key is revoked or invalid, an audit log rejection entry is recorded!
 */
export async function authenticateMcpClient(req: Request, res: Response, next: NextFunction): Promise<void> {
  const startTime = Date.now();
  let token = req.headers['x-api-key'] as string | undefined;

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }

  if (!token) {
    // Log unauthenticated attempt
    await recordAuditLog({
      userId: null,
      toolName: 'mcp.authenticate',
      inputSummary: { ip: req.ip, endpoint: req.originalUrl },
      durationMs: Date.now() - startTime,
      success: false,
      errorMsg: 'Missing authentication credentials',
    });
    res.status(401).json({ error: 'Missing API key or Bearer token' });
    return;
  }

  // Case A: Is it an API Key (starts with mcp_live_)?
  if (token.startsWith('mcp_live_')) {
    const hashed = hashApiKey(token);
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash: hashed },
      include: { user: true },
    });

    if (!apiKey) {
      await recordAuditLog({
        userId: null,
        toolName: 'mcp.authenticate',
        inputSummary: { ip: req.ip, keyPrefix: token.slice(0, 16) },
        durationMs: Date.now() - startTime,
        success: false,
        errorMsg: 'Invalid API key',
      });
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    if (apiKey.revokedAt !== null) {
      await recordAuditLog({
        userId: apiKey.userId,
        toolName: 'mcp.authenticate',
        inputSummary: { keyId: apiKey.id, keyPrefix: apiKey.keyPrefix },
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
    next();
    return;
  }

  // Case B: Is it a Dashboard JWT?
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
    await recordAuditLog({
      userId: null,
      toolName: 'mcp.authenticate',
      inputSummary: { ip: req.ip },
      durationMs: Date.now() - startTime,
      success: false,
      errorMsg: 'Invalid token or API key format',
    });
    res.status(401).json({ error: 'Invalid token or API key' });
  }
}
