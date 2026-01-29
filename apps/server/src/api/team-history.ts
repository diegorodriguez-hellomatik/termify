import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/teams/:teamId/history
 * Get command history for the team with search and filters
 */
router.get('/:teamId/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const {
      search,
      userId: filterUserId,
      terminalId,
      startDate,
      endDate,
      limit = '50',
      offset = '0',
    } = req.query;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    const where: any = { teamId };

    if (search) {
      where.command = { contains: search as string, mode: 'insensitive' };
    }

    if (filterUserId) {
      where.userId = filterUserId as string;
    }

    if (terminalId) {
      where.terminalId = terminalId as string;
    }

    if (startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(startDate as string) };
    }

    if (endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(endDate as string) };
    }

    const [history, total] = await Promise.all([
      prisma.teamCommandHistory.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true, image: true },
          },
          terminal: {
            select: { id: true, name: true, type: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.teamCommandHistory.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        history: history.map((h) => ({
          id: h.id,
          command: h.command,
          exitCode: h.exitCode,
          duration: h.duration,
          user: h.user,
          terminal: h.terminal,
          createdAt: h.createdAt,
        })),
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    console.error('[API] Get team history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get team history' });
  }
});

/**
 * GET /api/teams/:teamId/history/stats
 * Get history statistics for the team
 */
router.get('/:teamId/history/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Get various stats
    const [totalCommands, commandsByUser, recentActivity] = await Promise.all([
      prisma.teamCommandHistory.count({ where: { teamId } }),

      prisma.teamCommandHistory.groupBy({
        by: ['userId'],
        where: { teamId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),

      prisma.teamCommandHistory.findMany({
        where: {
          teamId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { createdAt: true },
      }),
    ]);

    // Get user info for the stats
    const userIds = commandsByUser.map((c) => c.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true, image: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    res.json({
      success: true,
      data: {
        totalCommands,
        commandsByUser: commandsByUser.map((c) => ({
          user: userMap.get(c.userId),
          count: c._count.id,
        })),
        activityLast24h: recentActivity.length,
      },
    });
  } catch (error) {
    console.error('[API] Get team history stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get team history stats' });
  }
});

/**
 * GET /api/teams/:teamId/audit-logs
 * Get audit logs for the team
 */
router.get('/:teamId/audit-logs', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const {
      action,
      resource,
      userId: filterUserId,
      startDate,
      endDate,
      limit = '50',
      offset = '0',
    } = req.query;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    const where: any = { teamId };

    if (action) {
      where.action = action as string;
    }

    if (resource) {
      where.resource = resource as string;
    }

    if (filterUserId) {
      where.userId = filterUserId as string;
    }

    if (startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(startDate as string) };
    }

    if (endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(endDate as string) };
    }

    const [logs, total] = await Promise.all([
      prisma.teamAuditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true, image: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.teamAuditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        logs: logs.map((l) => ({
          id: l.id,
          action: l.action,
          resource: l.resource,
          resourceId: l.resourceId,
          details: l.details,
          user: l.user,
          createdAt: l.createdAt,
        })),
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    console.error('[API] Get team audit logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get team audit logs' });
  }
});

/**
 * GET /api/teams/:teamId/audit-logs/actions
 * Get unique actions for filtering
 */
router.get('/:teamId/audit-logs/actions', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    const actions = await prisma.teamAuditLog.findMany({
      where: { teamId },
      select: { action: true },
      distinct: ['action'],
    });

    res.json({
      success: true,
      data: {
        actions: actions.map((a) => a.action),
      },
    });
  } catch (error) {
    console.error('[API] Get team audit log actions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit log actions' });
  }
});

export default router;
