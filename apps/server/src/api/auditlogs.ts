import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * GET /api/auditlogs
 * List recent audit logs for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { limit = '50', offset = '0', action, resource } = req.query;

    const where: any = { userId };

    if (action) {
      where.action = action as string;
    }

    if (resource) {
      where.resource = resource as string;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit as string, 10), 100),
      skip: parseInt(offset as string, 10),
    });

    const total = await prisma.auditLog.count({ where });

    res.json({
      success: true,
      data: {
        logs,
        total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      },
    });
  } catch (error) {
    console.error('[API] Error listing audit logs:', error);
    res.status(500).json({ success: false, error: 'Failed to list audit logs' });
  }
});

/**
 * POST /api/auditlogs
 * Create a new audit log entry
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { action, resource, resourceId, details } = req.body;

    if (!action || !resource) {
      res.status(400).json({ success: false, error: 'action and resource are required' });
      return;
    }

    const log = await prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        details,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      },
    });

    res.status(201).json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error('[API] Error creating audit log:', error);
    res.status(500).json({ success: false, error: 'Failed to create audit log' });
  }
});

/**
 * DELETE /api/auditlogs
 * Clear all audit logs for the authenticated user
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    await prisma.auditLog.deleteMany({
      where: { userId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error clearing audit logs:', error);
    res.status(500).json({ success: false, error: 'Failed to clear audit logs' });
  }
});

export default router;
