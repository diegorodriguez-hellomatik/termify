import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { TaskPriority, TeamRole } from '@termify/shared';
import { getWebSocketServer } from '../websocket/WebSocketServer.js';
import { NotificationService } from '../services/NotificationService.js';
import { createDefaultStatusesForTeam } from './team-task-status.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Helper to get default status key for a team
async function getDefaultStatusKey(teamId: string): Promise<string> {
  await createDefaultStatusesForTeam(teamId);
  const defaultStatus = await prisma.taskStatusConfig.findFirst({
    where: { teamId, isDefault: true },
  });
  return defaultStatus?.key || 'backlog';
}

// Helper to validate status exists for team
async function validateStatusKey(teamId: string, statusKey: string): Promise<boolean> {
  await createDefaultStatusesForTeam(teamId);
  const status = await prisma.taskStatusConfig.findUnique({
    where: { teamId_key: { teamId, key: statusKey } },
  });
  return !!status;
}

// Validation schemas - status is now a string (custom status key)
const createTaskSchema = z.object({
  teamId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: z.string().min(1).max(50).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  dueDate: z.string().datetime().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.string().min(1).max(50).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  position: z.number().int().min(0).optional(),
  dueDate: z.string().datetime().optional().nullable(),
});

const assignTaskSchema = z.object({
  teamMemberId: z.string(),
});

const reorderTasksSchema = z.object({
  taskIds: z.array(z.string()),
  status: z.string().min(1).max(50),
});

/**
 * GET /api/tasks
 * List tasks for a team
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.query.teamId as string;

    if (!teamId) {
      res.status(400).json({ success: false, error: 'teamId is required' });
      return;
    }

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    const tasks = await prisma.task.findMany({
      where: { teamId },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, image: true },
        },
        assignees: {
          include: {
            teamMember: {
              include: {
                user: {
                  select: { id: true, email: true, name: true, image: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
    });

    const formattedTasks = tasks.map((task) => ({
      id: task.id,
      teamId: task.teamId,
      createdById: task.createdById,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      position: task.position,
      dueDate: task.dueDate,
      createdBy: task.createdBy,
      assignees: task.assignees.map((a) => ({
        id: a.id,
        taskId: a.taskId,
        teamMemberId: a.teamMemberId,
        teamMember: {
          id: a.teamMember.id,
          userId: a.teamMember.userId,
          role: a.teamMember.role,
          user: a.teamMember.user,
        },
        createdAt: a.createdAt,
      })),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));

    res.json({
      success: true,
      data: { tasks: formattedTasks },
    });
  } catch (error) {
    console.error('[API] List tasks error:', error);
    res.status(500).json({ success: false, error: 'Failed to list tasks' });
  }
});

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = createTaskSchema.parse(req.body);

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: data.teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Get default status if not provided
    const statusKey = data.status || await getDefaultStatusKey(data.teamId);

    // Validate the status exists
    if (!(await validateStatusKey(data.teamId, statusKey))) {
      res.status(400).json({ success: false, error: `Invalid status: ${statusKey}` });
      return;
    }

    // Get the highest position for this status
    const lastTask = await prisma.task.findFirst({
      where: { teamId: data.teamId, status: statusKey },
      orderBy: { position: 'desc' },
    });
    const position = (lastTask?.position ?? -1) + 1;

    // Create task
    const task = await prisma.task.create({
      data: {
        teamId: data.teamId,
        createdById: userId,
        title: data.title,
        description: data.description,
        status: statusKey,
        priority: data.priority as TaskPriority,
        position,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
    });

    // Add assignees if provided
    if (data.assigneeIds && data.assigneeIds.length > 0) {
      // Verify all assignees are team members
      const validMembers = await prisma.teamMember.findMany({
        where: {
          id: { in: data.assigneeIds },
          teamId: data.teamId,
        },
      });

      if (validMembers.length > 0) {
        await prisma.taskAssignee.createMany({
          data: validMembers.map((m) => ({
            taskId: task.id,
            teamMemberId: m.id,
          })),
        });

        // Notify assignees
        const notificationService = NotificationService.getInstance();
        for (const member of validMembers) {
          if (member.userId !== userId) {
            await notificationService.notifyTaskAssigned(
              member.userId,
              task.title,
              data.teamId,
              task.id
            );
          }
        }
      }
    }

    // Fetch complete task with assignees
    const completeTask = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, image: true },
        },
        assignees: {
          include: {
            teamMember: {
              include: {
                user: {
                  select: { id: true, email: true, name: true, image: true },
                },
              },
            },
          },
        },
      },
    });

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer && completeTask) {
      wsServer.broadcastToTeam(data.teamId, {
        type: 'task.created',
        teamId: data.teamId,
        task: completeTask as any,
      });
    }

    res.status(201).json({
      success: true,
      data: completeTask,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Create task error:', error);
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

/**
 * GET /api/tasks/:id
 * Get task details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const taskId = req.params.id as string;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        team: true,
        createdBy: {
          select: { id: true, email: true, name: true, image: true },
        },
        assignees: {
          include: {
            teamMember: {
              include: {
                user: {
                  select: { id: true, email: true, name: true, image: true },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: task.teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('[API] Get task error:', error);
    res.status(500).json({ success: false, error: 'Failed to get task' });
  }
});

/**
 * PATCH /api/tasks/:id
 * Update a task
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const taskId = req.params.id as string;
    const data = updateTaskSchema.parse(req.body);

    // Get task
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: {
          include: {
            teamMember: true,
          },
        },
      },
    });

    if (!existingTask) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: existingTask.teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Validate the new status if provided
    if (data.status && !(await validateStatusKey(existingTask.teamId, data.status))) {
      res.status(400).json({ success: false, error: `Invalid status: ${data.status}` });
      return;
    }

    const statusChanged = data.status && data.status !== existingTask.status;

    // If status changed, update position
    let position = data.position;
    if (statusChanged && position === undefined) {
      const lastTask = await prisma.task.findFirst({
        where: { teamId: existingTask.teamId, status: data.status },
        orderBy: { position: 'desc' },
      });
      position = (lastTask?.position ?? -1) + 1;
    }

    // Update task
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority as TaskPriority,
        position,
        dueDate: data.dueDate === null ? null : data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, image: true },
        },
        assignees: {
          include: {
            teamMember: {
              include: {
                user: {
                  select: { id: true, email: true, name: true, image: true },
                },
              },
            },
          },
        },
      },
    });

    // Notify assignees of status change
    if (statusChanged && data.status) {
      const notificationService = NotificationService.getInstance();
      for (const assignee of existingTask.assignees) {
        if (assignee.teamMember.userId !== userId) {
          await notificationService.notifyTaskStatusChanged(
            assignee.teamMember.userId,
            task.title,
            data.status,
            existingTask.teamId,
            task.id
          );
        }
      }

      // Broadcast status change
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.broadcastToTeam(existingTask.teamId, {
          type: 'task.status.changed',
          teamId: existingTask.teamId,
          taskId,
          status: data.status,
          changedById: userId,
        });
      }
    }

    // Broadcast task update
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(existingTask.teamId, {
        type: 'task.updated',
        teamId: existingTask.teamId,
        task: task as any,
      });
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
    console.error('[API] Update task error:', error);
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const taskId = req.params.id as string;

    // Get task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: task.teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Only task creator, admins, and owners can delete
    const canDelete =
      task.createdById === userId ||
      membership.role === TeamRole.OWNER ||
      membership.role === TeamRole.ADMIN;

    if (!canDelete) {
      res.status(403).json({ success: false, error: 'Only the task creator or team admins can delete tasks' });
      return;
    }

    await prisma.task.delete({
      where: { id: taskId },
    });

    // Broadcast deletion
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(task.teamId, {
        type: 'task.deleted',
        teamId: task.teamId,
        taskId,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete task error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
});

/**
 * POST /api/tasks/:id/assign
 * Assign a team member to a task
 */
router.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const taskId = req.params.id as string;
    const data = assignTaskSchema.parse(req.body);

    // Get task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: task.teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Verify target member belongs to the team
    const targetMember = await prisma.teamMember.findUnique({
      where: { id: data.teamMemberId },
      include: {
        user: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
    });

    if (!targetMember || targetMember.teamId !== task.teamId) {
      res.status(400).json({ success: false, error: 'Invalid team member' });
      return;
    }

    // Check if already assigned
    const existingAssignment = await prisma.taskAssignee.findUnique({
      where: { taskId_teamMemberId: { taskId, teamMemberId: data.teamMemberId } },
    });

    if (existingAssignment) {
      res.status(400).json({ success: false, error: 'Member is already assigned to this task' });
      return;
    }

    // Create assignment
    const assignee = await prisma.taskAssignee.create({
      data: {
        taskId,
        teamMemberId: data.teamMemberId,
      },
      include: {
        teamMember: {
          include: {
            user: {
              select: { id: true, email: true, name: true, image: true },
            },
          },
        },
      },
    });

    // Notify assignee
    if (targetMember.userId !== userId) {
      const notificationService = NotificationService.getInstance();
      await notificationService.notifyTaskAssigned(
        targetMember.userId,
        task.title,
        task.teamId,
        task.id
      );
    }

    // Broadcast
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(task.teamId, {
        type: 'task.assigned',
        teamId: task.teamId,
        taskId,
        assignee: {
          id: assignee.id,
          taskId: assignee.taskId,
          teamMemberId: assignee.teamMemberId,
          teamMember: assignee.teamMember as any,
          createdAt: assignee.createdAt,
        },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: assignee.id,
        taskId: assignee.taskId,
        teamMemberId: assignee.teamMemberId,
        teamMember: {
          id: assignee.teamMember.id,
          userId: assignee.teamMember.userId,
          role: assignee.teamMember.role,
          user: assignee.teamMember.user,
        },
        createdAt: assignee.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Assign task error:', error);
    res.status(500).json({ success: false, error: 'Failed to assign task' });
  }
});

/**
 * DELETE /api/tasks/:id/assign/:assigneeId
 * Remove assignment from a task
 */
router.delete('/:id/assign/:assigneeId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const taskId = req.params.id as string;
    const assigneeId = req.params.assigneeId as string;

    // Get task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: task.teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Get assignment
    const assignee = await prisma.taskAssignee.findUnique({
      where: { id: assigneeId },
      include: {
        teamMember: true,
      },
    });

    if (!assignee || assignee.taskId !== taskId) {
      res.status(404).json({ success: false, error: 'Assignment not found' });
      return;
    }

    // Delete assignment
    await prisma.taskAssignee.delete({
      where: { id: assigneeId },
    });

    // Notify unassigned user
    if (assignee.teamMember.userId !== userId) {
      const notificationService = NotificationService.getInstance();
      await notificationService.notifyTaskUnassigned(
        assignee.teamMember.userId,
        task.title,
        task.teamId,
        task.id
      );
    }

    // Broadcast
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(task.teamId, {
        type: 'task.unassigned',
        teamId: task.teamId,
        taskId,
        assigneeId,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Unassign task error:', error);
    res.status(500).json({ success: false, error: 'Failed to unassign task' });
  }
});

/**
 * POST /api/tasks/reorder
 * Reorder tasks within a status column
 */
router.post('/reorder', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = reorderTasksSchema.parse(req.body);

    if (data.taskIds.length === 0) {
      res.json({ success: true });
      return;
    }

    // Get first task to determine team
    const firstTask = await prisma.task.findUnique({
      where: { id: data.taskIds[0] },
    });

    if (!firstTask) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: firstTask.teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Verify all tasks belong to the same team
    const tasks = await prisma.task.findMany({
      where: { id: { in: data.taskIds }, teamId: firstTask.teamId },
    });

    if (tasks.length !== data.taskIds.length) {
      res.status(400).json({ success: false, error: 'Invalid task IDs' });
      return;
    }

    // Validate the status exists
    if (!(await validateStatusKey(firstTask.teamId, data.status))) {
      res.status(400).json({ success: false, error: `Invalid status: ${data.status}` });
      return;
    }

    // Update positions and status
    await prisma.$transaction(
      data.taskIds.map((id, index) =>
        prisma.task.update({
          where: { id },
          data: {
            position: index,
            status: data.status,
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
    console.error('[API] Reorder tasks error:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder tasks' });
  }
});

export default router;
