import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from './jwt.js';
import { prisma } from '../lib/prisma.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

// Type for authenticated requests
export interface AuthenticatedRequest extends Request {
  user: TokenPayload;
}

// Cache the dev user ID to avoid repeated DB lookups
let devUserId: string | null = null;

/**
 * Get or create a development user
 */
async function getOrCreateDevUser(): Promise<string> {
  if (devUserId) return devUserId;

  const devEmail = 'dev@localhost';
  let user = await prisma.user.findUnique({ where: { email: devEmail } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: devEmail,
        name: 'Dev User',
      },
    });
    console.log('[Auth] Created development user:', user.id);
  }

  devUserId = user.id;
  return devUserId;
}

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header
 * In development mode, allows requests without authentication
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isDev = process.env.NODE_ENV === 'development';

  const handleAuth = async () => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // In development mode, allow requests without auth using a dev user
        if (isDev) {
          const userId = await getOrCreateDevUser();
          req.user = { userId, email: 'dev@localhost' };
          next();
          return;
        }
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer '
      const payload = verifyAccessToken(token);

      req.user = payload;
      next();
    } catch (error) {
      console.error('[Auth] Token verification failed:', error);
      // In development mode, allow even with invalid token
      if (isDev) {
        try {
          const userId = await getOrCreateDevUser();
          req.user = { userId, email: 'dev@localhost' };
          next();
          return;
        } catch (dbError) {
          console.error('[Auth] Failed to create dev user:', dbError);
        }
      }
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };

  handleAuth();
}

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't require it
 */
export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      req.user = verifyAccessToken(token);
    }
  } catch (error) {
    // Ignore invalid tokens for optional auth
  }

  next();
}
