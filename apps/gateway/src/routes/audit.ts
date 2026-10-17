import { Router, Request, Response } from 'express';
import { prisma } from '../db.js';
import { requireUserAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/audit (List audit logs with advanced filtering)
router.get('/', requireUserAuth, async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);

  const where: any = {};

  // RBAC: members see only their own logs; admin can filter by userId
  if (req.user!.role !== 'admin') {
    where.userId = req.user!.id;
  } else if (req.query.userId && typeof req.query.userId === 'string') {
    where.userId = req.query.userId;
  }

  // Filter by upstream server
  if (req.query.serverId && typeof req.query.serverId === 'string') {
    where.serverId = req.query.serverId;
  }

  // Filter by success/failure
  if (req.query.success !== undefined && req.query.success !== '') {
    where.success = req.query.success === 'true';
  }

  // Date range filter
  if (req.query.startDate || req.query.endDate) {
    where.calledAt = {};
    if (req.query.startDate && typeof req.query.startDate === 'string') {
      where.calledAt.gte = new Date(req.query.startDate);
    }
    if (req.query.endDate && typeof req.query.endDate === 'string') {
      // End of day: set time to 23:59:59.999
      const end = new Date(req.query.endDate);
      end.setHours(23, 59, 59, 999);
      where.calledAt.lte = end;
    }
  }

  // Tool name partial match (legacy param, kept for backward compat)
  if (req.query.toolName && typeof req.query.toolName === 'string') {
    where.toolName = { contains: req.query.toolName, mode: 'insensitive' };
  }

  // Free-text search across toolName and errorMsg
  if (req.query.search && typeof req.query.search === 'string') {
    const searchTerm = req.query.search;
    where.OR = [
      { toolName: { contains: searchTerm, mode: 'insensitive' } },
      { errorMsg: { contains: searchTerm, mode: 'insensitive' } },
    ];
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
