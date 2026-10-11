import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { requireUserAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/audit (List audit logs with user and server relations)
router.get('/', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);

  // If user is member, show their logs; if admin, show all logs
  const where: any = {};
  if (req.user!.role !== 'admin') {
    where.userId = req.user!.id;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        server: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { calledAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ logs, total, limit, offset });
});

export default router;
