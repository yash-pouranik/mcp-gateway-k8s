import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { requireEnv } from './env.js';

const JWT_SECRET = requireEnv('JWT_SECRET');
const ISSUER = process.env.OAUTH_ISSUER || 'https://vynn.urbackend.in';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function verifyPKCE(codeVerifier: string, codeChallenge: string, method: string): boolean {
  if (method === 'S256') {
    const digest = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return digest === codeChallenge;
  }
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  }
  return false;
}

export async function generateAuthCode(params: {
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}): Promise<string> {
  const code = generateSecureToken(32);
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await prisma.oAuthAuthCode.create({
    data: {
      codeHash,
      clientId: params.clientId,
      userId: params.userId,
      redirectUri: params.redirectUri,
      scope: params.scope,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod,
      expiresAt,
    },
  });

  return code;
}

export async function validateAndConsumeAuthCode(params: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<{ userId: string; scope: string } | null> {
  const codeHash = hashToken(params.code);

  const record = await prisma.oAuthAuthCode.findUnique({ where: { codeHash } });
  if (!record) return null;
  if (record.usedAt) return null; // already used
  if (record.expiresAt < new Date()) return null; // expired
  if (record.clientId !== params.clientId) return null;
  if (record.redirectUri !== params.redirectUri) return null;

  // PKCE validation
  if (record.codeChallenge && record.codeChallengeMethod) {
    if (!params.codeVerifier) return null;
    const valid = verifyPKCE(params.codeVerifier, record.codeChallenge, record.codeChallengeMethod);
    if (!valid) return null;
  }

  // Mark as used (one-time only)
  await prisma.oAuthAuthCode.update({
    where: { codeHash },
    data: { usedAt: new Date() },
  });

  return { userId: record.userId, scope: record.scope };
}

export function issueAccessToken(params: {
  userId: string;
  clientId: string;
  scope: string;
  userEmail: string;
  userRole: string;
}): string {
  return jwt.sign(
    {
      sub: params.userId,
      id: params.userId,
      email: params.userEmail,
      role: params.userRole,
      client_id: params.clientId,
      scope: params.scope,
      token_type: 'oauth_access_token',
    },
    JWT_SECRET,
    {
      issuer: ISSUER,
      audience: [ISSUER, `${ISSUER}/mcp`],
      expiresIn: '1h',
    }
  );
}

export async function issueRefreshToken(params: {
  clientId: string;
  userId: string;
  scope: string;
}): Promise<string> {
  const token = generateSecureToken(48);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.oAuthRefreshToken.create({
    data: {
      tokenHash,
      clientId: params.clientId,
      userId: params.userId,
      scope: params.scope,
      expiresAt,
    },
  });

  return token;
}

export async function validateRefreshToken(token: string): Promise<{
  userId: string;
  clientId: string;
  scope: string;
} | null> {
  const tokenHash = hashToken(token);
  const record = await prisma.oAuthRefreshToken.findUnique({ where: { tokenHash } });
  if (!record) return null;
  if (record.revokedAt) return null;
  if (record.expiresAt < new Date()) return null;
  return { userId: record.userId, clientId: record.clientId, scope: record.scope };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.oAuthRefreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
