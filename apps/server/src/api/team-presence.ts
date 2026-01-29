import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { collaborationService } from '../services/CollaborationService.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const updateNotificationPrefsSchema = z.object({
  terminalErrors: z.boolean().optional(),
  longCommands: z.boolean().optional(),
  longCommandThreshold: z.number().int().min(60).max(3600).optional(),
  taskMentions: z.boolean().optional(),
  serverStatus: z.boolean().optional(),
});

/**
 * GET /api/teams/:teamId/presence
 * Get current online status and stats for team members
 */
router.get('/:teamId/presence', async (req: Request, res: Response) => {
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

    // Get in-memory presence
    const presenceList = collaborationService.getTeamPresence(teamId);

    // Get team stats
    const [memberCount, taskCount, activeTerminalCount] = await Promise.all([
      prisma.teamMember.count({ where: { teamId } }),
      prisma.task.count({
        where: {
          teamId,
          status: { notIn: ['DONE'] },
        },
      }),
      prisma.teamTerminalShare.count({
        where: {
          teamId,
          terminal: { status: 'RUNNING' },
        },
      }),
    ]);

    // Get recent activity (last 24h)
    const recentCommandCount = await prisma.teamCommandHistory.count({
      where: {
        teamId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    res.json({
      success: true,
      data: {
        presence: presenceList,
        onlineCount: presenceList.length,
        stats: {
          memberCount,
          activeTasks: taskCount,
          activeTerminals: activeTerminalCount,
          commandsLast24h: recentCommandCount,
        },
      },
    });
  } catch (error) {
    console.error('[API] Get team presence error:', error);
    res.status(500).json({ success: false, error: 'Failed to get team presence' });
  }
});

/**
 * GET /api/teams/:teamId/notification-prefs
 * Get notification preferences for the current user in this team
 */
router.get('/:teamId/notification-prefs', async (req: Request, res: Response) => {
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

    // Get or create notification prefs
    let prefs = await prisma.teamNotificationPrefs.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!prefs) {
      // Return defaults
      res.json({
        success: true,
        data: {
          terminalErrors: true,
          longCommands: true,
          longCommandThreshold: 300,
          taskMentions: true,
          serverStatus: true,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        terminalErrors: prefs.terminalErrors,
        longCommands: prefs.longCommands,
        longCommandThreshold: prefs.longCommandThreshold,
        taskMentions: prefs.taskMentions,
        serverStatus: prefs.serverStatus,
      },
    });
  } catch (error) {
    console.error('[API] Get team notification prefs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get notification preferences' });
  }
});

/**
 * PATCH /api/teams/:teamId/notification-prefs
 * Update notification preferences
 */
router.patch('/:teamId/notification-prefs', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const data = updateNotificationPrefsSchema.parse(req.body);

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Upsert notification prefs
    const prefs = await prisma.teamNotificationPrefs.upsert({
      where: { teamId_userId: { teamId, userId } },
      create: {
        teamId,
        userId,
        terminalErrors: data.terminalErrors ?? true,
        longCommands: data.longCommands ?? true,
        longCommandThreshold: data.longCommandThreshold ?? 300,
        taskMentions: data.taskMentions ?? true,
        serverStatus: data.serverStatus ?? true,
      },
      update: {
        terminalErrors: data.terminalErrors,
        longCommands: data.longCommands,
        longCommandThreshold: data.longCommandThreshold,
        taskMentions: data.taskMentions,
        serverStatus: data.serverStatus,
      },
    });

    res.json({
      success: true,
      data: {
        terminalErrors: prefs.terminalErrors,
        longCommands: prefs.longCommands,
        longCommandThreshold: prefs.longCommandThreshold,
        taskMentions: prefs.taskMentions,
        serverStatus: prefs.serverStatus,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update team notification prefs error:', error);
    res.status(500).json({ success: false, error: 'Failed to update notification preferences' });
  }
});

/**
 * GET /api/teams/:teamId/activity
 * Get recent activity feed for the team
 */
router.get('/:teamId/activity', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const { limit = '20' } = req.query;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Get recent audit logs as activity feed
    const activities = await prisma.teamAuditLog.findMany({
      where: { teamId },
      include: {
        user: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    res.json({
      success: true,
      data: {
        activities: activities.map((a) => ({
          id: a.id,
          action: a.action,
          resource: a.resource,
          resourceId: a.resourceId,
          details: a.details,
          user: a.user,
          createdAt: a.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('[API] Get team activity error:', error);
    res.status(500).json({ success: false, error: 'Failed to get team activity' });
  }
});

export default router;
