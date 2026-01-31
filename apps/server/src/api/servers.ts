import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { ServerAuthMethod, ServerStatus, TerminalStatus } from '@prisma/client';
import { SSHManager } from '../ssh/SSHManager.js';
import { getPTYManager } from '../pty/PTYManager.js';
import { DEFAULT_COLS, DEFAULT_ROWS } from '@termify/shared';
import { ephemeralManager } from '../ephemeral/EphemeralTerminalManager.js';
import { serverStatsService } from '../services/ServerStatsService.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).optional().default(22),
  username: z.string().min(1).max(100),
  authMethod: z.enum(['PASSWORD', 'KEY', 'AGENT']).optional().default('PASSWORD'),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  description: z.string().max(500).optional(),
  documentation: z.string().max(10000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional().default([]),
}).refine(data => {
  if (data.authMethod === 'PASSWORD') return !!data.password;
  if (data.authMethod === 'KEY') return !!data.privateKey;
  return true; // AGENT doesn't need credentials
}, {
  message: 'Password or private key is required based on auth method',
});

const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  host: z.string().min(1).max(255).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().min(1).max(100).optional(),
  authMethod: z.enum(['PASSWORD', 'KEY', 'AGENT']).optional(),
  password: z.string().optional().nullable(),
  privateKey: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  documentation: z.string().max(10000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

const connectServerSchema = z.object({
  name: z.string().min(1).max(100).optional().default('SSH Terminal'),
  password: z.string().optional(),
  privateKey: z.string().optional(),
});

const testConnectionSchema = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).optional().default(22),
  username: z.string().min(1).max(100),
  password: z.string().optional(),
  privateKey: z.string().optional(),
}).refine(data => data.password || data.privateKey, {
  message: 'Either password or privateKey must be provided',
});

/**
 * Ensure the user has a default localhost server
 */
async function ensureDefaultLocalhostServer(userId: string): Promise<void> {
  const existingDefault = await prisma.server.findFirst({
    where: { userId, isDefault: true },
  });

  if (!existingDefault) {
    await prisma.server.create({
      data: {
        userId,
        name: 'localhost',
        host: 'localhost',
        port: 22,
        authMethod: 'AGENT',
        isDefault: true,
        description: 'Local machine terminal',
      },
    });
  }
}

/**
 * GET /api/servers
 * List all servers for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Ensure user has default localhost server
    await ensureDefaultLocalhostServer(userId);

    const servers = await prisma.server.findMany({
      where: { userId },
      include: {
        _count: {
          select: { aiProjects: true, connections: true },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    // Get active terminal counts by server
    const activeTerminalCounts = ephemeralManager.getCountsByServer();

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
          isDefault: s.isDefault,
          projectCount: s._count.aiProjects,
          connectionCount: s._count.connections,
          activeTerminals: activeTerminalCounts.get(s.id) || 0,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
        total: servers.length,
      },
    });
  } catch (error) {
    console.error('[API] List servers error:', error);
    res.status(500).json({ success: false, error: 'Failed to list servers' });
  }
});

/**
 * GET /api/servers/:id
 * Get server details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const serverId = req.params.id as string;

    const server = await prisma.server.findFirst({
      where: { id: serverId, userId },
      include: {
        aiProjects: {
          select: {
            id: true,
            name: true,
            status: true,
            workingDirectory: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        connections: {
          select: {
            id: true,
            terminalId: true,
            success: true,
            error: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!server) {
      res.status(404).json({ success: false, error: 'Server not found' });
      return;
    }

    // Get active terminals created from this server
    const terminalIds = server.connections
      .filter((c) => c.success && c.terminalId)
      .map((c) => c.terminalId as string);

    const activeTerminals = terminalIds.length > 0
      ? await prisma.terminal.findMany({
          where: {
            id: { in: terminalIds },
            userId,
          },
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            cwd: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        })
      : [];

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
        isDefault: server.isDefault,
        projects: server.aiProjects,
        connections: server.connections,
        terminals: activeTerminals,
        createdAt: server.createdAt,
        updatedAt: server.updatedAt,
      },
    });
  } catch (error) {
    console.error('[API] Get server error:', error);
    res.status(500).json({ success: false, error: 'Failed to get server' });
  }
});

/**
 * POST /api/servers
 * Create a new server
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = createServerSchema.parse(req.body);

    const server = await prisma.server.create({
      data: {
        userId,
        name: data.name,
        host: data.host,
        port: data.port,
        username: data.username,
        authMethod: data.authMethod as ServerAuthMethod,
        password: data.password,
        privateKey: data.privateKey,
        description: data.description,
        documentation: data.documentation,
        tags: data.tags,
        lastStatus: ServerStatus.UNKNOWN,
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'server.create',
        resource: 'server',
        resourceId: server.id,
        details: { name: data.name, host: data.host },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.status(201).json({
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
        isDefault: server.isDefault,
        createdAt: server.createdAt,
        updatedAt: server.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Create server error:', error);
    res.status(500).json({ success: false, error: 'Failed to create server' });
  }
});

/**
 * PATCH /api/servers/:id
 * Update a server
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const serverId = req.params.id as string;
    const data = updateServerSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.server.findFirst({
      where: { id: serverId, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Server not found' });
      return;
    }

    const server = await prisma.server.update({
      where: { id: serverId },
      data: {
        name: data.name,
        host: data.host,
        port: data.port,
        username: data.username,
        authMethod: data.authMethod as ServerAuthMethod | undefined,
        password: data.password === null ? null : data.password,
        privateKey: data.privateKey === null ? null : data.privateKey,
        description: data.description === null ? null : data.description,
        documentation: data.documentation === null ? null : data.documentation,
        tags: data.tags,
      },
    });

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
        isDefault: server.isDefault,
        createdAt: server.createdAt,
        updatedAt: server.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update server error:', error);
    res.status(500).json({ success: false, error: 'Failed to update server' });
  }
});

/**
 * DELETE /api/servers/:id
 * Delete a server (only if no projects are using it)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const serverId = req.params.id as string;

    // Verify ownership and check for projects
    const server = await prisma.server.findFirst({
      where: { id: serverId, userId },
      include: {
        _count: { select: { aiProjects: true } },
      },
    });

    if (!server) {
      res.status(404).json({ success: false, error: 'Server not found' });
      return;
    }

    // Prevent deletion of default server (localhost)
    if (server.isDefault) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete the default server',
      });
      return;
    }

    if (server._count.aiProjects > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot delete server with ${server._count.aiProjects} active project(s). Delete or reassign projects first.`,
      });
      return;
    }

    await prisma.server.delete({
      where: { id: serverId },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'server.delete',
        resource: 'server',
        resourceId: serverId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete server error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete server' });
  }
});

/**
 * POST /api/servers/:id/test
 * Test SSH connection to a server
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const serverId = req.params.id as string;

    // Get server with credentials
    const server = await prisma.server.findFirst({
      where: { id: serverId, userId },
    });

    if (!server) {
      res.status(404).json({ success: false, error: 'Server not found' });
      return;
    }

    // Test connection using SSHManager
    const sshManager = SSHManager.getInstance();
    const result = await sshManager.testConnection({
      host: server.host,
      port: server.port,
      username: server.username || '',
      password: server.password || undefined,
      privateKey: server.privateKey || undefined,
    });

    // Update server status
    const newStatus = result.success ? ServerStatus.ONLINE : ServerStatus.OFFLINE;
    await prisma.server.update({
      where: { id: serverId },
      data: {
        lastStatus: newStatus,
        lastCheckedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        connected: result.success,
        serverInfo: result.serverInfo,
        error: result.error,
        status: newStatus,
        checkedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('[API] Test server connection error:', error);
    res.status(500).json({ success: false, error: 'Failed to test server connection' });
  }
});

/**
 * POST /api/servers/test
 * Test SSH connection with provided credentials (before creating server)
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const data = testConnectionSchema.parse(req.body);

    const sshManager = SSHManager.getInstance();
    const result = await sshManager.testConnection({
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      privateKey: data.privateKey,
    });

    res.json({
      success: true,
      data: {
        connected: result.success,
        serverInfo: result.serverInfo,
        error: result.error,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Test connection error:', error);
    res.status(500).json({ success: false, error: 'Failed to test connection' });
  }
});

/**
 * GET /api/servers/:id/terminals
 * Get active ephemeral terminals for a server
 */
router.get('/:id/terminals', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const serverId = req.params.id as string;

    // Verify server ownership
    const server = await prisma.server.findFirst({
      where: { id: serverId, userId },
    });

    if (!server) {
      res.status(404).json({ success: false, error: 'Server not found' });
      return;
    }

    // Get active terminals for this server
    const terminals = ephemeralManager.getByServer(serverId);
    const ptyManager = getPTYManager();
    const sshManager = SSHManager.getInstance();

    // Enrich with runtime status
    const enrichedTerminals = terminals.map((t) => {
      const ptyInstance = ptyManager.get(t.id);
      const sshRunning = sshManager.hasSession(t.id);

      return {
        id: t.id,
        name: t.name,
        type: t.type,
        status: ptyInstance?.status || (sshRunning ? 'RUNNING' : t.status),
        createdAt: t.createdAt,
      };
    });

    res.json({
      success: true,
      data: {
        terminals: enrichedTerminals,
        total: enrichedTerminals.length,
      },
    });
  } catch (error) {
    console.error('[API] Get server terminals error:', error);
    res.status(500).json({ success: false, error: 'Failed to get server terminals' });
  }
});

/**
 * DELETE /api/servers/:id/terminals/:terminalId
 * Close an active ephemeral terminal for a server
 */
router.delete('/:id/terminals/:terminalId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const serverId = req.params.id as string;
    const terminalId = req.params.terminalId as string;

    // Verify server ownership
    const server = await prisma.server.findFirst({
      where: { id: serverId, userId },
    });

    if (!server) {
      res.status(404).json({ success: false, error: 'Server not found' });
      return;
    }

    // Verify terminal exists and belongs to this server
    const terminal = ephemeralManager.get(terminalId);
    if (!terminal || terminal.serverId !== serverId) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Kill PTY or SSH
    const ptyManager = getPTYManager();
    const sshManager = SSHManager.getInstance();

    if (ptyManager.has(terminalId)) {
      ptyManager.kill(terminalId);
    } else if (sshManager.hasSession(terminalId)) {
      sshManager.destroySession(terminalId);
    }

    // Delete from memory
    ephemeralManager.delete(terminalId);

    console.log(`[API] Closed ephemeral terminal ${terminalId} for server ${serverId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Close server terminal error:', error);
    res.status(500).json({ success: false, error: 'Failed to close terminal' });
  }
});

/**
 * POST /api/servers/:id/connect
 * Create a new terminal from a saved server
 */
router.post('/:id/connect', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const serverId = req.params.id as string;
    const data = connectServerSchema.parse(req.body);

    // Get server with credentials
    const server = await prisma.server.findFirst({
      where: { id: serverId, userId },
    });

    if (!server) {
      res.status(404).json({ success: false, error: 'Server not found' });
      return;
    }

    // For localhost server, create an ephemeral local terminal (in-memory only, no DB)
    if (server.host === 'localhost' || server.host === '127.0.0.1') {
      const terminal = ephemeralManager.create({
        id: randomUUID(),
        userId,
        serverId: server.id,
        type: 'LOCAL',
        name: data.name || `Local - ${server.name}`,
      });

      // Log connection (without terminalId since it's ephemeral)
      await prisma.serverConnection.create({
        data: {
          serverId: server.id,
          success: true,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          terminal: {
            id: terminal.id,
            name: terminal.name,
            type: terminal.type,
            status: terminal.status,
            createdAt: terminal.createdAt,
            isEphemeral: true,
          },
        },
      });
      return;
    }

    // For remote servers, create SSH terminal
    // Use provided credentials or stored ones
    const password = data.password || server.password || undefined;
    const privateKey = data.privateKey || server.privateKey || undefined;

    // Validate we have credentials
    if (server.authMethod === 'PASSWORD' && !password) {
      res.status(400).json({ success: false, error: 'Password required for this server' });
      return;
    }
    if (server.authMethod === 'KEY' && !privateKey) {
      res.status(400).json({ success: false, error: 'Private key required for this server' });
      return;
    }

    // Test connection first
    const sshManager = SSHManager.getInstance();
    const testResult = await sshManager.testConnection({
      host: server.host,
      port: server.port,
      username: server.username || '',
      password,
      privateKey,
    });

    if (!testResult.success) {
      // Log failed connection
      await prisma.serverConnection.create({
        data: {
          serverId: server.id,
          success: false,
          error: testResult.error || 'Connection failed',
        },
      });

      // Update server status
      await prisma.server.update({
        where: { id: serverId },
        data: {
          lastStatus: ServerStatus.OFFLINE,
          lastCheckedAt: new Date(),
        },
      });

      res.status(400).json({
        success: false,
        error: testResult.error || 'Failed to connect to SSH server',
      });
      return;
    }

    // Create ephemeral SSH terminal (in-memory only, no DB)
    const terminal = ephemeralManager.create({
      id: randomUUID(),
      userId,
      serverId: server.id,
      type: 'SSH',
      name: data.name || `SSH - ${server.name}`,
      sshHost: server.host,
      sshPort: server.port,
      sshUsername: server.username || undefined,
      sshPassword: password,
      sshPrivateKey: privateKey,
    });

    // Log successful connection (without terminalId since it's ephemeral)
    await prisma.serverConnection.create({
      data: {
        serverId: server.id,
        success: true,
      },
    });

    // Update server status
    await prisma.server.update({
      where: { id: serverId },
      data: {
        lastStatus: ServerStatus.ONLINE,
        lastCheckedAt: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      data: {
        terminal: {
          id: terminal.id,
          name: terminal.name,
          type: terminal.type,
          status: terminal.status,
          sshHost: terminal.sshHost,
          sshPort: terminal.sshPort,
          sshUsername: terminal.sshUsername,
          createdAt: terminal.createdAt,
          isEphemeral: true,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Connect to server error:', error);
    res.status(500).json({ success: false, error: 'Failed to connect to server' });
  }
});

/**
 * GET /api/servers/:id/connections
 * Get connection history for a server
 */
router.get('/:id/connections', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const serverId = req.params.id as string;

    // Verify ownership
    const server = await prisma.server.findFirst({
      where: { id: serverId, userId },
    });

    if (!server) {
      res.status(404).json({ success: false, error: 'Server not found' });
      return;
    }

    const connections = await prisma.serverConnection.findMany({
      where: { serverId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: {
        connections: connections.map((c) => ({
          id: c.id,
          terminalId: c.terminalId,
          success: c.success,
          error: c.error,
          createdAt: c.createdAt,
        })),
        total: connections.length,
      },
    });
  } catch (error) {
    console.error('[API] Get server connections error:', error);
    res.status(500).json({ success: false, error: 'Failed to get server connections' });
  }
});

/**
 * POST /api/servers/check-stats-agent
 * Check if stats-agent is installed on the server
 */
router.post('/check-stats-agent', async (req: Request, res: Response) => {
  try {
    const data = testConnectionSchema.parse(req.body);

    const sshManager = SSHManager.getInstance();

    // First test connection
    const testResult = await sshManager.testConnection({
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      privateKey: data.privateKey,
    });

    if (!testResult.success) {
      res.json({
        success: true,
        data: {
          connected: false,
          installed: false,
          error: testResult.error,
        },
      });
      return;
    }

    // Check if stats-agent exists
    const checkResult = await sshManager.executeCommand({
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      privateKey: data.privateKey,
      command: 'test -f ~/.termify/stats-agent && ~/.termify/stats-agent version || echo "NOT_INSTALLED"',
    });

    const installed = !checkResult.output.includes('NOT_INSTALLED');
    const version = installed ? checkResult.output.trim() : undefined;

    res.json({
      success: true,
      data: {
        connected: true,
        installed,
        version,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Check stats-agent error:', error);
    res.status(500).json({ success: false, error: 'Failed to check stats-agent' });
  }
});

/**
 * POST /api/servers/install-stats-agent
 * Install stats-agent on a remote server via SFTP
 */
router.post('/install-stats-agent', async (req: Request, res: Response) => {
  try {
    const data = testConnectionSchema.parse(req.body);

    const sshManager = SSHManager.getInstance();

    // First test connection
    const testResult = await sshManager.testConnection({
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      privateKey: data.privateKey,
    });

    if (!testResult.success) {
      res.json({
        success: false,
        error: testResult.error || 'Connection failed',
      });
      return;
    }

    // Detect OS and architecture of remote server
    const archResult = await sshManager.executeCommand({
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      privateKey: data.privateKey,
      command: 'uname -sm',
    });

    const [remoteOs, remoteArch] = archResult.output.trim().split(' ');

    // Map remote arch to our binary naming
    const archMap: Record<string, string> = {
      'x86_64': 'x86_64',
      'aarch64': 'aarch64',
      'arm64': 'aarch64',
    };

    const osMap: Record<string, string> = {
      'Linux': 'linux',
      'Darwin': 'darwin',
    };

    const normalizedOs = osMap[remoteOs];
    const normalizedArch = archMap[remoteArch];

    if (!normalizedOs || !normalizedArch) {
      res.json({
        success: false,
        error: `Unsupported platform: ${remoteOs} ${remoteArch}`,
      });
      return;
    }

    // Find the correct binary
    // Check multiple possible locations for pre-built binaries
    const possiblePaths = [
      // Pre-built binaries directory
      path.join(process.cwd(), '..', '..', 'tools', 'stats-agent', 'binaries', `stats-agent-${normalizedOs}-${normalizedArch}`),
      // If same architecture as local, use the release build
      path.join(process.cwd(), '..', '..', 'tools', 'stats-agent', 'target', 'release', 'stats-agent'),
      // User's home directory
      path.join(process.env.HOME || '', '.termify', 'stats-agent'),
    ];

    // Detect local platform
    const localOs = process.platform === 'darwin' ? 'darwin' : 'linux';
    const localArch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';

    let binaryPath: string | null = null;

    // If remote platform matches local, we can use any of the paths
    if (normalizedOs === localOs && normalizedArch === localArch) {
      for (const p of possiblePaths) {
        try {
          if (fs.existsSync(p) && fs.statSync(p).isFile()) {
            binaryPath = p;
            break;
          }
        } catch {
          // Continue to next path
        }
      }
    } else {
      // Different platform - only check for pre-built binary
      const prebuiltPath = path.join(process.cwd(), '..', '..', 'tools', 'stats-agent', 'binaries', `stats-agent-${normalizedOs}-${normalizedArch}`);
      if (fs.existsSync(prebuiltPath)) {
        binaryPath = prebuiltPath;
      }
    }

    if (!binaryPath) {
      res.json({
        success: false,
        error: `No binary available for ${remoteOs} ${remoteArch}. Please cross-compile stats-agent for this platform.`,
        data: {
          installed: false,
          targetPlatform: `${normalizedOs}-${normalizedArch}`,
          instructions: [
            `Cross-compile for ${remoteOs} ${remoteArch}:`,
            `  cd tools/stats-agent`,
            `  rustup target add ${normalizedArch === 'aarch64' ? 'aarch64' : 'x86_64'}-unknown-${normalizedOs}-gnu`,
            `  cargo build --release --target ${normalizedArch === 'aarch64' ? 'aarch64' : 'x86_64'}-unknown-${normalizedOs}-gnu`,
            `  mkdir -p binaries`,
            `  cp target/${normalizedArch === 'aarch64' ? 'aarch64' : 'x86_64'}-unknown-${normalizedOs}-gnu/release/stats-agent binaries/stats-agent-${normalizedOs}-${normalizedArch}`,
          ],
        },
      });
      return;
    }

    console.log(`[API] Uploading stats-agent from ${binaryPath} to ${data.host}`);

    // Create directory on remote
    await sshManager.executeCommand({
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      privateKey: data.privateKey,
      command: 'mkdir -p ~/.termify',
    });

    // Get remote home directory
    const homeResult = await sshManager.executeCommand({
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      privateKey: data.privateKey,
      command: 'echo $HOME',
    });
    const remoteHome = homeResult.output.trim();

    // Upload via SFTP
    const uploadResult = await sshManager.uploadFile({
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      privateKey: data.privateKey,
      localPath: binaryPath,
      remotePath: `${remoteHome}/.termify/stats-agent`,
      mode: 0o755,
    });

    if (!uploadResult.success) {
      res.json({
        success: false,
        error: `Failed to upload: ${uploadResult.error}`,
      });
      return;
    }

    // Make sure it's executable
    await sshManager.executeCommand({
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      privateKey: data.privateKey,
      command: 'chmod +x ~/.termify/stats-agent',
    });

    // Verify installation
    const verifyResult = await sshManager.executeCommand({
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      privateKey: data.privateKey,
      command: '~/.termify/stats-agent version',
    });

    if (verifyResult.exitCode !== 0) {
      res.json({
        success: false,
        error: `Installation verification failed: ${verifyResult.output}`,
      });
      return;
    }

    console.log(`[API] stats-agent installed successfully on ${data.host}: ${verifyResult.output.trim()}`);

    res.json({
      success: true,
      data: {
        installed: true,
        version: verifyResult.output.trim(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Install stats-agent error:', error);
    res.status(500).json({ success: false, error: 'Failed to install stats-agent' });
  }
});

/**
 * GET /api/servers/:id/stats/cached
 * Get cached stats for a server (instant response)
 */
router.get('/:id/stats/cached', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    // Verify user owns this server
    const server = await prisma.server.findFirst({
      where: { id, userId },
    });

    if (!server) {
      res.status(404).json({ success: false, error: 'Server not found' });
      return;
    }

    const cachedStats = serverStatsService.getCachedStats(id);

    res.json({
      success: true,
      stats: cachedStats,
      cached: true,
    });
  } catch (error) {
    console.error('[API] Get cached stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get cached stats' });
  }
});

/**
 * GET /api/servers/stats/all
 * Get all cached stats for user's servers (for initial page load)
 */
router.get('/stats/all', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get user's servers
    const servers = await prisma.server.findMany({
      where: { userId },
      select: { id: true },
    });

    const serverIds = servers.map(s => s.id);
    const allCachedStats = serverStatsService.getAllCachedStats();

    // Filter to only user's servers
    const userStats: Record<string, any> = {};
    for (const serverId of serverIds) {
      const stats = allCachedStats.get(serverId);
      if (stats) {
        userStats[serverId] = stats;
      }
    }

    res.json({
      success: true,
      stats: userStats,
    });
  } catch (error) {
    console.error('[API] Get all cached stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get cached stats' });
  }
});

/**
 * POST /api/servers/stats/prewarm
 * Pre-warm stats connections for multiple servers
 */
router.post('/stats/prewarm', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { serverIds } = req.body;

    if (!Array.isArray(serverIds)) {
      res.status(400).json({ success: false, error: 'serverIds must be an array' });
      return;
    }

    // Verify user owns these servers
    const servers = await prisma.server.findMany({
      where: { id: { in: serverIds }, userId },
      select: { id: true },
    });

    const validServerIds = servers.map(s => s.id);

    // Start pre-warming (non-blocking)
    serverStatsService.preWarmServers(validServerIds, userId);

    res.json({
      success: true,
      message: `Pre-warming ${validServerIds.length} servers`,
    });
  } catch (error) {
    console.error('[API] Pre-warm stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to pre-warm stats' });
  }
});

export default router;
