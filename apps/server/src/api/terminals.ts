import { Router, Request, Response } from 'express';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { getPTYManager } from '../pty/PTYManager.js';
import { SSHManager } from '../ssh/SSHManager.js';
import { DEFAULT_COLS, DEFAULT_ROWS, TerminalStatus } from '@termify/shared';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation schemas
const createTerminalSchema = z.object({
  name: z.string().min(1).max(100).optional().default('Terminal'),
  cols: z.number().int().min(40).max(500).optional().default(DEFAULT_COLS),
  rows: z.number().int().min(10).max(200).optional().default(DEFAULT_ROWS),
  cwd: z.string().max(1000).optional(),
  categoryId: z.string().optional(),
});

const createSSHTerminalSchema = z.object({
  name: z.string().min(1).max(100).optional().default('SSH Terminal'),
  cols: z.number().int().min(40).max(500).optional().default(DEFAULT_COLS),
  rows: z.number().int().min(10).max(200).optional().default(DEFAULT_ROWS),
  categoryId: z.string().optional(),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).optional().default(22),
  username: z.string().min(1).max(100),
  password: z.string().optional(),
  privateKey: z.string().optional(),
}).refine(data => data.password || data.privateKey, {
  message: 'Either password or privateKey must be provided',
});

const testSSHConnectionSchema = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).optional().default(22),
  username: z.string().min(1).max(100),
  password: z.string().optional(),
  privateKey: z.string().optional(),
}).refine(data => data.password || data.privateKey, {
  message: 'Either password or privateKey must be provided',
});

const updateTerminalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  cols: z.number().int().min(40).max(500).optional(),
  rows: z.number().int().min(10).max(200).optional(),
  categoryId: z.string().optional().nullable(),
  position: z.number().int().min(0).optional(),
});

const reorderSchema = z.object({
  terminalIds: z.array(z.string()),
});

const writeInputSchema = z.object({
  input: z.string(),
});

const executeSchema = z.object({
  command: z.string().min(1),
  timeout: z.number().int().min(1000).max(120000).optional().default(30000),
  waitForPrompt: z.boolean().optional().default(true),
});

const listFilesSchema = z.object({
  path: z.string().optional().default('.'),
});

const readFileSchema = z.object({
  path: z.string().min(1),
  maxSize: z.number().int().min(1).max(1000000).optional().default(100000), // 100KB default
});

const writeFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

/**
 * GET /api/terminals
 * List all terminals for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const terminals = await prisma.terminal.findMany({
      where: { userId },
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });

    // Enrich with runtime status from PTY manager
    const ptyManager = getPTYManager();
    const enrichedTerminals = terminals.map((terminal) => {
      const instance = ptyManager.get(terminal.id);
      return {
        ...terminal,
        status: instance?.status || terminal.status,
        outputBuffer: undefined, // Don't send buffer in list
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
    console.error('[API] Error listing terminals:', error);
    res.status(500).json({ success: false, error: 'Failed to list terminals' });
  }
});

/**
 * GET /api/terminals/:id
 * Get a specific terminal
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const terminal = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Enrich with runtime status
    const ptyManager = getPTYManager();
    const instance = ptyManager.get(terminal.id);

    res.json({
      success: true,
      data: {
        ...terminal,
        status: instance?.status || terminal.status,
        outputBuffer: undefined,
      },
    });
  } catch (error) {
    console.error('[API] Error getting terminal:', error);
    res.status(500).json({ success: false, error: 'Failed to get terminal' });
  }
});

/**
 * POST /api/terminals
 * Create a new terminal
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = createTerminalSchema.parse(req.body);

    // Get the highest position
    const lastTerminal = await prisma.terminal.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
    });
    const position = (lastTerminal?.position ?? -1) + 1;

    // Verify category ownership if provided
    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId },
      });
      if (!category) {
        res.status(400).json({ success: false, error: 'Invalid category' });
        return;
      }
    }

    const terminal = await prisma.terminal.create({
      data: {
        userId,
        name: data.name,
        cols: data.cols,
        rows: data.rows,
        cwd: data.cwd,
        categoryId: data.categoryId,
        position,
        status: TerminalStatus.STOPPED,
      },
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'terminal.create',
        resource: 'terminal',
        resourceId: terminal.id,
        details: { name: data.name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.status(201).json({
      success: true,
      data: terminal,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error creating terminal:', error);
    res.status(500).json({ success: false, error: 'Failed to create terminal' });
  }
});

/**
 * POST /api/terminals/ssh/test
 * Test SSH connection without creating a terminal
 */
router.post('/ssh/test', async (req: Request, res: Response) => {
  try {
    const data = testSSHConnectionSchema.parse(req.body);

    const sshManager = SSHManager.getInstance();
    const result = await sshManager.testConnection({
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      privateKey: data.privateKey,
    });

    res.json({
      success: result.success,
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
    console.error('[API] Error testing SSH connection:', error);
    res.status(500).json({ success: false, error: 'Failed to test SSH connection' });
  }
});

/**
 * POST /api/terminals/ssh
 * Create a new SSH terminal
 */
router.post('/ssh', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = createSSHTerminalSchema.parse(req.body);

    // Test connection first
    const sshManager = SSHManager.getInstance();
    const testResult = await sshManager.testConnection({
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      privateKey: data.privateKey,
    });

    if (!testResult.success) {
      res.status(400).json({
        success: false,
        error: testResult.error || 'Failed to connect to SSH server',
      });
      return;
    }

    // Get the highest position
    const lastTerminal = await prisma.terminal.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
    });
    const position = (lastTerminal?.position ?? -1) + 1;

    // Verify category ownership if provided
    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId },
      });
      if (!category) {
        res.status(400).json({ success: false, error: 'Invalid category' });
        return;
      }
    }

    // Create the SSH terminal
    const terminal = await prisma.terminal.create({
      data: {
        userId,
        name: data.name,
        type: 'SSH',
        cols: data.cols,
        rows: data.rows,
        categoryId: data.categoryId,
        position,
        status: TerminalStatus.STOPPED,
        sshHost: data.host,
        sshPort: data.port,
        sshUsername: data.username,
        sshPassword: data.password,
        sshPrivateKey: data.privateKey,
      },
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'terminal.create',
        resource: 'terminal',
        resourceId: terminal.id,
        details: { name: data.name, type: 'SSH', host: data.host },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // Don't return sensitive data
    const { sshPassword, sshPrivateKey, ...safeTerminal } = terminal;

    res.status(201).json({
      success: true,
      data: safeTerminal,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error creating SSH terminal:', error);
    res.status(500).json({ success: false, error: 'Failed to create SSH terminal' });
  }
});

/**
 * PATCH /api/terminals/:id
 * Update a terminal
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const data = updateTerminalSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    const terminal = await prisma.terminal.update({
      where: { id },
      data,
    });

    // If cols/rows changed and terminal is running, resize PTY
    if (data.cols || data.rows) {
      const ptyManager = getPTYManager();
      if (ptyManager.has(id)) {
        ptyManager.resize(id, terminal.cols, terminal.rows);
      }
    }

    res.json({
      success: true,
      data: terminal,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error updating terminal:', error);
    res.status(500).json({ success: false, error: 'Failed to update terminal' });
  }
});

/**
 * DELETE /api/terminals/:id
 * Delete a terminal
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    // Verify ownership
    const existing = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Kill PTY if running
    const ptyManager = getPTYManager();
    ptyManager.kill(id);

    await prisma.terminal.delete({
      where: { id },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'terminal.delete',
        resource: 'terminal',
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting terminal:', error);
    res.status(500).json({ success: false, error: 'Failed to delete terminal' });
  }
});

/**
 * PATCH /api/terminals/:id/favorite
 * Toggle favorite status
 */
router.patch('/:id/favorite', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { isFavorite } = req.body;

    if (typeof isFavorite !== 'boolean') {
      res.status(400).json({ success: false, error: 'isFavorite must be a boolean' });
      return;
    }

    // Verify ownership
    const existing = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    const terminal = await prisma.terminal.update({
      where: { id },
      data: { isFavorite },
    });

    res.json({
      success: true,
      data: terminal,
    });
  } catch (error) {
    console.error('[API] Error toggling favorite:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle favorite' });
  }
});

/**
 * POST /api/terminals/reorder
 * Reorder terminals
 */
router.post('/reorder', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = reorderSchema.parse(req.body);

    // Verify all terminals belong to the user
    const terminals = await prisma.terminal.findMany({
      where: { userId, id: { in: data.terminalIds } },
    });

    if (terminals.length !== data.terminalIds.length) {
      res.status(400).json({ success: false, error: 'Invalid terminal IDs' });
      return;
    }

    // Update positions
    await prisma.$transaction(
      data.terminalIds.map((id, index) =>
        prisma.terminal.update({
          where: { id },
          data: { position: index },
        })
      )
    );

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error reordering terminals:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder terminals' });
  }
});

/**
 * POST /api/terminals/:id/start
 * Start a terminal (spawn PTY process)
 */
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    const ptyManager = getPTYManager();

    // Check if already running
    if (ptyManager.has(id)) {
      res.json({
        success: true,
        data: { status: TerminalStatus.RUNNING, message: 'Terminal already running' },
      });
      return;
    }

    // Start the PTY
    await ptyManager.create(id, userId, {
      cols: terminal.cols,
      rows: terminal.rows,
      cwd: terminal.cwd || undefined,
    });

    // Update status in DB
    await prisma.terminal.update({
      where: { id },
      data: {
        status: TerminalStatus.RUNNING,
        lastActiveAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: { status: TerminalStatus.RUNNING, message: 'Terminal started' },
    });
  } catch (error) {
    console.error('[API] Error starting terminal:', error);
    res.status(500).json({ success: false, error: 'Failed to start terminal' });
  }
});

/**
 * POST /api/terminals/:id/stop
 * Stop a terminal (kill PTY process)
 */
router.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    const ptyManager = getPTYManager();

    // Get buffered output before killing
    const bufferedOutput = ptyManager.getBufferedOutput(id);

    // Kill the PTY
    ptyManager.kill(id);

    // Update status in DB and save output buffer
    await prisma.terminal.update({
      where: { id },
      data: {
        status: TerminalStatus.STOPPED,
        outputBuffer: bufferedOutput ? Buffer.from(bufferedOutput) : null,
      },
    });

    res.json({
      success: true,
      data: { status: TerminalStatus.STOPPED, message: 'Terminal stopped' },
    });
  } catch (error) {
    console.error('[API] Error stopping terminal:', error);
    res.status(500).json({ success: false, error: 'Failed to stop terminal' });
  }
});

/**
 * POST /api/terminals/:id/write
 * Write input to a terminal (fire and forget)
 */
router.post('/:id/write', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const data = writeInputSchema.parse(req.body);

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    const ptyManager = getPTYManager();

    // Check if running
    if (!ptyManager.has(id)) {
      res.status(400).json({
        success: false,
        error: 'Terminal not running. Start it first with POST /terminals/:id/start',
      });
      return;
    }

    // Write input
    ptyManager.writeInput(id, data.input);

    // Update last active
    await prisma.terminal.update({
      where: { id },
      data: { lastActiveAt: new Date() },
    });

    res.json({
      success: true,
      data: { message: 'Input sent to terminal' },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error writing to terminal:', error);
    res.status(500).json({ success: false, error: 'Failed to write to terminal' });
  }
});

/**
 * POST /api/terminals/:id/execute
 * Execute a command and return the output
 */
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const data = executeSchema.parse(req.body);

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    const ptyManager = getPTYManager();

    // Start terminal if not running
    if (!ptyManager.has(id)) {
      await ptyManager.create(id, userId, {
        cols: terminal.cols,
        rows: terminal.rows,
        cwd: terminal.cwd || undefined,
      });

      // Wait a moment for shell to initialize
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Update status in DB
      await prisma.terminal.update({
        where: { id },
        data: {
          status: TerminalStatus.RUNNING,
          lastActiveAt: new Date(),
        },
      });
    }

    // Execute command and capture output
    const result = await ptyManager.execute(id, data.command, {
      timeout: data.timeout,
      waitForPrompt: data.waitForPrompt,
    });

    // Update last active
    await prisma.terminal.update({
      where: { id },
      data: { lastActiveAt: new Date() },
    });

    res.json({
      success: true,
      data: {
        command: data.command,
        output: result.output,
        timedOut: result.timedOut,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error executing command:', error);
    res.status(500).json({ success: false, error: 'Failed to execute command' });
  }
});

/**
 * GET /api/terminals/:id/output
 * Get the current output buffer of a terminal
 */
router.get('/:id/output', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    const ptyManager = getPTYManager();

    // Get output from running PTY or from saved buffer
    let output = '';
    if (ptyManager.has(id)) {
      output = ptyManager.getBufferedOutput(id) || '';
    } else if (terminal.outputBuffer) {
      output = Buffer.from(terminal.outputBuffer).toString('utf-8');
    }

    res.json({
      success: true,
      data: {
        output,
        isRunning: ptyManager.has(id),
      },
    });
  } catch (error) {
    console.error('[API] Error getting terminal output:', error);
    res.status(500).json({ success: false, error: 'Failed to get terminal output' });
  }
});

/**
 * GET /api/terminals/:id/files
 * List files in a directory relative to terminal's cwd
 */
router.get('/:id/files', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { path: queryPath } = listFilesSchema.parse(req.query);

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Get the base path (terminal's cwd or home directory)
    const basePath = terminal.cwd || os.homedir();
    const targetPath = path.resolve(basePath, queryPath);

    // Security: ensure the path is within the base or a reasonable parent
    // Allow going up to home directory at minimum
    const homeDir = os.homedir();
    if (!targetPath.startsWith(homeDir) && !targetPath.startsWith('/tmp')) {
      res.status(403).json({ success: false, error: 'Access denied: path outside allowed directories' });
      return;
    }

    try {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });

      const files = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(targetPath, entry.name);
          let stats = null;
          try {
            stats = await fs.stat(fullPath);
          } catch {
            // Ignore stat errors (broken symlinks, etc)
          }

          return {
            name: entry.name,
            path: fullPath,
            relativePath: path.relative(homeDir, fullPath),
            isDirectory: entry.isDirectory(),
            isSymlink: entry.isSymbolicLink(),
            size: stats?.size || 0,
            modifiedAt: stats?.mtime?.toISOString() || null,
            extension: entry.isDirectory() ? null : path.extname(entry.name).slice(1).toLowerCase(),
          };
        })
      );

      // Sort: directories first, then by name
      files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      res.json({
        success: true,
        data: {
          path: targetPath,
          relativePath: path.relative(homeDir, targetPath),
          parentPath: path.dirname(targetPath),
          canGoUp: targetPath !== homeDir && targetPath !== '/',
          files,
        },
      });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        res.status(404).json({ success: false, error: 'Directory not found' });
        return;
      }
      if (err.code === 'ENOTDIR') {
        res.status(400).json({ success: false, error: 'Path is not a directory' });
        return;
      }
      throw err;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error listing files:', error);
    res.status(500).json({ success: false, error: 'Failed to list files' });
  }
});

/**
 * GET /api/terminals/:id/file
 * Read file content
 */
router.get('/:id/file', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { path: filePath, maxSize } = readFileSchema.parse(req.query);

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Resolve the path
    const basePath = terminal.cwd || os.homedir();
    const targetPath = path.isAbsolute(filePath) ? filePath : path.resolve(basePath, filePath);

    // Security check
    const homeDir = os.homedir();
    if (!targetPath.startsWith(homeDir) && !targetPath.startsWith('/tmp')) {
      res.status(403).json({ success: false, error: 'Access denied: path outside allowed directories' });
      return;
    }

    try {
      const stats = await fs.stat(targetPath);

      if (stats.isDirectory()) {
        res.status(400).json({ success: false, error: 'Cannot read directory as file' });
        return;
      }

      if (stats.size > maxSize) {
        res.json({
          success: true,
          data: {
            path: targetPath,
            name: path.basename(targetPath),
            extension: path.extname(targetPath).slice(1).toLowerCase(),
            size: stats.size,
            isTruncated: true,
            content: null,
            message: `File too large (${stats.size} bytes). Max size: ${maxSize} bytes.`,
          },
        });
        return;
      }

      // Check if it's a binary file by extension
      const binaryExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'pdf', 'zip', 'tar', 'gz', 'exe', 'dll', 'so', 'dylib', 'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp3', 'mp4', 'avi', 'mov', 'wav'];
      const ext = path.extname(targetPath).slice(1).toLowerCase();

      if (binaryExtensions.includes(ext)) {
        res.json({
          success: true,
          data: {
            path: targetPath,
            name: path.basename(targetPath),
            extension: ext,
            size: stats.size,
            isBinary: true,
            content: null,
            message: 'Binary file cannot be displayed',
          },
        });
        return;
      }

      const content = await fs.readFile(targetPath, 'utf-8');

      res.json({
        success: true,
        data: {
          path: targetPath,
          name: path.basename(targetPath),
          extension: ext,
          size: stats.size,
          isBinary: false,
          isTruncated: false,
          content,
          modifiedAt: stats.mtime.toISOString(),
        },
      });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        res.status(404).json({ success: false, error: 'File not found' });
        return;
      }
      throw err;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error reading file:', error);
    res.status(500).json({ success: false, error: 'Failed to read file' });
  }
});

/**
 * GET /api/terminals/:id/file/binary
 * Serve binary file content (images, videos, audio)
 */
router.get('/:id/file/binary', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const filePath = req.query.path as string;

    if (!filePath) {
      res.status(400).json({ success: false, error: 'Path is required' });
      return;
    }

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Resolve the path
    const basePath = terminal.cwd || os.homedir();
    const targetPath = path.isAbsolute(filePath) ? filePath : path.resolve(basePath, filePath);

    // Security check
    const homeDir = os.homedir();
    if (!targetPath.startsWith(homeDir) && !targetPath.startsWith('/tmp')) {
      res.status(403).json({ success: false, error: 'Access denied: path outside allowed directories' });
      return;
    }

    try {
      const stats = await fs.stat(targetPath);

      if (stats.isDirectory()) {
        res.status(400).json({ success: false, error: 'Cannot read directory as file' });
        return;
      }

      // Determine MIME type
      const ext = path.extname(targetPath).slice(1).toLowerCase();
      const mimeTypes: Record<string, string> = {
        // Images
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        webp: 'image/webp',
        ico: 'image/x-icon',
        bmp: 'image/bmp',
        // Videos
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        avi: 'video/x-msvideo',
        webm: 'video/webm',
        mkv: 'video/x-matroska',
        // Audio
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        flac: 'audio/flac',
        m4a: 'audio/mp4',
        // Documents
        pdf: 'application/pdf',
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';

      // Stream the file
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(targetPath)}"`);

      const fileContent = await fs.readFile(targetPath);
      res.send(fileContent);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        res.status(404).json({ success: false, error: 'File not found' });
        return;
      }
      throw err;
    }
  } catch (error) {
    console.error('[API] Error serving binary file:', error);
    res.status(500).json({ success: false, error: 'Failed to serve file' });
  }
});

/**
 * PUT /api/terminals/:id/file
 * Write/save file content
 */
router.put('/:id/file', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { path: filePath, content } = writeFileSchema.parse(req.body);

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Resolve the path
    const basePath = terminal.cwd || os.homedir();
    const targetPath = path.isAbsolute(filePath) ? filePath : path.resolve(basePath, filePath);

    // Security check
    const homeDir = os.homedir();
    if (!targetPath.startsWith(homeDir) && !targetPath.startsWith('/tmp')) {
      res.status(403).json({ success: false, error: 'Access denied: path outside allowed directories' });
      return;
    }

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });

      // Write the file
      await fs.writeFile(targetPath, content, 'utf-8');

      const stats = await fs.stat(targetPath);

      res.json({
        success: true,
        data: {
          path: targetPath,
          name: path.basename(targetPath),
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        },
      });
    } catch (err: any) {
      if (err.code === 'EACCES') {
        res.status(403).json({ success: false, error: 'Permission denied' });
        return;
      }
      throw err;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error writing file:', error);
    res.status(500).json({ success: false, error: 'Failed to write file' });
  }
});

/**
 * GET /api/terminals/:id/files/download
 * Download a file
 */
router.get('/:id/files/download', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const filePath = req.query.path as string;

    if (!filePath) {
      res.status(400).json({ success: false, error: 'Path is required' });
      return;
    }

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Resolve the path
    const basePath = terminal.cwd || os.homedir();
    const targetPath = path.isAbsolute(filePath) ? filePath : path.resolve(basePath, filePath);

    // Security check
    const homeDir = os.homedir();
    if (!targetPath.startsWith(homeDir) && !targetPath.startsWith('/tmp')) {
      res.status(403).json({ success: false, error: 'Access denied: path outside allowed directories' });
      return;
    }

    try {
      const stats = await fs.stat(targetPath);

      if (stats.isDirectory()) {
        res.status(400).json({ success: false, error: 'Cannot download a directory' });
        return;
      }

      const fileName = path.basename(targetPath);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', stats.size);

      const fileContent = await fs.readFile(targetPath);
      res.send(fileContent);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        res.status(404).json({ success: false, error: 'File not found' });
        return;
      }
      throw err;
    }
  } catch (error) {
    console.error('[API] Error downloading file:', error);
    res.status(500).json({ success: false, error: 'Failed to download file' });
  }
});

/**
 * DELETE /api/terminals/:id/files
 * Delete a file or directory
 */
router.delete('/:id/files', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const filePath = req.query.path as string;

    if (!filePath) {
      res.status(400).json({ success: false, error: 'Path is required' });
      return;
    }

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Resolve the path
    const basePath = terminal.cwd || os.homedir();
    const targetPath = path.isAbsolute(filePath) ? filePath : path.resolve(basePath, filePath);

    // Security check
    const homeDir = os.homedir();
    if (!targetPath.startsWith(homeDir) && !targetPath.startsWith('/tmp')) {
      res.status(403).json({ success: false, error: 'Access denied: path outside allowed directories' });
      return;
    }

    // Prevent deleting home directory or root
    if (targetPath === homeDir || targetPath === '/') {
      res.status(403).json({ success: false, error: 'Cannot delete home or root directory' });
      return;
    }

    try {
      const stats = await fs.stat(targetPath);

      if (stats.isDirectory()) {
        await fs.rm(targetPath, { recursive: true });
      } else {
        await fs.unlink(targetPath);
      }

      res.json({
        success: true,
        data: {
          path: targetPath,
          deleted: true,
        },
      });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        res.status(404).json({ success: false, error: 'File not found' });
        return;
      }
      if (err.code === 'EACCES') {
        res.status(403).json({ success: false, error: 'Permission denied' });
        return;
      }
      throw err;
    }
  } catch (error) {
    console.error('[API] Error deleting file:', error);
    res.status(500).json({ success: false, error: 'Failed to delete file' });
  }
});

const renameFileSchema = z.object({
  oldPath: z.string().min(1),
  newName: z.string().min(1).max(255),
});

/**
 * POST /api/terminals/:id/files/rename
 * Rename a file or directory
 */
router.post('/:id/files/rename', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { oldPath, newName } = renameFileSchema.parse(req.body);

    // Verify ownership
    const terminal = await prisma.terminal.findFirst({
      where: { id, userId },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Resolve the old path
    const basePath = terminal.cwd || os.homedir();
    const sourcePathResolved = path.isAbsolute(oldPath) ? oldPath : path.resolve(basePath, oldPath);

    // Security check
    const homeDir = os.homedir();
    if (!sourcePathResolved.startsWith(homeDir) && !sourcePathResolved.startsWith('/tmp')) {
      res.status(403).json({ success: false, error: 'Access denied: path outside allowed directories' });
      return;
    }

    // Validate new name (no path separators)
    if (newName.includes('/') || newName.includes('\\')) {
      res.status(400).json({ success: false, error: 'New name cannot contain path separators' });
      return;
    }

    // Build new path
    const newPath = path.join(path.dirname(sourcePathResolved), newName);

    // Security check for new path
    if (!newPath.startsWith(homeDir) && !newPath.startsWith('/tmp')) {
      res.status(403).json({ success: false, error: 'Access denied: target path outside allowed directories' });
      return;
    }

    try {
      // Check if source exists
      await fs.stat(sourcePathResolved);

      // Check if target already exists
      try {
        await fs.stat(newPath);
        res.status(400).json({ success: false, error: 'A file or directory with that name already exists' });
        return;
      } catch {
        // Target doesn't exist, good
      }

      // Rename
      await fs.rename(sourcePathResolved, newPath);

      res.json({
        success: true,
        data: {
          oldPath: sourcePathResolved,
          newPath,
          newName,
        },
      });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        res.status(404).json({ success: false, error: 'File not found' });
        return;
      }
      if (err.code === 'EACCES') {
        res.status(403).json({ success: false, error: 'Permission denied' });
        return;
      }
      throw err;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error renaming file:', error);
    res.status(500).json({ success: false, error: 'Failed to rename file' });
  }
});

export default router;
