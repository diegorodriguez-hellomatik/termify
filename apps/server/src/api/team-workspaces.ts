import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { TeamRole, Workspace, WorkspaceLayout, WorkspaceSettings } from '@termify/shared';
import { getWebSocketServer } from '../websocket/WebSocketServer.js';
import { mapWorkspace } from '../lib/type-mappers.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const shareWorkspaceSchema = z.object({
  workspaceId: z.string().min(1),
  isTeamDefault: z.boolean().optional().default(false),
});

const updateWorkspaceLayoutSchema = z.object({
  layout: z.any().optional().nullable(),
  isTeamDefault: z.boolean().optional(),
});

/**
 * GET /api/teams/:teamId/workspaces
 * List all workspaces shared with the team
 */
router.get('/:teamId/workspaces', async (req: Request, res: Response) => {
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

    const workspaces = await prisma.workspace.findMany({
      where: { teamId },
      include: {
        user: {
          select: { id: true, email: true, name: true, image: true },
        },
        terminals: {
          include: {
            terminal: {
              select: {
                id: true,
                name: true,
                status: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: [{ isTeamDefault: 'desc' }, { position: 'asc' }],
    });

    const formattedWorkspaces = workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      description: ws.description,
      color: ws.color,
      icon: ws.icon,
      isTeamDefault: ws.isTeamDefault,
      position: ws.position,
      layout: ws.layout,
      settings: ws.settings,
      owner: ws.user,
      terminalCount: ws.terminals.length,
      terminals: ws.terminals.map((t) => ({
        id: t.terminal.id,
        name: t.terminal.name,
        status: t.terminal.status,
        type: t.terminal.type,
        position: t.position,
      })),
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
    }));

    res.json({
      success: true,
      data: { workspaces: formattedWorkspaces, total: formattedWorkspaces.length },
    });
  } catch (error) {
    console.error('[API] List team workspaces error:', error);
    res.status(500).json({ success: false, error: 'Failed to list team workspaces' });
  }
});

/**
 * POST /api/teams/:teamId/workspaces
 * Share a workspace with the team
 */
router.post('/:teamId/workspaces', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const data = shareWorkspaceSchema.parse(req.body);

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Verify workspace ownership
    const workspace = await prisma.workspace.findUnique({
      where: { id: data.workspaceId },
      include: {
        user: {
          select: { id: true, email: true, name: true, image: true },
        },
        terminals: {
          include: {
            terminal: {
              select: { id: true, name: true, status: true, type: true },
            },
          },
        },
      },
    });

    if (!workspace) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    if (workspace.userId !== userId) {
      res.status(403).json({ success: false, error: 'Only workspace owners can share workspaces' });
      return;
    }

    if (workspace.teamId) {
      res.status(400).json({ success: false, error: 'Workspace is already shared with a team' });
      return;
    }

    // If setting as team default, unset other defaults
    if (data.isTeamDefault) {
      await prisma.workspace.updateMany({
        where: { teamId, isTeamDefault: true },
        data: { isTeamDefault: false },
      });
    }

    // Update workspace with team
    const updatedWorkspace = await prisma.workspace.update({
      where: { id: data.workspaceId },
      data: {
        teamId,
        isTeamDefault: data.isTeamDefault,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, image: true },
        },
        terminals: {
          include: {
            terminal: {
              select: { id: true, name: true, status: true, type: true },
            },
          },
        },
      },
    });

    // Log audit
    await prisma.teamAuditLog.create({
      data: {
        teamId,
        userId,
        action: 'workspace.shared',
        resource: 'workspace',
        resourceId: data.workspaceId,
        details: { workspaceName: workspace.name, isTeamDefault: data.isTeamDefault },
      },
    });

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.workspace.added',
        teamId,
        workspace: mapWorkspace(updatedWorkspace),
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: updatedWorkspace.id,
        name: updatedWorkspace.name,
        description: updatedWorkspace.description,
        color: updatedWorkspace.color,
        icon: updatedWorkspace.icon,
        isTeamDefault: updatedWorkspace.isTeamDefault,
        position: updatedWorkspace.position,
        layout: updatedWorkspace.layout,
        settings: updatedWorkspace.settings,
        owner: updatedWorkspace.user,
        terminalCount: updatedWorkspace.terminals.length,
        terminals: updatedWorkspace.terminals.map((t) => ({
          id: t.terminal.id,
          name: t.terminal.name,
          status: t.terminal.status,
          type: t.terminal.type,
          position: t.position,
        })),
        createdAt: updatedWorkspace.createdAt,
        updatedAt: updatedWorkspace.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Share workspace with team error:', error);
    res.status(500).json({ success: false, error: 'Failed to share workspace with team' });
  }
});

/**
 * PATCH /api/teams/:teamId/workspaces/:workspaceId
 * Update workspace layout or settings
 */
router.patch('/:teamId/workspaces/:workspaceId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const workspaceId = req.params.workspaceId as string;
    const data = updateWorkspaceLayoutSchema.parse(req.body);

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Find workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace || workspace.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Workspace not found in this team' });
      return;
    }

    // Only workspace owner or team admin/owner can update
    const isWorkspaceOwner = workspace.userId === userId;
    const isTeamAdmin = membership.role === TeamRole.OWNER || membership.role === TeamRole.ADMIN;

    if (!isWorkspaceOwner && !isTeamAdmin) {
      res.status(403).json({ success: false, error: 'Only workspace owners or team admins can update workspaces' });
      return;
    }

    // If setting as team default, unset other defaults
    if (data.isTeamDefault) {
      await prisma.workspace.updateMany({
        where: { teamId, isTeamDefault: true, id: { not: workspaceId } },
        data: { isTeamDefault: false },
      });
    }

    // Update workspace
    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        layout: data.layout !== undefined ? data.layout : undefined,
        isTeamDefault: data.isTeamDefault,
      },
    });

    // Broadcast layout change if applicable
    if (data.layout !== undefined) {
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.broadcastToTeam(teamId, {
          type: 'team.workspace.layout.changed',
          teamId,
          workspaceId,
          layout: data.layout,
        });
      }
    }

    res.json({
      success: true,
      data: {
        id: updatedWorkspace.id,
        name: updatedWorkspace.name,
        layout: updatedWorkspace.layout,
        isTeamDefault: updatedWorkspace.isTeamDefault,
        updatedAt: updatedWorkspace.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update team workspace error:', error);
    res.status(500).json({ success: false, error: 'Failed to update team workspace' });
  }
});

/**
 * DELETE /api/teams/:teamId/workspaces/:workspaceId
 * Remove workspace from team (unshare)
 */
router.delete('/:teamId/workspaces/:workspaceId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const workspaceId = req.params.workspaceId as string;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Find workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace || workspace.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Workspace not found in this team' });
      return;
    }

    // Only workspace owner or team admin/owner can remove
    const isWorkspaceOwner = workspace.userId === userId;
    const isTeamAdmin = membership.role === TeamRole.OWNER || membership.role === TeamRole.ADMIN;

    if (!isWorkspaceOwner && !isTeamAdmin) {
      res.status(403).json({ success: false, error: 'Only workspace owners or team admins can remove workspaces' });
      return;
    }

    // Unshare (remove teamId)
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        teamId: null,
        isTeamDefault: false,
      },
    });

    // Log audit
    await prisma.teamAuditLog.create({
      data: {
        teamId,
        userId,
        action: 'workspace.unshared',
        resource: 'workspace',
        resourceId: workspaceId,
        details: { workspaceName: workspace.name },
      },
    });

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.workspace.removed',
        teamId,
        workspaceId,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Remove workspace from team error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove workspace from team' });
  }
});

export default router;
