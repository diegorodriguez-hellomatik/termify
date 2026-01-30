import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { TeamRole, ServerStatus as SharedServerStatus } from '@termify/shared';
import { ServerAuthMethod, ServerStatus } from '@prisma/client';
import { getWebSocketServer } from '../websocket/WebSocketServer.js';
import { Client } from 'ssh2';
import { mapTeamServer } from '../lib/type-mappers.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).optional().default(22),
  username: z.string().max(100).optional(),
  authMethod: z.enum(['PASSWORD', 'KEY', 'AGENT']).optional().default('PASSWORD'),
  description: z.string().max(500).optional(),
  documentation: z.string().optional(),
  tags: z.array(z.string().max(50)).max(10).optional().default([]),
});

const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  host: z.string().min(1).max(255).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().max(100).optional(),
  authMethod: z.enum(['PASSWORD', 'KEY', 'AGENT']).optional(),
  description: z.string().max(500).optional().nullable(),
  documentation: z.string().optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

/**
 * GET /api/teams/:teamId/servers
 * List all servers for the team
 */
router.get('/:teamId/servers', async (req: Request, res: Response) => {
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

    const servers = await prisma.teamServer.findMany({
      where: { teamId },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        servers: servers.map((s) => ({
          id: s.id,
          name: s.name,
          host: s.host,
          port: s.port,
          username: s.username,
          authMethod: s.authMethod,
          description: s.description,
          documentation: s.documentation,
          tags: s.tags,
          lastStatus: s.lastStatus,
          lastCheckedAt: s.lastCheckedAt,
          createdBy: s.createdBy,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
        total: servers.length,
      },
    });
  } catch (error) {
    console.error('[API] List team servers error:', error);
    res.status(500).json({ success: false, error: 'Failed to list team servers' });
  }
});

/**
 * GET /api/teams/:teamId/servers/:serverId
 * Get server details
 */
router.get('/:teamId/servers/:serverId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const serverId = req.params.serverId as string;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    const server = await prisma.teamServer.findUnique({
      where: { id: serverId },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
    });

    if (!server || server.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Server not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: server.id,
        name: server.name,
        host: server.host,
        port: server.port,
        username: server.username,
        authMethod: server.authMethod,
        description: server.description,
        documentation: server.documentation,
        tags: server.tags,
        lastStatus: server.lastStatus,
        lastCheckedAt: server.lastCheckedAt,
        createdBy: server.createdBy,
        createdAt: server.createdAt,
        updatedAt: server.updatedAt,
      },
    });
  } catch (error) {
    console.error('[API] Get team server error:', error);
    res.status(500).json({ success: false, error: 'Failed to get team server' });
  }
});

/**
 * POST /api/teams/:teamId/servers
 * Create a new team server
 */
router.post('/:teamId/servers', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const data = createServerSchema.parse(req.body);

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    const server = await prisma.teamServer.create({
      data: {
        teamId,
        createdById: userId,
        name: data.name,
        host: data.host,
        port: data.port,
        username: data.username,
        authMethod: data.authMethod as ServerAuthMethod,
        description: data.description,
        documentation: data.documentation,
        tags: data.tags,
        lastStatus: ServerStatus.UNKNOWN,
      },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
    });

    const mappedServer = mapTeamServer(server);

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.server.created',
        teamId,
        server: mappedServer,
      });
    }

    res.status(201).json({
      success: true,
      data: mappedServer,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Create team server error:', error);
    res.status(500).json({ success: false, error: 'Failed to create team server' });
  }
});

/**
 * PATCH /api/teams/:teamId/servers/:serverId
 * Update a team server
 */
router.patch('/:teamId/servers/:serverId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const serverId = req.params.serverId as string;
    const data = updateServerSchema.parse(req.body);

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Find server
    const server = await prisma.teamServer.findUnique({
      where: { id: serverId },
    });

    if (!server || server.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Server not found' });
      return;
    }

    // Only creator or team admin/owner can update
    const isCreator = server.createdById === userId;
    const isTeamAdmin = membership.role === TeamRole.OWNER || membership.role === TeamRole.ADMIN;

    if (!isCreator && !isTeamAdmin) {
      res.status(403).json({ success: false, error: 'Only server creators or team admins can update servers' });
      return;
    }

    const updatedServer = await prisma.teamServer.update({
      where: { id: serverId },
      data: {
        name: data.name,
        host: data.host,
        port: data.port,
        username: data.username,
        authMethod: data.authMethod as ServerAuthMethod | undefined,
        description: data.description,
        documentation: data.documentation,
        tags: data.tags,
      },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
    });

    const mappedUpdatedServer = mapTeamServer(updatedServer);

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.server.updated',
        teamId,
        server: mappedUpdatedServer,
      });
    }

    res.json({
      success: true,
      data: mappedUpdatedServer,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update team server error:', error);
    res.status(500).json({ success: false, error: 'Failed to update team server' });
  }
});

/**
 * DELETE /api/teams/:teamId/servers/:serverId
 * Delete a team server
 */
router.delete('/:teamId/servers/:serverId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const serverId = req.params.serverId as string;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Find server
    const server = await prisma.teamServer.findUnique({
      where: { id: serverId },
    });

    if (!server || server.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Server not found' });
      return;
    }

    // Only creator or team admin/owner can delete
    const isCreator = server.createdById === userId;
    const isTeamAdmin = membership.role === TeamRole.OWNER || membership.role === TeamRole.ADMIN;

    if (!isCreator && !isTeamAdmin) {
      res.status(403).json({ success: false, error: 'Only server creators or team admins can delete servers' });
      return;
    }

    await prisma.teamServer.delete({
      where: { id: serverId },
    });

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.server.deleted',
        teamId,
        serverId,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete team server error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete team server' });
  }
});

/**
 * POST /api/teams/:teamId/servers/:serverId/check
 * Check server connection status
 */
router.post('/:teamId/servers/:serverId/check', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const serverId = req.params.serverId as string;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Find server
    const server = await prisma.teamServer.findUnique({
      where: { id: serverId },
    });

    if (!server || server.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Server not found' });
      return;
    }

    // Check connection
    const checkResult = await checkServerConnection(server.host, server.port);

    // Update server status
    const newStatus = checkResult.connected ? ServerStatus.ONLINE : ServerStatus.OFFLINE;
    await prisma.teamServer.update({
      where: { id: serverId },
      data: {
        lastStatus: newStatus,
        lastCheckedAt: new Date(),
      },
    });

    // Broadcast status change
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.server.status.changed',
        teamId,
        serverId,
        status: newStatus as unknown as SharedServerStatus,
      });
    }

    res.json({
      success: true,
      data: {
        connected: checkResult.connected,
        serverInfo: checkResult.serverInfo,
        error: checkResult.error,
        status: newStatus,
        checkedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('[API] Check team server error:', error);
    res.status(500).json({ success: false, error: 'Failed to check team server' });
  }
});

/**
 * POST /api/teams/:teamId/servers/:serverId/connect
 * Create a new SSH terminal connected to this server
 */
router.post('/:teamId/servers/:serverId/connect', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const serverId = req.params.serverId as string;
    const { password, privateKey } = req.body;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Find server
    const server = await prisma.teamServer.findUnique({
      where: { id: serverId },
    });

    if (!server || server.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Server not found' });
      return;
    }

    // Create SSH terminal
    const terminal = await prisma.terminal.create({
      data: {
        userId,
        name: `${server.name} - SSH`,
        type: 'SSH',
        sshHost: server.host,
        sshPort: server.port,
        sshUsername: server.username,
        sshPassword: password,
        sshPrivateKey: privateKey,
      },
    });

    // Log in team audit
    await prisma.teamAuditLog.create({
      data: {
        teamId,
        userId,
        action: 'server.connected',
        resource: 'server',
        resourceId: serverId,
        details: { serverName: server.name, terminalId: terminal.id },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        terminalId: terminal.id,
        terminalName: terminal.name,
      },
    });
  } catch (error) {
    console.error('[API] Connect to team server error:', error);
    res.status(500).json({ success: false, error: 'Failed to connect to team server' });
  }
});

/**
 * Helper function to check server connection
 */
async function checkServerConnection(host: string, port: number): Promise<{
  connected: boolean;
  serverInfo?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const conn = new Client();
    const timeout = setTimeout(() => {
      conn.end();
      resolve({ connected: false, error: 'Connection timeout' });
    }, 10000);

    conn.on('ready', () => {
      clearTimeout(timeout);
      conn.end();
      resolve({ connected: true, serverInfo: 'SSH connection successful' });
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      // Check if it's just an auth error (which means connection worked)
      if (err.message.includes('authentication') || err.message.includes('Auth')) {
        resolve({ connected: true, serverInfo: 'Server reachable (auth required)' });
      } else {
        resolve({ connected: false, error: err.message });
      }
    });

    // Try to connect without credentials (just to check if server is reachable)
    conn.connect({
      host,
      port,
      username: 'check',
      password: 'check',
      readyTimeout: 10000,
    });
  });
}

export default router;
