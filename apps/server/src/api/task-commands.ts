import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { getWebSocketServer } from '../websocket/WebSocketServer.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createCommandSchema = z.object({
  command: z.string().min(1),
  description: z.string().max(500).optional(),
  position: z.number().int().min(0).optional(),
});

const updateCommandSchema = z.object({
  command: z.string().min(1).optional(),
  description: z.string().max(500).optional().nullable(),
  position: z.number().int().min(0).optional(),
  isCompleted: z.boolean().optional(),
});

/**
 * GET /api/tasks/:taskId/commands
 * Get all commands for a task
 */
router.get('/:taskId/commands', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const taskId = req.params.taskId as string;

    // Find task and verify access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        team: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!task || task.team.members.length === 0) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const commands = await prisma.taskCommand.findMany({
      where: { taskId },
      orderBy: { position: 'asc' },
    });

    res.json({
      success: true,
      data: {
        commands: commands.map((c) => ({
          id: c.id,
          command: c.command,
          description: c.description,
          position: c.position,
          isCompleted: c.isCompleted,
          completedAt: c.completedAt,
          exitCode: c.exitCode,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
        total: commands.length,
      },
    });
  } catch (error) {
    console.error('[API] Get task commands error:', error);
    res.status(500).json({ success: false, error: 'Failed to get task commands' });
  }
});

/**
 * POST /api/tasks/:taskId/commands
 * Create a new command for a task
 */
router.post('/:taskId/commands', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const taskId = req.params.taskId as string;
    const data = createCommandSchema.parse(req.body);

    // Find task and verify access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        team: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!task || task.team.members.length === 0) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Get max position if not specified
    let position = data.position;
    if (position === undefined) {
      const maxPosition = await prisma.taskCommand.findFirst({
        where: { taskId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = (maxPosition?.position ?? -1) + 1;
    }

    const command = await prisma.taskCommand.create({
      data: {
        taskId,
        command: data.command,
        description: data.description,
        position,
      },
    });

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(task.teamId, {
        type: 'task.command.created',
        teamId: task.teamId,
        taskId,
        command: {
          id: command.id,
          taskId: command.taskId,
          command: command.command,
          description: command.description,
          position: command.position,
          isCompleted: command.isCompleted,
          completedAt: command.completedAt,
          exitCode: command.exitCode,
          createdAt: command.createdAt,
          updatedAt: command.updatedAt,
        },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: command.id,
        command: command.command,
        description: command.description,
        position: command.position,
        isCompleted: command.isCompleted,
        completedAt: command.completedAt,
        exitCode: command.exitCode,
        createdAt: command.createdAt,
        updatedAt: command.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Create task command error:', error);
    res.status(500).json({ success: false, error: 'Failed to create task command' });
  }
});

/**
 * PATCH /api/tasks/:taskId/commands/:commandId
 * Update a task command
 */
router.patch('/:taskId/commands/:commandId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const taskId = req.params.taskId as string;
    const commandId = req.params.commandId as string;
    const data = updateCommandSchema.parse(req.body);

    // Find task and verify access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        team: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!task || task.team.members.length === 0) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Find command
    const command = await prisma.taskCommand.findUnique({
      where: { id: commandId },
    });

    if (!command || command.taskId !== taskId) {
      res.status(404).json({ success: false, error: 'Command not found' });
      return;
    }

    // Prepare update data
    const updateData: any = {
      command: data.command,
      description: data.description,
      position: data.position,
    };

    // Handle completion status change
    if (data.isCompleted !== undefined) {
      updateData.isCompleted = data.isCompleted;
      if (data.isCompleted && !command.isCompleted) {
        updateData.completedAt = new Date();
      } else if (!data.isCompleted) {
        updateData.completedAt = null;
        updateData.exitCode = null;
      }
    }

    const updatedCommand = await prisma.taskCommand.update({
      where: { id: commandId },
      data: updateData,
    });

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(task.teamId, {
        type: 'task.command.updated',
        teamId: task.teamId,
        taskId,
        command: {
          id: updatedCommand.id,
          taskId: updatedCommand.taskId,
          command: updatedCommand.command,
          description: updatedCommand.description,
          position: updatedCommand.position,
          isCompleted: updatedCommand.isCompleted,
          completedAt: updatedCommand.completedAt,
          exitCode: updatedCommand.exitCode,
          createdAt: updatedCommand.createdAt,
          updatedAt: updatedCommand.updatedAt,
        },
      });
    }

    res.json({
      success: true,
      data: {
        id: updatedCommand.id,
        command: updatedCommand.command,
        description: updatedCommand.description,
        position: updatedCommand.position,
        isCompleted: updatedCommand.isCompleted,
        completedAt: updatedCommand.completedAt,
        exitCode: updatedCommand.exitCode,
        createdAt: updatedCommand.createdAt,
        updatedAt: updatedCommand.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update task command error:', error);
    res.status(500).json({ success: false, error: 'Failed to update task command' });
  }
});

/**
 * DELETE /api/tasks/:taskId/commands/:commandId
 * Delete a task command
 */
router.delete('/:taskId/commands/:commandId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const taskId = req.params.taskId as string;
    const commandId = req.params.commandId as string;

    // Find task and verify access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        team: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!task || task.team.members.length === 0) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Find command
    const command = await prisma.taskCommand.findUnique({
      where: { id: commandId },
    });

    if (!command || command.taskId !== taskId) {
      res.status(404).json({ success: false, error: 'Command not found' });
      return;
    }

    await prisma.taskCommand.delete({
      where: { id: commandId },
    });

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(task.teamId, {
        type: 'task.command.deleted',
        teamId: task.teamId,
        taskId,
        commandId,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete task command error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete task command' });
  }
});

/**
 * POST /api/tasks/:taskId/commands/:commandId/execute
 * Mark a command as executed and record exit code
 */
router.post('/:taskId/commands/:commandId/execute', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const taskId = req.params.taskId as string;
    const commandId = req.params.commandId as string;
    const { exitCode } = req.body;

    // Find task and verify access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        team: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!task || task.team.members.length === 0) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Find command
    const command = await prisma.taskCommand.findUnique({
      where: { id: commandId },
    });

    if (!command || command.taskId !== taskId) {
      res.status(404).json({ success: false, error: 'Command not found' });
      return;
    }

    // Update command with execution result
    const updatedCommand = await prisma.taskCommand.update({
      where: { id: commandId },
      data: {
        isCompleted: true,
        completedAt: new Date(),
        exitCode: typeof exitCode === 'number' ? exitCode : null,
      },
    });

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(task.teamId, {
        type: 'task.command.executed',
        teamId: task.teamId,
        taskId,
        commandId,
        exitCode: updatedCommand.exitCode ?? 0,
      });
    }

    res.json({
      success: true,
      data: {
        id: updatedCommand.id,
        command: updatedCommand.command,
        isCompleted: updatedCommand.isCompleted,
        completedAt: updatedCommand.completedAt,
        exitCode: updatedCommand.exitCode,
      },
    });
  } catch (error) {
    console.error('[API] Execute task command error:', error);
    res.status(500).json({ success: false, error: 'Failed to execute task command' });
  }
});

/**
 * POST /api/tasks/:taskId/commands/reorder
 * Reorder commands within a task
 */
router.post('/:taskId/commands/reorder', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const taskId = req.params.taskId as string;
    const { commandIds } = req.body;

    if (!Array.isArray(commandIds)) {
      res.status(400).json({ success: false, error: 'commandIds must be an array' });
      return;
    }

    // Find task and verify access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        team: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!task || task.team.members.length === 0) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Update positions
    await Promise.all(
      commandIds.map((commandId: string, index: number) =>
        prisma.taskCommand.updateMany({
          where: { id: commandId, taskId },
          data: { position: index },
        })
      )
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Reorder task commands error:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder task commands' });
  }
});

export default router;
