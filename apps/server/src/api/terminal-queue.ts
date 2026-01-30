import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { getWebSocketServer } from '../websocket/WebSocketServer.js';
import { getTerminalQueueService } from '../services/TerminalQueueService.js';

const router = Router();

// Validation schemas
const createQueueSchema = z.object({
  name: z.string().min(1).max(100),
  commands: z.array(z.object({
    command: z.string().min(1),
    position: z.number().int().min(0).optional(),
  })).min(1),
});

const reorderQueueSchema = z.object({
  queueIds: z.array(z.string()),
});

// GET /api/terminals/:terminalId/queue - List queue for a terminal
router.get('/terminals/:terminalId/queue', authMiddleware, async (req: Request, res: Response) => {
  try {
    const terminalId = req.params.terminalId as string;
    const userId = (req as any).userId as string;

    // Verify terminal ownership
    const terminal = await prisma.terminal.findFirst({
      where: {
        id: terminalId,
        userId,
      },
    });

    if (!terminal) {
      return res.status(404).json({
        success: false,
        error: 'Terminal not found',
      });
    }

    const queues = await prisma.terminalTaskQueue.findMany({
      where: { terminalId },
      include: {
        commands: {
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { position: 'asc' },
    });

    return res.json({
      success: true,
      data: { queues },
    });
  } catch (error) {
    console.error('[TerminalQueue] Error listing queues:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list queues',
    });
  }
});

// POST /api/terminals/:terminalId/queue - Add task to queue
router.post('/terminals/:terminalId/queue', authMiddleware, async (req: Request, res: Response) => {
  try {
    const terminalId = req.params.terminalId as string;
    const userId = (req as any).userId as string;

    const validation = createQueueSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors,
      });
    }

    const { name, commands } = validation.data;

    // Verify terminal ownership
    const terminal = await prisma.terminal.findFirst({
      where: {
        id: terminalId,
        userId,
      },
    });

    if (!terminal) {
      return res.status(404).json({
        success: false,
        error: 'Terminal not found',
      });
    }

    // Get next position
    const lastQueue = await prisma.terminalTaskQueue.findFirst({
      where: { terminalId },
      orderBy: { position: 'desc' },
    });
    const nextPosition = (lastQueue?.position ?? -1) + 1;

    // Create queue with commands
    const queue = await prisma.terminalTaskQueue.create({
      data: {
        terminalId,
        userId,
        name,
        position: nextPosition,
        commands: {
          create: commands.map((cmd, index) => ({
            command: cmd.command,
            position: cmd.position ?? index,
          })),
        },
      },
      include: {
        commands: {
          orderBy: { position: 'asc' },
        },
      },
    });

    // Broadcast queue update
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(terminal.teamId || userId, {
        type: 'queue.created',
        terminalId,
        queue,
      } as any);
    }

    return res.status(201).json({
      success: true,
      data: { queue },
    });
  } catch (error) {
    console.error('[TerminalQueue] Error creating queue:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create queue',
    });
  }
});

// GET /api/terminals/:terminalId/queue/:queueId - Get single queue
router.get('/terminals/:terminalId/queue/:queueId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const terminalId = req.params.terminalId as string;
    const queueId = req.params.queueId as string;
    const userId = (req as any).userId as string;

    // Verify terminal ownership
    const terminal = await prisma.terminal.findFirst({
      where: {
        id: terminalId,
        userId,
      },
    });

    if (!terminal) {
      return res.status(404).json({
        success: false,
        error: 'Terminal not found',
      });
    }

    const queue = await prisma.terminalTaskQueue.findUnique({
      where: { id: queueId },
      include: {
        commands: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!queue || queue.terminalId !== terminalId) {
      return res.status(404).json({
        success: false,
        error: 'Queue not found',
      });
    }

    return res.json({
      success: true,
      data: { queue },
    });
  } catch (error) {
    console.error('[TerminalQueue] Error getting queue:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get queue',
    });
  }
});

// DELETE /api/terminals/:terminalId/queue/:queueId - Delete queue
router.delete('/terminals/:terminalId/queue/:queueId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const terminalId = req.params.terminalId as string;
    const queueId = req.params.queueId as string;
    const userId = (req as any).userId as string;

    // Verify terminal ownership
    const terminal = await prisma.terminal.findFirst({
      where: {
        id: terminalId,
        userId,
      },
    });

    if (!terminal) {
      return res.status(404).json({
        success: false,
        error: 'Terminal not found',
      });
    }

    const queue = await prisma.terminalTaskQueue.findUnique({
      where: { id: queueId },
    });

    if (!queue || queue.terminalId !== terminalId) {
      return res.status(404).json({
        success: false,
        error: 'Queue not found',
      });
    }

    // Cannot delete running queue
    if (queue.status === 'RUNNING') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete a running queue. Cancel it first.',
      });
    }

    await prisma.terminalTaskQueue.delete({
      where: { id: queueId },
    });

    // Broadcast queue deletion
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(terminal.teamId || userId, {
        type: 'queue.deleted',
        terminalId,
        queueId,
      } as any);
    }

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error('[TerminalQueue] Error deleting queue:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete queue',
    });
  }
});

// POST /api/terminals/:terminalId/queue/:queueId/start - Start queue execution
router.post('/terminals/:terminalId/queue/:queueId/start', authMiddleware, async (req: Request, res: Response) => {
  try {
    const terminalId = req.params.terminalId as string;
    const queueId = req.params.queueId as string;
    const userId = (req as any).userId as string;

    // Verify terminal ownership
    const terminal = await prisma.terminal.findFirst({
      where: {
        id: terminalId,
        userId,
      },
    });

    if (!terminal) {
      return res.status(404).json({
        success: false,
        error: 'Terminal not found',
      });
    }

    const queue = await prisma.terminalTaskQueue.findUnique({
      where: { id: queueId },
      include: {
        commands: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!queue || queue.terminalId !== terminalId) {
      return res.status(404).json({
        success: false,
        error: 'Queue not found',
      });
    }

    if (queue.status === 'RUNNING') {
      return res.status(400).json({
        success: false,
        error: 'Queue is already running',
      });
    }

    if (queue.status === 'COMPLETED' || queue.status === 'FAILED') {
      return res.status(400).json({
        success: false,
        error: 'Queue has already finished. Create a new queue to run again.',
      });
    }

    // Start queue execution
    const queueService = getTerminalQueueService();
    await queueService.startQueue(terminalId, queueId);

    const updatedQueue = await prisma.terminalTaskQueue.findUnique({
      where: { id: queueId },
      include: {
        commands: {
          orderBy: { position: 'asc' },
        },
      },
    });

    return res.json({
      success: true,
      data: { queue: updatedQueue },
    });
  } catch (error) {
    console.error('[TerminalQueue] Error starting queue:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start queue',
    });
  }
});

// POST /api/terminals/:terminalId/queue/:queueId/cancel - Cancel queue execution
router.post('/terminals/:terminalId/queue/:queueId/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const terminalId = req.params.terminalId as string;
    const queueId = req.params.queueId as string;
    const userId = (req as any).userId as string;

    // Verify terminal ownership
    const terminal = await prisma.terminal.findFirst({
      where: {
        id: terminalId,
        userId,
      },
    });

    if (!terminal) {
      return res.status(404).json({
        success: false,
        error: 'Terminal not found',
      });
    }

    const queue = await prisma.terminalTaskQueue.findUnique({
      where: { id: queueId },
    });

    if (!queue || queue.terminalId !== terminalId) {
      return res.status(404).json({
        success: false,
        error: 'Queue not found',
      });
    }

    if (queue.status !== 'RUNNING') {
      return res.status(400).json({
        success: false,
        error: 'Queue is not running',
      });
    }

    // Cancel queue execution
    const queueService = getTerminalQueueService();
    await queueService.cancelQueue(terminalId, queueId);

    const updatedQueue = await prisma.terminalTaskQueue.findUnique({
      where: { id: queueId },
      include: {
        commands: {
          orderBy: { position: 'asc' },
        },
      },
    });

    return res.json({
      success: true,
      data: { queue: updatedQueue },
    });
  } catch (error) {
    console.error('[TerminalQueue] Error cancelling queue:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to cancel queue',
    });
  }
});

// POST /api/terminals/:terminalId/queue/reorder - Reorder queues
router.post('/terminals/:terminalId/queue/reorder', authMiddleware, async (req: Request, res: Response) => {
  try {
    const terminalId = req.params.terminalId as string;
    const userId = (req as any).userId as string;

    const validation = reorderQueueSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors,
      });
    }

    const { queueIds } = validation.data;

    // Verify terminal ownership
    const terminal = await prisma.terminal.findFirst({
      where: {
        id: terminalId,
        userId,
      },
    });

    if (!terminal) {
      return res.status(404).json({
        success: false,
        error: 'Terminal not found',
      });
    }

    // Update positions
    await prisma.$transaction(
      queueIds.map((id, index) =>
        prisma.terminalTaskQueue.update({
          where: { id },
          data: { position: index },
        })
      )
    );

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error('[TerminalQueue] Error reordering queues:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reorder queues',
    });
  }
});

export default router;
