import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, optionalAuthMiddleware } from '../auth/middleware.js';
import { ShareType, SharePermission } from '@termify/shared';

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
 * GET /api/terminals/:terminalId/share
 * List all shares for a terminal (owner only)
 */
router.get('/terminals/:terminalId/share', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const terminalId = req.params.terminalId as string;

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id: terminalId, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    const shares = await prisma.terminalShare.findMany({
      where: { terminalId },
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
    console.error('[API] Error listing shares:', error);
    res.status(500).json({ success: false, error: 'Failed to list shares' });
  }
});

/**
 * POST /api/terminals/:terminalId/share/link
 * Create a share link for a terminal
 */
router.post('/terminals/:terminalId/share/link', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const terminalId = req.params.terminalId as string;
    const data = createLinkShareSchema.parse(req.body);

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id: terminalId, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Check if a link share already exists
    const existingShare = await prisma.terminalShare.findFirst({
      where: { terminalId, type: ShareType.LINK },
    });

    if (existingShare) {
      // Update existing share
      const updatedShare = await prisma.terminalShare.update({
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
          shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${updatedShare.shareToken}`,
        },
      });
      return;
    }

    // Create new link share
    const shareToken = generateShareToken();
    const share = await prisma.terminalShare.create({
      data: {
        terminalId,
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
        action: 'terminal.share.link.create',
        resource: 'terminal',
        resourceId: terminalId,
        details: { permission: data.permission },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.status(201).json({
      success: true,
      data: {
        share,
        shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${shareToken}`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error creating share link:', error);
    res.status(500).json({ success: false, error: 'Failed to create share link' });
  }
});

/**
 * POST /api/terminals/:terminalId/share/email
 * Share terminal with a user by email
 */
router.post('/terminals/:terminalId/share/email', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const terminalId = req.params.terminalId as string;
    const data = createEmailShareSchema.parse(req.body);

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id: terminalId, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Can't share with yourself
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (currentUser?.email.toLowerCase() === data.email.toLowerCase()) {
      res.status(400).json({ success: false, error: 'You cannot share a terminal with yourself' });
      return;
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!targetUser) {
      res.status(404).json({ success: false, error: 'User not found. They must have an account to receive shared terminals.' });
      return;
    }

    // Check if share already exists
    const existingShare = await prisma.terminalShare.findFirst({
      where: {
        terminalId,
        type: ShareType.EMAIL,
        sharedWithId: targetUser.id,
      },
    });

    if (existingShare) {
      // Update existing share
      const updatedShare = await prisma.terminalShare.update({
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
    const share = await prisma.terminalShare.create({
      data: {
        terminalId,
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
        action: 'terminal.share.email.create',
        resource: 'terminal',
        resourceId: terminalId,
        details: { email: data.email, permission: data.permission },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
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
    console.error('[API] Error creating email share:', error);
    res.status(500).json({ success: false, error: 'Failed to create email share' });
  }
});

/**
 * PATCH /api/terminals/:terminalId/share/:shareId
 * Update share permissions
 */
router.patch('/terminals/:terminalId/share/:shareId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const terminalId = req.params.terminalId as string;
    const shareId = req.params.shareId as string;
    const data = updateShareSchema.parse(req.body);

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id: terminalId, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Verify share exists and belongs to this terminal
    const share = await prisma.terminalShare.findFirst({
      where: { id: shareId, terminalId },
    });

    if (!share) {
      res.status(404).json({ success: false, error: 'Share not found' });
      return;
    }

    const updatedShare = await prisma.terminalShare.update({
      where: { id: shareId },
      data: { permission: data.permission },
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error updating share:', error);
    res.status(500).json({ success: false, error: 'Failed to update share' });
  }
});

/**
 * DELETE /api/terminals/:terminalId/share/:shareId
 * Revoke a share
 */
router.delete('/terminals/:terminalId/share/:shareId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const terminalId = req.params.terminalId as string;
    const shareId = req.params.shareId as string;

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id: terminalId, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Verify share exists and belongs to this terminal
    const share = await prisma.terminalShare.findFirst({
      where: { id: shareId, terminalId },
    });

    if (!share) {
      res.status(404).json({ success: false, error: 'Share not found' });
      return;
    }

    await prisma.terminalShare.delete({
      where: { id: shareId },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'terminal.share.revoke',
        resource: 'terminal',
        resourceId: terminalId,
        details: { shareId, type: share.type },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error revoking share:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke share' });
  }
});

/**
 * GET /api/share/:token
 * Access a shared terminal by token (public endpoint, optional auth)
 */
router.get('/share/:token', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string;
    const userId = req.user?.userId;

    const share = await prisma.terminalShare.findUnique({
      where: { shareToken: token },
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
    await prisma.terminalShare.update({
      where: { id: share.id },
      data: {
        lastAccessedAt: new Date(),
        accessCount: { increment: 1 },
      },
    });

    // Don't return sensitive data
    const { sshPassword, sshPrivateKey, outputBuffer, ...safeTerminal } = share.terminal;

    res.json({
      success: true,
      data: {
        share: {
          id: share.id,
          permission: share.permission,
          type: share.type,
        },
        terminal: safeTerminal,
        isAuthenticated: !!userId,
      },
    });
  } catch (error) {
    console.error('[API] Error accessing shared terminal:', error);
    res.status(500).json({ success: false, error: 'Failed to access shared terminal' });
  }
});

/**
 * GET /api/terminals/shared
 * List terminals shared with the current user
 */
router.get('/terminals/shared', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Find shares where user is explicitly shared with (by ID or email)
    const shares = await prisma.terminalShare.findMany({
      where: {
        type: ShareType.EMAIL,
        OR: [
          { sharedWithId: userId },
          { sharedEmail: user.email },
        ],
      },
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
        createdBy: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Update sharedWithId if it was shared by email before user registered
    for (const share of shares) {
      if (share.sharedEmail === user.email && !share.sharedWithId) {
        await prisma.terminalShare.update({
          where: { id: share.id },
          data: { sharedWithId: userId },
        });
      }
    }

    // Return terminals with share info
    const sharedTerminals = shares.map((share) => {
      const { sshPassword, sshPrivateKey, outputBuffer, ...safeTerminal } = share.terminal;
      return {
        ...safeTerminal,
        share: {
          id: share.id,
          permission: share.permission,
          createdBy: share.createdBy,
          createdAt: share.createdAt,
        },
      };
    });

    res.json({
      success: true,
      data: {
        terminals: sharedTerminals,
        total: sharedTerminals.length,
      },
    });
  } catch (error) {
    console.error('[API] Error listing shared terminals:', error);
    res.status(500).json({ success: false, error: 'Failed to list shared terminals' });
  }
});

export default router;
