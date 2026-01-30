import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import {
  TeamRole,
  TeamPermission,
  DEFAULT_OWNER_PERMISSIONS,
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_MEMBER_PERMISSIONS,
  TeamCustomRole,
} from '@termify/shared';
import { getWebSocketServer } from '../websocket/WebSocketServer.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#6366f1'),
  permissions: z.array(z.nativeEnum(TeamPermission)),
  position: z.number().int().min(0).optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  permissions: z.array(z.nativeEnum(TeamPermission)).optional(),
  position: z.number().int().min(0).optional(),
});

const assignRoleSchema = z.object({
  customRoleId: z.string().optional().nullable(),
});

/**
 * Helper to check if user has permission
 */
async function hasPermission(
  teamId: string,
  userId: string,
  permission: TeamPermission
): Promise<boolean> {
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: { customRole: true },
  });

  if (!membership) return false;

  // If has custom role, check its permissions
  if (membership.customRole) {
    return membership.customRole.permissions.includes(permission);
  }

  // Fall back to legacy role
  if (membership.role === TeamRole.OWNER) {
    return DEFAULT_OWNER_PERMISSIONS.includes(permission);
  }
  if (membership.role === TeamRole.ADMIN) {
    return DEFAULT_ADMIN_PERMISSIONS.includes(permission);
  }
  return DEFAULT_MEMBER_PERMISSIONS.includes(permission);
}

/**
 * GET /api/teams/:teamId/roles
 * List all custom roles for the team
 */
router.get('/:teamId/roles', async (req: Request, res: Response) => {
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

    const roles = await prisma.teamCustomRole.findMany({
      where: { teamId },
      orderBy: { position: 'asc' },
    });

    // Include built-in roles info for reference
    const builtInRoles = [
      {
        id: 'owner',
        name: 'Owner',
        description: 'Full access to all team features',
        color: '#ef4444',
        permissions: DEFAULT_OWNER_PERMISSIONS,
        isBuiltIn: true,
      },
      {
        id: 'admin',
        name: 'Admin',
        description: 'Can manage team resources and members',
        color: '#f59e0b',
        permissions: DEFAULT_ADMIN_PERMISSIONS,
        isBuiltIn: true,
      },
      {
        id: 'member',
        name: 'Member',
        description: 'Standard team member access',
        color: '#6366f1',
        permissions: DEFAULT_MEMBER_PERMISSIONS,
        isBuiltIn: true,
      },
    ];

    res.json({
      success: true,
      data: {
        roles: roles.map((r) => ({
          ...r,
          permissions: r.permissions as TeamPermission[],
        })),
        builtInRoles,
        availablePermissions: Object.values(TeamPermission),
      },
    });
  } catch (error) {
    console.error('[API] List team roles error:', error);
    res.status(500).json({ success: false, error: 'Failed to list team roles' });
  }
});

/**
 * POST /api/teams/:teamId/roles
 * Create a new custom role
 */
router.post('/:teamId/roles', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const data = createRoleSchema.parse(req.body);

    // Check permission
    if (!(await hasPermission(teamId, userId, TeamPermission.MANAGE_ROLES))) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    // Get max position for ordering
    const maxPosition = await prisma.teamCustomRole.aggregate({
      where: { teamId },
      _max: { position: true },
    });

    const role = await prisma.teamCustomRole.create({
      data: {
        teamId,
        name: data.name,
        description: data.description,
        color: data.color,
        permissions: data.permissions,
        position: data.position ?? (maxPosition._max.position ?? 0) + 1,
        isSystem: false,
      },
    });

    // Log audit
    await prisma.teamAuditLog.create({
      data: {
        teamId,
        userId,
        action: 'role.created',
        resource: 'role',
        resourceId: role.id,
        details: { roleName: role.name, permissions: data.permissions },
      },
    });

    // Broadcast
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.role.created',
        teamId,
        role: {
          ...role,
          permissions: role.permissions as TeamPermission[],
        } as TeamCustomRole,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        ...role,
        permissions: role.permissions as TeamPermission[],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Create team role error:', error);
    res.status(500).json({ success: false, error: 'Failed to create team role' });
  }
});

/**
 * PATCH /api/teams/:teamId/roles/:roleId
 * Update a custom role
 */
router.patch('/:teamId/roles/:roleId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const roleId = req.params.roleId as string;
    const data = updateRoleSchema.parse(req.body);

    // Check permission
    if (!(await hasPermission(teamId, userId, TeamPermission.MANAGE_ROLES))) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    // Find role
    const existingRole = await prisma.teamCustomRole.findUnique({
      where: { id: roleId },
    });

    if (!existingRole || existingRole.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Role not found' });
      return;
    }

    if (existingRole.isSystem) {
      res.status(403).json({ success: false, error: 'Cannot modify system roles' });
      return;
    }

    const role = await prisma.teamCustomRole.update({
      where: { id: roleId },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        permissions: data.permissions,
        position: data.position,
      },
    });

    // Log audit
    await prisma.teamAuditLog.create({
      data: {
        teamId,
        userId,
        action: 'role.updated',
        resource: 'role',
        resourceId: role.id,
        details: { roleName: role.name, changes: data },
      },
    });

    // Broadcast
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.role.updated',
        teamId,
        role: {
          ...role,
          permissions: role.permissions as TeamPermission[],
        } as TeamCustomRole,
      });
    }

    res.json({
      success: true,
      data: {
        ...role,
        permissions: role.permissions as TeamPermission[],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update team role error:', error);
    res.status(500).json({ success: false, error: 'Failed to update team role' });
  }
});

/**
 * DELETE /api/teams/:teamId/roles/:roleId
 * Delete a custom role
 */
router.delete('/:teamId/roles/:roleId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const roleId = req.params.roleId as string;

    // Check permission
    if (!(await hasPermission(teamId, userId, TeamPermission.MANAGE_ROLES))) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    // Find role
    const role = await prisma.teamCustomRole.findUnique({
      where: { id: roleId },
      include: { members: true },
    });

    if (!role || role.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Role not found' });
      return;
    }

    if (role.isSystem) {
      res.status(403).json({ success: false, error: 'Cannot delete system roles' });
      return;
    }

    if (role.members.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete role with assigned members. Reassign members first.',
      });
      return;
    }

    await prisma.teamCustomRole.delete({
      where: { id: roleId },
    });

    // Log audit
    await prisma.teamAuditLog.create({
      data: {
        teamId,
        userId,
        action: 'role.deleted',
        resource: 'role',
        resourceId: roleId,
        details: { roleName: role.name },
      },
    });

    // Broadcast
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.role.deleted',
        teamId,
        roleId,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete team role error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete team role' });
  }
});

/**
 * PATCH /api/teams/:teamId/members/:memberId/role
 * Assign a custom role to a member
 */
router.patch('/:teamId/members/:memberId/role', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const memberId = req.params.memberId as string;
    const data = assignRoleSchema.parse(req.body);

    // Check permission
    if (!(await hasPermission(teamId, userId, TeamPermission.CHANGE_MEMBER_ROLE))) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    // Find member
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true, email: true, name: true, image: true } } },
    });

    if (!member || member.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }

    // Cannot change owner's role
    if (member.role === TeamRole.OWNER) {
      res.status(403).json({ success: false, error: 'Cannot change team owner role' });
      return;
    }

    // Validate custom role if provided
    let customRole = null;
    if (data.customRoleId) {
      customRole = await prisma.teamCustomRole.findUnique({
        where: { id: data.customRoleId },
      });

      if (!customRole || customRole.teamId !== teamId) {
        res.status(404).json({ success: false, error: 'Role not found' });
        return;
      }
    }

    const updatedMember = await prisma.teamMember.update({
      where: { id: memberId },
      data: { customRoleId: data.customRoleId },
      include: {
        user: { select: { id: true, email: true, name: true, image: true } },
        customRole: true,
      },
    });

    // Log audit
    await prisma.teamAuditLog.create({
      data: {
        teamId,
        userId,
        action: 'member.role.changed',
        resource: 'member',
        resourceId: memberId,
        details: {
          memberEmail: member.user?.email,
          newRole: customRole?.name ?? 'default',
        },
      },
    });

    // Broadcast
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.member.role.changed',
        teamId,
        memberId,
        role: updatedMember.role as TeamRole,
        customRole: updatedMember.customRole
          ? ({
              ...updatedMember.customRole,
              permissions: updatedMember.customRole.permissions as TeamPermission[],
            } as TeamCustomRole)
          : undefined,
      });
    }

    res.json({
      success: true,
      data: {
        ...updatedMember,
        customRole: updatedMember.customRole
          ? {
              ...updatedMember.customRole,
              permissions: updatedMember.customRole.permissions as TeamPermission[],
            }
          : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Assign member role error:', error);
    res.status(500).json({ success: false, error: 'Failed to assign role' });
  }
});

/**
 * GET /api/teams/:teamId/members/:memberId/permissions
 * Get effective permissions for a member
 */
router.get('/:teamId/members/:memberId/permissions', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
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
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { customRole: true },
    });

    if (!member || member.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }

    // Calculate effective permissions
    let permissions: TeamPermission[];
    let roleSource: string;

    if (member.customRole) {
      permissions = member.customRole.permissions as TeamPermission[];
      roleSource = `custom:${member.customRole.name}`;
    } else if (member.role === TeamRole.OWNER) {
      permissions = DEFAULT_OWNER_PERMISSIONS;
      roleSource = 'builtin:owner';
    } else if (member.role === TeamRole.ADMIN) {
      permissions = DEFAULT_ADMIN_PERMISSIONS;
      roleSource = 'builtin:admin';
    } else {
      permissions = DEFAULT_MEMBER_PERMISSIONS;
      roleSource = 'builtin:member';
    }

    res.json({
      success: true,
      data: {
        memberId,
        roleSource,
        permissions,
        allPermissions: Object.values(TeamPermission),
      },
    });
  } catch (error) {
    console.error('[API] Get member permissions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get permissions' });
  }
});

export default router;
export { hasPermission };
