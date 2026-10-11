import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { requireUserAuth } from '../middleware/auth.js';
import { generateApiKey } from '../services/crypto.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-mcp-gateway';

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

// GET /api/auth/me
router.get('/me', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  res.json({ user: req.user });
});

// GET /api/auth/api-keys
router.get('/api-keys', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: req.user!.id },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      revokedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ keys });
});

// POST /api/auth/api-keys
router.post('/api-keys', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Key name is required' });
    return;
  }

  const { rawKey, keyPrefix, keyHash } = generateApiKey();
  const created = await prisma.apiKey.create({
    data: {
      userId: req.user!.id,
      name: name.trim(),
      keyPrefix,
      keyHash,
    },
  });

  // rawKey is returned ONLY on initial creation
  res.status(201).json({
    apiKey: {
      id: created.id,
      name: created.name,
      keyPrefix: created.keyPrefix,
      rawKey,
      createdAt: created.createdAt,
    },
  });
});

// DELETE /api/auth/api-keys/:id (Revoke key)
router.delete('/api-keys/:id', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const apiKey = await prisma.apiKey.findUnique({ where: { id } });

  if (!apiKey) {
    res.status(404).json({ error: 'API key not found' });
    return;
  }

  // Members can only revoke their own keys; Admins can revoke any key
  if (req.user!.role !== 'admin' && apiKey.userId !== req.user!.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const updated = await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  res.json({ message: 'API key revoked successfully', key: updated });
});

export default router;
