import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { TaskPriority } from '@termify/shared';
import { getWebSocketServer } from '../websocket/WebSocketServer.js';
import { getTerminalQueueService } from '../services/TerminalQueueService.js';
import { createDefaultStatusesForUser } from './task-status.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Helper to get default status key for a user
async function getDefaultStatusKey(userId: string): Promise<string> {
  await createDefaultStatusesForUser(userId);
  const defaultStatus = await prisma.taskStatusConfig.findFirst({
    where: { userId, isDefault: true },
  });
  return defaultStatus?.key || 'backlog';
}

// Helper to validate status exists for user
async function validateStatusKey(userId: string, statusKey: string): Promise<boolean> {
  await createDefaultStatusesForUser(userId);
  const status = await prisma.taskStatusConfig.findUnique({
    where: { userId_key: { userId, key: statusKey } },
  });
  return !!status;
}

// Attachment schema
const attachmentSchema = z.object({
  url: z.string().url(),
  name: z.string().max(200),
  type: z.enum(['image', 'file']),
});

// Validation schemas - status is now a string (custom status key)
const createPersonalTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional(),  // Increased for markdown content
  status: z.string().min(1).max(50).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  dueDate: z.string().datetime().optional().nullable(),
  workspaceId: z.string().optional().nullable(),
  commands: z.array(z.string()).optional().nullable(),
  attachments: z.array(attachmentSchema).optional().nullable(),
  assigneeId: z.string().optional().nullable(),
});

const updatePersonalTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).optional().nullable(),  // Increased for markdown content
  status: z.string().min(1).max(50).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  position: z.number().int().min(0).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  workspaceId: z.string().optional().nullable(),
  commands: z.array(z.string()).optional().nullable(),
  attachments: z.array(attachmentSchema).optional().nullable(),
  assigneeId: z.string().optional().nullable(),
});

const reorderTasksSchema = z.object({
  taskIds: z.array(z.string()),
  status: z.string().min(1).max(50),
});

/**
 * GET /api/personal-tasks
 * List all personal tasks for the current user
 * Query params:
 *   - workspaceId: Filter by workspace (use "null" for tasks without a workspace)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const workspaceIdParam = req.query.workspaceId as string | undefined;

    // Build where clause
    const where: { userId: string; workspaceId?: string | null } = { userId };
    if (workspaceIdParam === 'null') {
      where.workspaceId = null;
    } else if (workspaceIdParam) {
      where.workspaceId = workspaceIdParam;
    }

    const tasks = await prisma.personalTask.findMany({
      where,
      orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: { tasks },
    });
  } catch (error) {
    console.error('[API] List personal tasks error:', error);
    res.status(500).json({ success: false, error: 'Failed to list personal tasks' });
  }
});

/**
 * POST /api/personal-tasks
 * Create a new personal task
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = createPersonalTaskSchema.parse(req.body);

    // Get default status if not provided
    const statusKey = data.status || await getDefaultStatusKey(userId);

    // Validate the status exists
    if (!(await validateStatusKey(userId, statusKey))) {
      res.status(400).json({ success: false, error: `Invalid status: ${statusKey}` });
      return;
    }

    // Get the highest position for this status
    const lastTask = await prisma.personalTask.findFirst({
      where: { userId, status: statusKey },
      orderBy: { position: 'desc' },
    });
    const position = (lastTask?.position ?? -1) + 1;

    // Create task
    const task = await prisma.personalTask.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        status: statusKey,
        priority: data.priority as TaskPriority,
        position,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        workspaceId: data.workspaceId,
        commands: data.commands ? JSON.stringify(data.commands) : null,
        attachments: data.attachments ? JSON.stringify(data.attachments) : null,
        assigneeId: data.assigneeId,
      },
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Broadcast task created event
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToUser(userId, {
        type: 'personal-task.created',
        task,
      });
      // Also broadcast to dev-user in development mode
      if (process.env.NODE_ENV === 'development') {
        wsServer.broadcastToUser('dev-user', {
          type: 'personal-task.created',
          task,
        });
      }
    }

    res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Create personal task error:', error);
    res.status(500).json({ success: false, error: 'Failed to create personal task' });
  }
});

/**
 * GET /api/personal-tasks/:id
 * Get personal task details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const taskId = req.params.id as string;

    const task = await prisma.personalTask.findUnique({
      where: { id: taskId },
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
    });

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Verify ownership
    if (task.userId !== userId) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('[API] Get personal task error:', error);
    res.status(500).json({ success: false, error: 'Failed to get personal task' });
  }
});

/**
 * PATCH /api/personal-tasks/:id
 * Update a personal task
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const taskId = req.params.id as string;
    const data = updatePersonalTaskSchema.parse(req.body);

    // Get task
    const existingTask = await prisma.personalTask.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Verify ownership
    if (existingTask.userId !== userId) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Validate the new status if provided
    if (data.status && !(await validateStatusKey(userId, data.status))) {
      res.status(400).json({ success: false, error: `Invalid status: ${data.status}` });
      return;
    }

    const statusChanged = data.status && data.status !== existingTask.status;

    // If status changed, update position
    let position = data.position;
    if (statusChanged && position === undefined) {
      const lastTask = await prisma.personalTask.findFirst({
        where: { userId, status: data.status },
        orderBy: { position: 'desc' },
      });
      position = (lastTask?.position ?? -1) + 1;
    }

    // Update task
    const task = await prisma.personalTask.update({
      where: { id: taskId },
      data: {
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority as TaskPriority,
        position,
        dueDate: data.dueDate === null ? null : data.dueDate ? new Date(data.dueDate) : undefined,
        workspaceId: data.workspaceId === null ? null : data.workspaceId,
        commands: data.commands === null ? null : data.commands ? JSON.stringify(data.commands) : undefined,
        attachments: data.attachments === null ? null : data.attachments ? JSON.stringify(data.attachments) : undefined,
        assigneeId: data.assigneeId === null ? null : data.assigneeId,
      },
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Broadcast task updated event
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToUser(userId, {
        type: 'personal-task.updated',
        task,
        previousStatus: statusChanged ? existingTask.status : undefined,
      });
      // Also broadcast to dev-user in development mode
      if (process.env.NODE_ENV === 'development') {
        wsServer.broadcastToUser('dev-user', {
          type: 'personal-task.updated',
          task,
          previousStatus: statusChanged ? existingTask.status : undefined,
        });
      }
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update personal task error:', error);
    res.status(500).json({ success: false, error: 'Failed to update personal task' });
  }
});

/**
 * DELETE /api/personal-tasks/:id
 * Delete a personal task
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const taskId = req.params.id as string;

    // Get task
    const task = await prisma.personalTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Verify ownership
    if (task.userId !== userId) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    await prisma.personalTask.delete({
      where: { id: taskId },
    });

    // Broadcast task deleted event
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToUser(userId, {
        type: 'personal-task.deleted',
        taskId,
        status: task.status,
      });
      // Also broadcast to dev-user in development mode
      if (process.env.NODE_ENV === 'development') {
        wsServer.broadcastToUser('dev-user', {
          type: 'personal-task.deleted',
          taskId,
          status: task.status,
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete personal task error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete personal task' });
  }
});

/**
 * POST /api/personal-tasks/reorder
 * Reorder personal tasks within a status column
 */
router.post('/reorder', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = reorderTasksSchema.parse(req.body);

    if (data.taskIds.length === 0) {
      res.json({ success: true });
      return;
    }

    // Verify all tasks belong to the user
    const tasks = await prisma.personalTask.findMany({
      where: { id: { in: data.taskIds }, userId },
    });

    if (tasks.length !== data.taskIds.length) {
      res.status(400).json({ success: false, error: 'Invalid task IDs' });
      return;
    }

    // Validate the status exists
    if (!(await validateStatusKey(userId, data.status))) {
      res.status(400).json({ success: false, error: `Invalid status: ${data.status}` });
      return;
    }

    // Update positions and status
    await prisma.$transaction(
      data.taskIds.map((id, index) =>
        prisma.personalTask.update({
          where: { id },
          data: {
            position: index,
            status: data.status,
          },
        })
      )
    );

    // Fetch updated tasks to broadcast
    const updatedTasks = await prisma.personalTask.findMany({
      where: { id: { in: data.taskIds } },
      orderBy: { position: 'asc' },
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Broadcast tasks reordered event
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToUser(userId, {
        type: 'personal-task.reordered',
        tasks: updatedTasks,
        status: data.status,
      });
      // Also broadcast to dev-user in development mode
      if (process.env.NODE_ENV === 'development') {
        wsServer.broadcastToUser('dev-user', {
          type: 'personal-task.reordered',
          tasks: updatedTasks,
          status: data.status,
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Reorder personal tasks error:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder personal tasks' });
  }
});

// Validation schema for execute
const executeTaskSchema = z.object({
  terminalId: z.string(),
});

/**
 * POST /api/personal-tasks/:id/execute
 * Execute a personal task's commands in a terminal
 * Creates a terminal queue and starts execution
 */
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const taskId = req.params.id as string;
    const data = executeTaskSchema.parse(req.body);

    // Get task
    const task = await prisma.personalTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Verify ownership
    if (task.userId !== userId) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Verify task has commands
    if (!task.commands) {
      res.status(400).json({ success: false, error: 'Task has no commands to execute' });
      return;
    }

    // Parse commands
    let commands: string[];
    try {
      commands = JSON.parse(task.commands);
      if (!Array.isArray(commands) || commands.length === 0) {
        res.status(400).json({ success: false, error: 'Task has no valid commands' });
        return;
      }
    } catch {
      res.status(400).json({ success: false, error: 'Invalid commands format' });
      return;
    }

    // Verify terminal ownership
    const terminal = await prisma.terminal.findFirst({
      where: {
        id: data.terminalId,
        userId,
      },
    });

    if (!terminal) {
      res.status(404).json({ success: false, error: 'Terminal not found' });
      return;
    }

    // Get next queue position
    const lastQueue = await prisma.terminalTaskQueue.findFirst({
      where: { terminalId: data.terminalId },
      orderBy: { position: 'desc' },
    });
    const nextPosition = (lastQueue?.position ?? -1) + 1;

    // Create queue with commands
    const queue = await prisma.terminalTaskQueue.create({
      data: {
        terminalId: data.terminalId,
        userId,
        name: `Task: ${task.title}`,
        position: nextPosition,
        commands: {
          create: commands.map((cmd, index) => ({
            command: cmd,
            position: index,
          })),
        },
      },
      include: {
        commands: {
          orderBy: { position: 'asc' },
        },
      },
    });

    // Update task with queue reference and set to IN_PROGRESS
    const updatedTask = await prisma.personalTask.update({
      where: { id: taskId },
      data: {
        terminalQueueId: queue.id,
        executedAt: new Date(),
        status: 'IN_PROGRESS',
      },
    });

    // Broadcast queue creation
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(terminal.teamId || userId, {
        type: 'queue.created',
        terminalId: data.terminalId,
        queue,
      } as any);
    }

    // Start queue execution
    const queueService = getTerminalQueueService();
    await queueService.startQueue(data.terminalId, queue.id);

    res.json({
      success: true,
      data: {
        task: updatedTask,
        queue,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Execute personal task error:', error);
    res.status(500).json({ success: false, error: 'Failed to execute personal task' });
  }
});

export default router;
