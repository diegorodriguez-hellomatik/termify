import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { TeamRole } from '@termify/shared';
import { getWebSocketServer } from '../websocket/WebSocketServer.js';
import { NotificationService } from '../services/NotificationService.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
});

const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional().nullable(),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']).optional().default('MEMBER'),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
});

/**
 * GET /api/teams
 * List all teams the user is a member of
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const teamMemberships = await prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            _count: {
              select: { members: true, tasks: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const teams = teamMemberships.map((membership) => ({
      id: membership.team.id,
      name: membership.team.name,
      description: membership.team.description,
      color: membership.team.color,
      icon: membership.team.icon,
      role: membership.role,
      memberCount: membership.team._count.members,
      taskCount: membership.team._count.tasks,
      createdAt: membership.team.createdAt,
      updatedAt: membership.team.updatedAt,
    }));

    res.json({
      success: true,
      data: { teams },
    });
  } catch (error) {
    console.error('[API] List teams error:', error);
    res.status(500).json({ success: false, error: 'Failed to list teams' });
  }
});

/**
 * POST /api/teams
 * Create a new team (user becomes OWNER)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = createTeamSchema.parse(req.body);

    const team = await prisma.team.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color || '#6366f1',
        icon: data.icon,
        members: {
          create: {
            userId,
            role: TeamRole.OWNER,
          },
        },
      },
      include: {
        _count: {
          select: { members: true, tasks: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: team.id,
        name: team.name,
        description: team.description,
        color: team.color,
        icon: team.icon,
        role: TeamRole.OWNER,
        memberCount: team._count.members,
        taskCount: team._count.tasks,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Create team error:', error);
    res.status(500).json({ success: false, error: 'Failed to create team' });
  }
});

/**
 * GET /api/teams/:id
 * Get team details with members
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.id as string;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true, image: true },
            },
          },
          orderBy: [
            { role: 'asc' }, // OWNER first, then ADMIN, then MEMBER
            { createdAt: 'asc' },
          ],
        },
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!team) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: team.id,
        name: team.name,
        description: team.description,
        color: team.color,
        icon: team.icon,
        role: membership.role,
        memberCount: team.members.length,
        taskCount: team._count.tasks,
        members: team.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          email: m.user.email,
          name: m.user.name,
          image: m.user.image,
          createdAt: m.createdAt,
        })),
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      },
    });
  } catch (error) {
    console.error('[API] Get team error:', error);
    res.status(500).json({ success: false, error: 'Failed to get team' });
  }
});

/**
 * PATCH /api/teams/:id
 * Update team (OWNER or ADMIN only)
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.id as string;
    const data = updateTeamSchema.parse(req.body);

    // Verify membership and role
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    if (membership.role === TeamRole.MEMBER) {
      res.status(403).json({ success: false, error: 'Only team owners and admins can update the team' });
      return;
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
      },
      include: {
        _count: {
          select: { members: true, tasks: true },
        },
      },
    });

    res.json({
      success: true,
      data: {
        id: team.id,
        name: team.name,
        description: team.description,
        color: team.color,
        icon: team.icon,
        role: membership.role,
        memberCount: team._count.members,
        taskCount: team._count.tasks,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update team error:', error);
    res.status(500).json({ success: false, error: 'Failed to update team' });
  }
});

/**
 * DELETE /api/teams/:id
 * Delete team (OWNER only)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.id as string;

    // Verify ownership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    if (membership.role !== TeamRole.OWNER) {
      res.status(403).json({ success: false, error: 'Only team owners can delete the team' });
      return;
    }

    await prisma.team.delete({
      where: { id: teamId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete team error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete team' });
  }
});

/**
 * POST /api/teams/:id/invite
 * Invite a member to the team (OWNER or ADMIN only)
 */
router.post('/:id/invite', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.id as string;
    const data = inviteMemberSchema.parse(req.body);

    // Verify membership and role
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: {
        team: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    if (membership.role === TeamRole.MEMBER) {
      res.status(403).json({ success: false, error: 'Only team owners and admins can invite members' });
      return;
    }

    // Find user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!invitedUser) {
      res.status(404).json({ success: false, error: 'User not found with that email' });
      return;
    }

    // Check if already a member
    const existingMembership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: invitedUser.id } },
    });

    if (existingMembership) {
      res.status(400).json({ success: false, error: 'User is already a member of this team' });
      return;
    }

    // Add member
    const newMember = await prisma.teamMember.create({
      data: {
        teamId,
        userId: invitedUser.id,
        role: data.role as TeamRole,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
    });

    // Send notification to invited user
    const notificationService = NotificationService.getInstance();
    await notificationService.notifyTeamInvite(
      invitedUser.id,
      membership.team.name,
      membership.user.name || membership.user.email,
      teamId
    );

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.member.joined',
        teamId,
        member: {
          id: newMember.id,
          teamId: newMember.teamId,
          userId: newMember.userId,
          role: newMember.role as TeamRole,
          customRoleId: newMember.customRoleId,
          user: newMember.user as any,
          createdAt: newMember.createdAt,
          updatedAt: newMember.updatedAt,
        },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: newMember.id,
        userId: newMember.userId,
        role: newMember.role,
        email: newMember.user.email,
        name: newMember.user.name,
        image: newMember.user.image,
        createdAt: newMember.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Invite member error:', error);
    res.status(500).json({ success: false, error: 'Failed to invite member' });
  }
});

/**
 * PATCH /api/teams/:id/members/:memberId/role
 * Change member role (OWNER only)
 */
router.patch('/:id/members/:memberId/role', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.id as string;
    const memberId = req.params.memberId as string;
    const data = updateMemberRoleSchema.parse(req.body);

    // Verify ownership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    if (membership.role !== TeamRole.OWNER) {
      res.status(403).json({ success: false, error: 'Only team owners can change member roles' });
      return;
    }

    // Find target member
    const targetMember = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { team: true },
    });

    if (!targetMember || targetMember.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }

    if (targetMember.role === TeamRole.OWNER) {
      res.status(400).json({ success: false, error: 'Cannot change the owner role' });
      return;
    }

    // Update role
    const updatedMember = await prisma.teamMember.update({
      where: { id: memberId },
      data: { role: data.role as TeamRole },
      include: {
        user: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
    });

    // Send notification
    const notificationService = NotificationService.getInstance();
    await notificationService.notifyTeamRoleChanged(
      targetMember.userId,
      targetMember.team.name,
      data.role,
      teamId
    );

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.member.role.changed',
        teamId,
        memberId,
        role: data.role as TeamRole,
      });
    }

    res.json({
      success: true,
      data: {
        id: updatedMember.id,
        userId: updatedMember.userId,
        role: updatedMember.role,
        email: updatedMember.user.email,
        name: updatedMember.user.name,
        image: updatedMember.user.image,
        createdAt: updatedMember.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update member role error:', error);
    res.status(500).json({ success: false, error: 'Failed to update member role' });
  }
});

/**
 * DELETE /api/teams/:id/members/:memberId
 * Remove member or leave team
 */
router.delete('/:id/members/:memberId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.id as string;
    const memberId = req.params.memberId as string;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Find target member
    const targetMember = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { team: true },
    });

    if (!targetMember || targetMember.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }

    const isSelf = targetMember.userId === userId;
    const canRemove = membership.role === TeamRole.OWNER || membership.role === TeamRole.ADMIN;

    // Owner cannot leave (must transfer ownership or delete team)
    if (isSelf && targetMember.role === TeamRole.OWNER) {
      res.status(400).json({ success: false, error: 'Owner cannot leave. Transfer ownership or delete the team.' });
      return;
    }

    // Non-owners/admins can only remove themselves
    if (!isSelf && !canRemove) {
      res.status(403).json({ success: false, error: 'You can only remove yourself from the team' });
      return;
    }

    // Admins cannot remove other admins or owner
    if (!isSelf && membership.role === TeamRole.ADMIN && targetMember.role !== TeamRole.MEMBER) {
      res.status(403).json({ success: false, error: 'Admins can only remove regular members' });
      return;
    }

    // Remove member
    await prisma.teamMember.delete({
      where: { id: memberId },
    });

    // Send notification if removed by someone else
    if (!isSelf) {
      const notificationService = NotificationService.getInstance();
      await notificationService.notifyTeamMemberLeft(
        targetMember.userId,
        targetMember.team.name,
        teamId,
        true // wasRemoved
      );
    }

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.member.left',
        teamId,
        memberId,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Remove member error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove member' });
  }
});

export default router;
