import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, optionalAuthMiddleware } from '../auth/middleware.js';
import { ShareType, SharePermission } from '@termify/shared';
import { NotificationService } from '../services/NotificationService.js';

const router = Router();

// Validation schemas
const createLinkShareSchema = z.object({
  permission: z.nativeEnum(SharePermission).default(SharePermission.VIEW),
  expiresIn: z.number().int().min(0).max(365 * 24 * 60 * 60 * 1000).optional(), // Max 1 year in ms
});

const createEmailShareSchema = z.object({
  email: z.string().email(),
  permission: z.nativeEnum(SharePermission).default(SharePermission.VIEW),
});

const updateShareSchema = z.object({
  permission: z.nativeEnum(SharePermission),
});

/**
 * Generate a secure random token
 */
function generateShareToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * GET /api/workspaces/:workspaceId/share
 * List all shares for a workspace (owner only)
 */
router.get('/workspaces/:workspaceId/share', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const workspaceId = req.params.workspaceId as string;

    // Verify ownership
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId },
    });

    if (!workspace) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    const shares = await prisma.workspaceShare.findMany({
      where: { workspaceId },
      include: {
        sharedWith: {
          select: { id: true, email: true, name: true, image: true },
        },
        createdBy: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { shares },
    });
  } catch (error) {
    console.error('[API] Error listing workspace shares:', error);
    res.status(500).json({ success: false, error: 'Failed to list shares' });
  }
});

/**
 * POST /api/workspaces/:workspaceId/share/link
 * Create a share link for a workspace
 */
router.post('/workspaces/:workspaceId/share/link', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const workspaceId = req.params.workspaceId as string;
    const data = createLinkShareSchema.parse(req.body);

    // Verify ownership
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId },
    });

    if (!workspace) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    // Check if a link share already exists
    const existingShare = await prisma.workspaceShare.findFirst({
      where: { workspaceId, type: ShareType.LINK },
    });

    if (existingShare) {
      // Update existing share
      const updatedShare = await prisma.workspaceShare.update({
        where: { id: existingShare.id },
        data: {
          permission: data.permission,
          expiresAt: data.expiresIn ? new Date(Date.now() + data.expiresIn) : null,
        },
      });

      res.json({
        success: true,
        data: {
          share: updatedShare,
          shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/workspace/${updatedShare.shareToken}`,
        },
      });
      return;
    }

    // Create new link share
    const shareToken = generateShareToken();
    const share = await prisma.workspaceShare.create({
      data: {
        workspaceId,
        type: ShareType.LINK,
        shareToken,
        permission: data.permission,
        createdById: userId,
        expiresAt: data.expiresIn ? new Date(Date.now() + data.expiresIn) : null,
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'workspace.share.link.create',
        resource: 'workspace',
        resourceId: workspaceId,
        details: { permission: data.permission },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.status(201).json({
      success: true,
      data: {
        share,
        shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/workspace/${shareToken}`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error creating workspace share link:', error);
    res.status(500).json({ success: false, error: 'Failed to create share link' });
  }
});

/**
 * POST /api/workspaces/:workspaceId/share/email
 * Share workspace with a user by email
 */
router.post('/workspaces/:workspaceId/share/email', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const workspaceId = req.params.workspaceId as string;
    const data = createEmailShareSchema.parse(req.body);

    // Verify ownership
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId },
    });

    if (!workspace) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    // Can't share with yourself
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (currentUser?.email.toLowerCase() === data.email.toLowerCase()) {
      res.status(400).json({ success: false, error: 'You cannot share a workspace with yourself' });
      return;
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!targetUser) {
      res.status(404).json({ success: false, error: 'User not found. They must have an account to receive shared workspaces.' });
      return;
    }

    // Check if share already exists
    const existingShare = await prisma.workspaceShare.findFirst({
      where: {
        workspaceId,
        type: ShareType.EMAIL,
        sharedWithId: targetUser.id,
      },
    });

    if (existingShare) {
      // Update existing share
      const updatedShare = await prisma.workspaceShare.update({
        where: { id: existingShare.id },
        data: {
          permission: data.permission,
        },
        include: {
          sharedWith: {
            select: { id: true, email: true, name: true, image: true },
          },
        },
      });

      res.json({
        success: true,
        data: { share: updatedShare },
      });
      return;
    }

    // Create new email share
    const share = await prisma.workspaceShare.create({
      data: {
        workspaceId,
        type: ShareType.EMAIL,
        sharedEmail: targetUser.email,
        sharedWithId: targetUser.id,
        permission: data.permission,
        createdById: userId,
      },
      include: {
        sharedWith: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'workspace.share.email.create',
        resource: 'workspace',
        resourceId: workspaceId,
        details: { email: data.email, permission: data.permission },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // Send notification to the recipient
    await NotificationService.create({
      userId: targetUser.id,
      type: 'WORKSPACE_SHARED',
      title: 'Workspace shared with you',
      message: `${currentUser?.name || currentUser?.email || 'Someone'} shared the workspace "${workspace.name}" with you`,
      metadata: {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        shareId: share.id,
        permission: data.permission,
      },
    });

    res.status(201).json({
      success: true,
      data: { share },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error creating workspace email share:', error);
    res.status(500).json({ success: false, error: 'Failed to create email share' });
  }
});

/**
 * PATCH /api/workspaces/:workspaceId/share/:shareId
 * Update share permissions
 */
router.patch('/workspaces/:workspaceId/share/:shareId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const workspaceId = req.params.workspaceId as string;
    const shareId = req.params.shareId as string;
    const data = updateShareSchema.parse(req.body);

    // Verify ownership
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId },
    });

    if (!workspace) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    // Verify share exists and belongs to this workspace
    const share = await prisma.workspaceShare.findFirst({
      where: { id: shareId, workspaceId },
    });

    if (!share) {
      res.status(404).json({ success: false, error: 'Share not found' });
      return;
    }

    const updatedShare = await prisma.workspaceShare.update({
      where: { id: shareId },
      data: { permission: data.permission },
      include: {
        sharedWith: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
    });

    // Send notification if it was an email share and permission changed
    if (share.type === ShareType.EMAIL && share.sharedWithId && share.permission !== data.permission) {
      const currentUser = await prisma.user.findUnique({ where: { id: userId } });
      await NotificationService.create({
        userId: share.sharedWithId,
        type: 'WORKSPACE_SHARE_UPDATED',
        title: 'Workspace share updated',
        message: `${currentUser?.name || currentUser?.email || 'Someone'} updated your access to "${workspace.name}" to ${data.permission}`,
        metadata: {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          shareId: share.id,
          permission: data.permission,
        },
      });
    }

    res.json({
      success: true,
      data: { share: updatedShare },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error updating workspace share:', error);
    res.status(500).json({ success: false, error: 'Failed to update share' });
  }
});

/**
 * DELETE /api/workspaces/:workspaceId/share/:shareId
 * Revoke a share
 */
router.delete('/workspaces/:workspaceId/share/:shareId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const workspaceId = req.params.workspaceId as string;
    const shareId = req.params.shareId as string;

    // Verify ownership
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId },
    });

    if (!workspace) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    // Verify share exists and belongs to this workspace
    const share = await prisma.workspaceShare.findFirst({
      where: { id: shareId, workspaceId },
    });

    if (!share) {
      res.status(404).json({ success: false, error: 'Share not found' });
      return;
    }

    await prisma.workspaceShare.delete({
      where: { id: shareId },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'workspace.share.revoke',
        resource: 'workspace',
        resourceId: workspaceId,
        details: { shareId, type: share.type },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // Send notification if it was an email share
    if (share.type === ShareType.EMAIL && share.sharedWithId) {
      const currentUser = await prisma.user.findUnique({ where: { id: userId } });
      await NotificationService.create({
        userId: share.sharedWithId,
        type: 'WORKSPACE_SHARE_REVOKED',
        title: 'Workspace access revoked',
        message: `${currentUser?.name || currentUser?.email || 'Someone'} revoked your access to "${workspace.name}"`,
        metadata: {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error revoking workspace share:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke share' });
  }
});

/**
 * GET /api/share/workspace/:token
 * Access a shared workspace by token (public endpoint, optional auth)
 */
router.get('/share/workspace/:token', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string;
    const userId = req.user?.userId;

    const share = await prisma.workspaceShare.findUnique({
      where: { shareToken: token },
      include: {
        workspace: {
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
                    cols: true,
                    rows: true,
                    cwd: true,
                    isFavorite: true,
                    lastActiveAt: true,
                  },
                },
              },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    if (!share) {
      res.status(404).json({ success: false, error: 'Share not found or expired' });
      return;
    }

    // Check expiration
    if (share.expiresAt && share.expiresAt < new Date()) {
      res.status(410).json({ success: false, error: 'Share link has expired' });
      return;
    }

    // Update access stats
    await prisma.workspaceShare.update({
      where: { id: share.id },
      data: {
        lastAccessedAt: new Date(),
        accessCount: { increment: 1 },
      },
    });

    // Format terminals
    const terminals = share.workspace.terminals.map((wt) => ({
      ...wt.terminal,
      position: wt.position,
    }));

    res.json({
      success: true,
      data: {
        share: {
          id: share.id,
          permission: share.permission,
          type: share.type,
        },
        workspace: {
          id: share.workspace.id,
          name: share.workspace.name,
          description: share.workspace.description,
          color: share.workspace.color,
          icon: share.workspace.icon,
          layout: share.workspace.layout,
          floatingLayout: share.workspace.floatingLayout,
          settings: share.workspace.settings,
          user: share.workspace.user,
          terminals,
          terminalCount: terminals.length,
        },
        isAuthenticated: !!userId,
      },
    });
  } catch (error) {
    console.error('[API] Error accessing shared workspace:', error);
    res.status(500).json({ success: false, error: 'Failed to access shared workspace' });
  }
});

/**
 * GET /api/workspaces/shared
 * List workspaces shared with the current user
 */
router.get('/workspaces/shared', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Find shares where user is explicitly shared with (by ID or email)
    const shares = await prisma.workspaceShare.findMany({
      where: {
        type: ShareType.EMAIL,
        OR: [
          { sharedWithId: userId },
          { sharedEmail: user.email },
        ],
      },
      include: {
        workspace: {
          include: {
            user: {
              select: { id: true, email: true, name: true, image: true },
            },
            terminals: {
              select: { id: true },
            },
          },
        },
        createdBy: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Update sharedWithId if it was shared by email before user registered
    for (const share of shares) {
      if (share.sharedEmail === user.email && !share.sharedWithId) {
        await prisma.workspaceShare.update({
          where: { id: share.id },
          data: { sharedWithId: userId },
        });
      }
    }

    // Return workspaces with share info
    const sharedWorkspaces = shares.map((share) => ({
      id: share.workspace.id,
      name: share.workspace.name,
      description: share.workspace.description,
      color: share.workspace.color,
      icon: share.workspace.icon,
      terminalCount: share.workspace.terminals.length,
      user: share.workspace.user,
      share: {
        id: share.id,
        permission: share.permission,
        createdBy: share.createdBy,
        createdAt: share.createdAt,
      },
    }));

    res.json({
      success: true,
      data: {
        workspaces: sharedWorkspaces,
        total: sharedWorkspaces.length,
      },
    });
  } catch (error) {
    console.error('[API] Error listing shared workspaces:', error);
    res.status(500).json({ success: false, error: 'Failed to list shared workspaces' });
  }
});

export default router;
