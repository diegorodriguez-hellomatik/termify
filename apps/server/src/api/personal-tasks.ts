import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { TaskStatus, TaskPriority } from '@termify/shared';
import { getWebSocketServer } from '../websocket/WebSocketServer.js';
import { getTerminalQueueService } from '../services/TerminalQueueService.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createPersonalTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']).optional().default('BACKLOG'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  dueDate: z.string().datetime().optional().nullable(),
  boardId: z.string().optional().nullable(),
  commands: z.array(z.string()).optional().nullable(),
});

const updatePersonalTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  position: z.number().int().min(0).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  boardId: z.string().optional().nullable(),
  commands: z.array(z.string()).optional().nullable(),
});

const reorderTasksSchema = z.object({
  taskIds: z.array(z.string()),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']),
});

/**
 * GET /api/personal-tasks
 * List all personal tasks for the current user
 * Query params:
 *   - boardId: Filter by board (use "null" for tasks without a board)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const boardIdParam = req.query.boardId as string | undefined;

    // Build where clause
    const where: { userId: string; boardId?: string | null } = { userId };
    if (boardIdParam === 'null') {
      where.boardId = null;
    } else if (boardIdParam) {
      where.boardId = boardIdParam;
    }

    const tasks = await prisma.personalTask.findMany({
      where,
      orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
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

    // Get the highest position for this status
    const lastTask = await prisma.personalTask.findFirst({
      where: { userId, status: data.status as TaskStatus },
      orderBy: { position: 'desc' },
    });
    const position = (lastTask?.position ?? -1) + 1;

    // Create task
    const task = await prisma.personalTask.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        status: data.status as TaskStatus,
        priority: data.priority as TaskPriority,
        position,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        boardId: data.boardId,
        commands: data.commands ? JSON.stringify(data.commands) : null,
      },
    });

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

    const statusChanged = data.status && data.status !== existingTask.status;

    // If status changed, update position
    let position = data.position;
    if (statusChanged && position === undefined) {
      const lastTask = await prisma.personalTask.findFirst({
        where: { userId, status: data.status as TaskStatus },
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
        status: data.status as TaskStatus,
        priority: data.priority as TaskPriority,
        position,
        dueDate: data.dueDate === null ? null : data.dueDate ? new Date(data.dueDate) : undefined,
        boardId: data.boardId === null ? null : data.boardId,
        commands: data.commands === null ? null : data.commands ? JSON.stringify(data.commands) : undefined,
      },
    });

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

    // Update positions and status
    await prisma.$transaction(
      data.taskIds.map((id, index) =>
        prisma.personalTask.update({
          where: { id },
          data: {
            position: index,
            status: data.status as TaskStatus,
          },
        })
      )
    );

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
