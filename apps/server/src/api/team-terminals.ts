import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { TeamRole, SharePermission, TerminalStatus, TeamTerminalShare } from '@termify/shared';
import { SharePermission as PrismaSharePermission } from '@prisma/client';
import { getWebSocketServer } from '../websocket/WebSocketServer.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const shareTerminalSchema = z.object({
  terminalId: z.string().min(1),
  permission: z.enum(['VIEW', 'CONTROL']).optional().default('VIEW'),
});

const updatePermissionSchema = z.object({
  permission: z.enum(['VIEW', 'CONTROL']),
});

/**
 * GET /api/teams/:teamId/terminals
 * List all terminals shared with the team
 */
router.get('/:teamId/terminals', async (req: Request, res: Response) => {
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

    const terminalShares = await prisma.teamTerminalShare.findMany({
      where: { teamId },
      include: {
        terminal: {
          include: {
            user: {
              select: { id: true, email: true, name: true, image: true },
            },
            category: {
              select: { id: true, name: true, color: true, icon: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const terminals = terminalShares.map((share) => ({
      id: share.id,
      terminalId: share.terminal.id,
      permission: share.permission,
      terminal: {
        id: share.terminal.id,
        name: share.terminal.name,
        status: share.terminal.status,
        type: share.terminal.type,
        cols: share.terminal.cols,
        rows: share.terminal.rows,
        cwd: share.terminal.cwd,
        isFavorite: share.terminal.isFavorite,
        lastActiveAt: share.terminal.lastActiveAt,
        owner: share.terminal.user,
        category: share.terminal.category,
        createdAt: share.terminal.createdAt,
        updatedAt: share.terminal.updatedAt,
      },
      createdAt: share.createdAt,
    }));

    res.json({
      success: true,
      data: { terminals, total: terminals.length },
    });
  } catch (error) {
    console.error('[API] List team terminals error:', error);
    res.status(500).json({ success: false, error: 'Failed to list team terminals' });
  }
});

/**
 * POST /api/teams/:teamId/terminals
 * Share a terminal with the team
 */
router.post('/:teamId/terminals', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const data = shareTerminalSchema.parse(req.body);

    // Verify membership and role
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Verify terminal ownership
    const terminal = await prisma.terminal.findUnique({
      where: { id: data.terminalId },
      include: {
        user: {
          select: { id: true, email: true, name: true, image: true },
        },
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    if (terminal.userId !== userId) {
      res.status(403).json({ success: false, error: 'Only terminal owners can share terminals' });
      return;
    }

    // Check if already shared
    const existingShare = await prisma.teamTerminalShare.findUnique({
      where: { terminalId_teamId: { terminalId: data.terminalId, teamId } },
    });

    if (existingShare) {
      res.status(400).json({ success: false, error: 'Terminal is already shared with this team' });
      return;
    }

    // Create share
    const share = await prisma.teamTerminalShare.create({
      data: {
        terminalId: data.terminalId,
        teamId,
        permission: data.permission as SharePermission,
      },
    });

    // Log audit
    await prisma.teamAuditLog.create({
      data: {
        teamId,
        userId,
        action: 'terminal.shared',
        resource: 'terminal',
        resourceId: data.terminalId,
        details: { permission: data.permission, terminalName: terminal.name },
      },
    });

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      const terminalShare: TeamTerminalShare = {
        id: share.id,
        terminalId: share.terminalId,
        teamId: share.teamId,
        permission: share.permission as unknown as SharePermission,
        terminal: {
          id: terminal.id,
          userId: terminal.userId,
          name: terminal.name,
          status: terminal.status as unknown as TerminalStatus,
          cols: terminal.cols,
          rows: terminal.rows,
          cwd: terminal.cwd,
          createdAt: terminal.createdAt,
          updatedAt: terminal.updatedAt,
        },
        createdAt: share.createdAt,
      };
      wsServer.broadcastToTeam(teamId, {
        type: 'team.terminal.added',
        teamId,
        terminalShare,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: share.id,
        terminalId: share.terminalId,
        permission: share.permission,
        terminal: {
          id: terminal.id,
          name: terminal.name,
          status: terminal.status,
          type: terminal.type,
          cols: terminal.cols,
          rows: terminal.rows,
          cwd: terminal.cwd,
          isFavorite: terminal.isFavorite,
          lastActiveAt: terminal.lastActiveAt,
          owner: terminal.user,
          category: terminal.category,
          createdAt: terminal.createdAt,
          updatedAt: terminal.updatedAt,
        },
        createdAt: share.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Share terminal with team error:', error);
    res.status(500).json({ success: false, error: 'Failed to share terminal with team' });
  }
});

/**
 * PATCH /api/teams/:teamId/terminals/:terminalId
 * Update terminal share permission
 */
router.patch('/:teamId/terminals/:terminalId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const terminalId = req.params.terminalId as string;
    const data = updatePermissionSchema.parse(req.body);

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Find the share
    const share = await prisma.teamTerminalShare.findUnique({
      where: { terminalId_teamId: { terminalId, teamId } },
      include: {
        terminal: true,
      },
    });

    if (!share) {
      res.status(404).json({ success: false, error: 'Terminal share not found' });
      return;
    }

    // Only terminal owner or team admin/owner can update
    const isTerminalOwner = share.terminal.userId === userId;
    const isTeamAdmin = membership.role === TeamRole.OWNER || membership.role === TeamRole.ADMIN;

    if (!isTerminalOwner && !isTeamAdmin) {
      res.status(403).json({ success: false, error: 'Only terminal owners or team admins can update permissions' });
      return;
    }

    // Update permission
    const updatedShare = await prisma.teamTerminalShare.update({
      where: { id: share.id },
      data: { permission: data.permission as SharePermission },
    });

    // Log audit
    await prisma.teamAuditLog.create({
      data: {
        teamId,
        userId,
        action: 'terminal.permission.changed',
        resource: 'terminal',
        resourceId: terminalId,
        details: {
          oldPermission: share.permission,
          newPermission: data.permission,
          terminalName: share.terminal.name,
        },
      },
    });

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.terminal.permission.changed',
        teamId,
        terminalId,
        permission: data.permission as SharePermission,
      });
    }

    res.json({
      success: true,
      data: {
        id: updatedShare.id,
        terminalId: updatedShare.terminalId,
        permission: updatedShare.permission,
        createdAt: updatedShare.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update team terminal permission error:', error);
    res.status(500).json({ success: false, error: 'Failed to update terminal permission' });
  }
});

/**
 * DELETE /api/teams/:teamId/terminals/:terminalId
 * Remove terminal from team
 */
router.delete('/:teamId/terminals/:terminalId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const terminalId = req.params.terminalId as string;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Find the share
    const share = await prisma.teamTerminalShare.findUnique({
      where: { terminalId_teamId: { terminalId, teamId } },
      include: {
        terminal: true,
      },
    });

    if (!share) {
      res.status(404).json({ success: false, error: 'Terminal share not found' });
      return;
    }

    // Only terminal owner or team admin/owner can remove
    const isTerminalOwner = share.terminal.userId === userId;
    const isTeamAdmin = membership.role === TeamRole.OWNER || membership.role === TeamRole.ADMIN;

    if (!isTerminalOwner && !isTeamAdmin) {
      res.status(403).json({ success: false, error: 'Only terminal owners or team admins can remove terminals' });
      return;
    }

    // Delete share
    await prisma.teamTerminalShare.delete({
      where: { id: share.id },
    });

    // Log audit
    await prisma.teamAuditLog.create({
      data: {
        teamId,
        userId,
        action: 'terminal.unshared',
        resource: 'terminal',
        resourceId: terminalId,
        details: { terminalName: share.terminal.name },
      },
    });

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.terminal.removed',
        teamId,
        terminalId,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Remove terminal from team error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove terminal from team' });
  }
});

export default router;
