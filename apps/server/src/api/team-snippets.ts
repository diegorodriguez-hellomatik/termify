import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { TeamRole } from '@termify/shared';
import { getWebSocketServer } from '../websocket/WebSocketServer.js';
import { mapTeamSnippet } from '../lib/type-mappers.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createSnippetSchema = z.object({
  name: z.string().min(1).max(100),
  command: z.string().min(1),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(50)).max(10).optional().default([]),
});

const updateSnippetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  command: z.string().min(1).optional(),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

const createEnvVarSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[A-Z_][A-Z0-9_]*$/),
  value: z.string().min(1),
  isSecret: z.boolean().optional().default(false),
});

const updateEnvVarSchema = z.object({
  value: z.string().min(1).optional(),
  isSecret: z.boolean().optional(),
});

// ========================
// Team Snippets
// ========================

/**
 * GET /api/teams/:teamId/snippets
 * List all snippets for the team
 */
router.get('/:teamId/snippets', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const { category, search } = req.query;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    const where: any = { teamId };

    if (category) {
      where.category = category as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { command: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const snippets = await prisma.teamSnippet.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
    });

    // Get unique categories
    const categories = await prisma.teamSnippet.findMany({
      where: { teamId },
      select: { category: true },
      distinct: ['category'],
    });

    res.json({
      success: true,
      data: {
        snippets: snippets.map((s) => ({
          id: s.id,
          name: s.name,
          command: s.command,
          description: s.description,
          category: s.category,
          tags: s.tags,
          usageCount: s.usageCount,
          createdBy: s.createdBy,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
        categories: categories.map((c) => c.category).filter(Boolean) as string[],
        total: snippets.length,
      },
    });
  } catch (error) {
    console.error('[API] List team snippets error:', error);
    res.status(500).json({ success: false, error: 'Failed to list team snippets' });
  }
});

/**
 * POST /api/teams/:teamId/snippets
 * Create a new team snippet
 */
router.post('/:teamId/snippets', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const data = createSnippetSchema.parse(req.body);

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    const snippet = await prisma.teamSnippet.create({
      data: {
        teamId,
        createdById: userId,
        name: data.name,
        command: data.command,
        description: data.description,
        category: data.category,
        tags: data.tags,
      },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
    });

    const mappedSnippet = mapTeamSnippet(snippet);

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.snippet.created',
        teamId,
        snippet: mappedSnippet,
      });
    }

    res.status(201).json({
      success: true,
      data: mappedSnippet,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Create team snippet error:', error);
    res.status(500).json({ success: false, error: 'Failed to create team snippet' });
  }
});

/**
 * PATCH /api/teams/:teamId/snippets/:snippetId
 * Update a team snippet
 */
router.patch('/:teamId/snippets/:snippetId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const snippetId = req.params.snippetId as string;
    const data = updateSnippetSchema.parse(req.body);

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Find snippet
    const snippet = await prisma.teamSnippet.findUnique({
      where: { id: snippetId },
    });

    if (!snippet || snippet.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Snippet not found' });
      return;
    }

    // Only creator or team admin/owner can update
    const isCreator = snippet.createdById === userId;
    const isTeamAdmin = membership.role === TeamRole.OWNER || membership.role === TeamRole.ADMIN;

    if (!isCreator && !isTeamAdmin) {
      res.status(403).json({ success: false, error: 'Only snippet creators or team admins can update snippets' });
      return;
    }

    const updatedSnippet = await prisma.teamSnippet.update({
      where: { id: snippetId },
      data: {
        name: data.name,
        command: data.command,
        description: data.description,
        category: data.category,
        tags: data.tags,
      },
      include: {
        createdBy: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
    });

    const mappedUpdatedSnippet = mapTeamSnippet(updatedSnippet);

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.snippet.updated',
        teamId,
        snippet: mappedUpdatedSnippet,
      });
    }

    res.json({
      success: true,
      data: mappedUpdatedSnippet,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update team snippet error:', error);
    res.status(500).json({ success: false, error: 'Failed to update team snippet' });
  }
});

/**
 * DELETE /api/teams/:teamId/snippets/:snippetId
 * Delete a team snippet
 */
router.delete('/:teamId/snippets/:snippetId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const snippetId = req.params.snippetId as string;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Find snippet
    const snippet = await prisma.teamSnippet.findUnique({
      where: { id: snippetId },
    });

    if (!snippet || snippet.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Snippet not found' });
      return;
    }

    // Only creator or team admin/owner can delete
    const isCreator = snippet.createdById === userId;
    const isTeamAdmin = membership.role === TeamRole.OWNER || membership.role === TeamRole.ADMIN;

    if (!isCreator && !isTeamAdmin) {
      res.status(403).json({ success: false, error: 'Only snippet creators or team admins can delete snippets' });
      return;
    }

    await prisma.teamSnippet.delete({
      where: { id: snippetId },
    });

    // Broadcast to team subscribers
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamId, {
        type: 'team.snippet.deleted',
        teamId,
        snippetId,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete team snippet error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete team snippet' });
  }
});

/**
 * POST /api/teams/:teamId/snippets/:snippetId/use
 * Increment snippet usage count
 */
router.post('/:teamId/snippets/:snippetId/use', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const snippetId = req.params.snippetId as string;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Find and update snippet
    const snippet = await prisma.teamSnippet.findUnique({
      where: { id: snippetId },
    });

    if (!snippet || snippet.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Snippet not found' });
      return;
    }

    const updatedSnippet = await prisma.teamSnippet.update({
      where: { id: snippetId },
      data: { usageCount: { increment: 1 } },
    });

    res.json({
      success: true,
      data: {
        id: updatedSnippet.id,
        usageCount: updatedSnippet.usageCount,
      },
    });
  } catch (error) {
    console.error('[API] Use team snippet error:', error);
    res.status(500).json({ success: false, error: 'Failed to use team snippet' });
  }
});

// ========================
// Team Environment Variables
// ========================

/**
 * GET /api/teams/:teamId/env-variables
 * List all environment variables for the team
 */
router.get('/:teamId/env-variables', async (req: Request, res: Response) => {
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

    const envVars = await prisma.teamEnvVariable.findMany({
      where: { teamId },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: {
        envVariables: envVars.map((v) => ({
          id: v.id,
          name: v.name,
          value: v.isSecret ? '********' : v.value,
          isSecret: v.isSecret,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
        })),
        total: envVars.length,
      },
    });
  } catch (error) {
    console.error('[API] List team env variables error:', error);
    res.status(500).json({ success: false, error: 'Failed to list team env variables' });
  }
});

/**
 * POST /api/teams/:teamId/env-variables
 * Create a new environment variable
 */
router.post('/:teamId/env-variables', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const data = createEnvVarSchema.parse(req.body);

    // Verify membership and role
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    if (membership.role === TeamRole.MEMBER) {
      res.status(403).json({ success: false, error: 'Only team owners and admins can create env variables' });
      return;
    }

    // Check for duplicates
    const existing = await prisma.teamEnvVariable.findUnique({
      where: { teamId_name: { teamId, name: data.name } },
    });

    if (existing) {
      res.status(400).json({ success: false, error: 'Environment variable with this name already exists' });
      return;
    }

    const envVar = await prisma.teamEnvVariable.create({
      data: {
        teamId,
        name: data.name,
        value: data.value,
        isSecret: data.isSecret,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: envVar.id,
        name: envVar.name,
        value: envVar.isSecret ? '********' : envVar.value,
        isSecret: envVar.isSecret,
        createdAt: envVar.createdAt,
        updatedAt: envVar.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Create team env variable error:', error);
    res.status(500).json({ success: false, error: 'Failed to create team env variable' });
  }
});

/**
 * PATCH /api/teams/:teamId/env-variables/:envVarId
 * Update an environment variable
 */
router.patch('/:teamId/env-variables/:envVarId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const envVarId = req.params.envVarId as string;
    const data = updateEnvVarSchema.parse(req.body);

    // Verify membership and role
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    if (membership.role === TeamRole.MEMBER) {
      res.status(403).json({ success: false, error: 'Only team owners and admins can update env variables' });
      return;
    }

    // Find env var
    const envVar = await prisma.teamEnvVariable.findUnique({
      where: { id: envVarId },
    });

    if (!envVar || envVar.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Environment variable not found' });
      return;
    }

    const updatedEnvVar = await prisma.teamEnvVariable.update({
      where: { id: envVarId },
      data: {
        value: data.value,
        isSecret: data.isSecret,
      },
    });

    res.json({
      success: true,
      data: {
        id: updatedEnvVar.id,
        name: updatedEnvVar.name,
        value: updatedEnvVar.isSecret ? '********' : updatedEnvVar.value,
        isSecret: updatedEnvVar.isSecret,
        createdAt: updatedEnvVar.createdAt,
        updatedAt: updatedEnvVar.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Update team env variable error:', error);
    res.status(500).json({ success: false, error: 'Failed to update team env variable' });
  }
});

/**
 * DELETE /api/teams/:teamId/env-variables/:envVarId
 * Delete an environment variable
 */
router.delete('/:teamId/env-variables/:envVarId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const envVarId = req.params.envVarId as string;

    // Verify membership and role
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    if (membership.role === TeamRole.MEMBER) {
      res.status(403).json({ success: false, error: 'Only team owners and admins can delete env variables' });
      return;
    }

    // Find env var
    const envVar = await prisma.teamEnvVariable.findUnique({
      where: { id: envVarId },
    });

    if (!envVar || envVar.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Environment variable not found' });
      return;
    }

    await prisma.teamEnvVariable.delete({
      where: { id: envVarId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Delete team env variable error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete team env variable' });
  }
});

/**
 * GET /api/teams/:teamId/env-variables/:envVarId/value
 * Get the actual value of a secret env variable (for authorized users)
 */
router.get('/:teamId/env-variables/:envVarId/value', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const teamId = req.params.teamId as string;
    const envVarId = req.params.envVarId as string;

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    // Find env var
    const envVar = await prisma.teamEnvVariable.findUnique({
      where: { id: envVarId },
    });

    if (!envVar || envVar.teamId !== teamId) {
      res.status(404).json({ success: false, error: 'Environment variable not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: envVar.id,
        name: envVar.name,
        value: envVar.value,
      },
    });
  } catch (error) {
    console.error('[API] Get team env variable value error:', error);
    res.status(500).json({ success: false, error: 'Failed to get env variable value' });
  }
});

export default router;
