import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../auth/jwt.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

/**
 * Hash password using scrypt
 */
async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verify password
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(key === derivedKey.toString('hex'));
    });
  });
}

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      res.status(400).json({ success: false, error: 'Email already registered' });
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const tokenId = crypto.randomUUID();
    const refreshToken = generateRefreshToken({
      userId: user.id,
      tokenId,
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user || !user.passwordHash) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const valid = await verifyPassword(data.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const tokenId = crypto.randomUUID();
    const refreshToken = generateRefreshToken({
      userId: user.id,
      tokenId,
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth.login',
        resource: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const data = refreshSchema.parse(req.body);

    const payload = verifyRefreshToken(data.refreshToken);

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid refresh token' });
      return;
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    res.json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (error) {
    console.error('[API] Refresh error:', error);
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
});

/**
 * POST /api/auth/oauth
 * Handle OAuth login - creates or links account
 */
router.post('/oauth', async (req: Request, res: Response) => {
  try {
    const oauthSchema = z.object({
      email: z.string().email(),
      name: z.string().optional(),
      image: z.string().optional(),
      provider: z.string(),
      providerAccountId: z.string(),
    });

    const data = oauthSchema.parse(req.body);

    // Check if user exists with this email
    let user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { accounts: true },
    });

    if (user) {
      // User exists - check if this OAuth account is already linked
      const existingAccount = user.accounts.find(
        (acc) => acc.provider === data.provider && acc.providerAccountId === data.providerAccountId
      );

      if (!existingAccount) {
        // Link this OAuth account to existing user
        await prisma.account.create({
          data: {
            userId: user.id,
            type: 'oauth',
            provider: data.provider,
            providerAccountId: data.providerAccountId,
          },
        });
      }

      // Update user info if provided
      if (data.name || data.image) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: data.name || user.name,
            image: data.image || user.image,
          },
        });
      }
    } else {
      // Create new user with OAuth account
      user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          image: data.image,
          accounts: {
            create: {
              type: 'oauth',
              provider: data.provider,
              providerAccountId: data.providerAccountId,
            },
          },
        },
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const tokenId = crypto.randomUUID();
    const refreshToken = generateRefreshToken({
      userId: user.id,
      tokenId,
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth.oauth',
        resource: 'user',
        resourceId: user.id,
        details: { provider: data.provider },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] OAuth error:', error);
    res.status(500).json({ success: false, error: 'OAuth login failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('[API] Me error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user info' });
  }
});

export default router;
