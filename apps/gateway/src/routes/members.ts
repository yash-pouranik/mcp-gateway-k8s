import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { requireUserAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/members (List team members)
router.get('/', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const members = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: {
        select: { apiKeys: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ members });
});

// POST /api/members (Create new member - Admin only)
router.post('/', requireUserAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: `User with email "${email}" already exists` });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: role === 'admin' ? 'admin' : 'member',
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  res.status(201).json({ user });
});

export default router;
