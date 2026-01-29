import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.enum(['read', 'write', 'admin'])).default(['read', 'write']),
  expiresIn: z.number().optional(), // Days until expiration
});

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.enum(['read', 'write', 'admin'])).optional(),
});

/**
 * Generate a secure API key
 * Format: ct_live_<32 random chars>
 */
function generateApiKey(): string {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `ct_live_${randomPart}`;
}

/**
 * Hash API key for storage
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * GET /api/apikeys
 * List all API keys for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        usageCount: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { apiKeys },
    });
  } catch (error) {
    console.error('[API] Error listing API keys:', error);
    res.status(500).json({ success: false, error: 'Failed to list API keys' });
  }
});

/**
 * POST /api/apikeys
 * Create a new API key
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = createApiKeySchema.parse(req.body);

    // Generate the API key
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 12); // ct_live_XXX

    // Calculate expiration
    let expiresAt: Date | null = null;
    if (data.expiresIn) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + data.expiresIn);
    }

    // Create the API key record
    const record = await prisma.apiKey.create({
      data: {
        userId,
        name: data.name,
        keyHash,
        keyPrefix,
        permissions: data.permissions,
        expiresAt,
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'create',
        resource: 'api_key',
        resourceId: record.id,
        details: { name: data.name },
        ipAddress: req.ip || undefined,
        userAgent: req.get('user-agent'),
      },
    });

    // Return the full key ONLY on creation (won't be shown again)
    res.status(201).json({
      success: true,
      data: {
        apiKey: {
          id: record.id,
          name: record.name,
          key: apiKey, // Full key - only shown once!
          keyPrefix: record.keyPrefix,
          permissions: record.permissions,
          expiresAt: record.expiresAt,
          createdAt: record.createdAt,
        },
        warning: 'Save this API key now. It will not be shown again.',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error creating API key:', error);
    res.status(500).json({ success: false, error: 'Failed to create API key' });
  }
});

/**
 * PATCH /api/apikeys/:id
 * Update an API key
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const data = updateApiKeySchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.apiKey.findFirst({
      where: {
        id,
        userId,
        revokedAt: null,
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'API key not found' });
      return;
    }

    // Update
    const updated = await prisma.apiKey.update({
      where: { id },
      data: {
        name: data.name,
        permissions: data.permissions,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        usageCount: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      data: { apiKey: updated },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Error updating API key:', error);
    res.status(500).json({ success: false, error: 'Failed to update API key' });
  }
});

/**
 * DELETE /api/apikeys/:id
 * Revoke an API key
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    // Verify ownership
    const existing = await prisma.apiKey.findFirst({
      where: {
        id,
        userId,
        revokedAt: null,
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'API key not found' });
      return;
    }

    // Soft delete (revoke)
    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'revoke',
        resource: 'api_key',
        resourceId: id,
        details: { name: existing.name },
        ipAddress: req.ip || undefined,
        userAgent: req.get('user-agent'),
      },
    });

    res.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('[API] Error revoking API key:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke API key' });
  }
});

export default router;
