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
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendEmailVerifiedEmail,
  sendEmailChangeConfirmation,
  sendEmailChangedNotification,
} from '../services/EmailService.js';

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

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

const verifyEmailSchema = z.object({
  token: z.string(),
});

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const changeEmailSchema = z.object({
  newEmail: z.string().email(),
  password: z.string().min(1), // Require password to confirm identity
});

const confirmEmailChangeSchema = z.object({
  token: z.string(),
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
 * Generate secure token
 */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash token for storage
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create default localhost server for a new user
 */
async function createDefaultLocalhostServer(userId: string): Promise<void> {
  try {
    // Check if user already has a localhost server
    const existingServer = await prisma.server.findFirst({
      where: {
        userId,
        isDefault: true,
      },
    });

    if (existingServer) {
      return; // Already has a default server
    }

    await prisma.server.create({
      data: {
        userId,
        name: 'localhost',
        host: 'localhost',
        port: 22,
        authMethod: 'AGENT',
        isDefault: true,
        description: 'Local machine terminal',
      },
    });
  } catch (error) {
    console.error('[API] Failed to create default localhost server:', error);
    // Don't fail the registration if this fails
  }
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

    // Create default localhost server for the new user
    await createDefaultLocalhostServer(user.id);

    // Generate email verification token
    const verificationToken = generateSecureToken();
    const verificationTokenHash = hashToken(verificationToken);
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.verificationToken.create({
      data: {
        identifier: `verify:${user.email}`,
        token: verificationTokenHash,
        expires: verificationExpires,
      },
    });

    // Send verification email with original token (don't fail registration if email fails)
    try {
      await sendVerificationEmail(user.email, verificationToken, user.name);
    } catch (emailError) {
      console.error('[API] Failed to send verification email:', emailError);
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

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: null, // Not verified yet
        },
        accessToken,
        refreshToken,
        message: 'Account created! Please check your email to verify your account.',
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
          include: { accounts: true },
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
        include: { accounts: true },
      });

      // Create default localhost server for the new user
      await createDefaultLocalhostServer(user.id);
    }

    // At this point user is always defined
    if (!user) {
      res.status(500).json({ success: false, error: 'Failed to create or update user' });
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
        emailVerified: true,
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

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({
        success: true,
        data: {
          message: 'If an account with that email exists, we sent a password reset link.',
        },
      });
      return;
    }

    // Generate reset token
    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing reset tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: `reset:${user.email}`,
      },
    });

    // Create new verification token (store hash, send original)
    await prisma.verificationToken.create({
      data: {
        identifier: `reset:${user.email}`,
        token: tokenHash,
        expires,
      },
    });

    // Send reset email with original token
    try {
      await sendPasswordResetEmail(user.email, token, user.name);
    } catch (emailError) {
      console.error('[API] Failed to send password reset email:', emailError);
      // Don't fail the request if email fails, but log it
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth.password_reset_requested',
        resource: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      data: {
        message: 'If an account with that email exists, we sent a password reset link.',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Failed to process request' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const data = resetPasswordSchema.parse(req.body);

    // Hash the provided token to compare with stored hash
    const tokenHash = hashToken(data.token);

    // Find the verification token by hash
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token: tokenHash },
    });

    if (!verificationToken) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired reset link. Please request a new one.',
      });
      return;
    }

    // Check if token is expired
    if (new Date() > verificationToken.expires) {
      // Delete expired token
      await prisma.verificationToken.delete({
        where: { token: tokenHash },
      });
      res.status(400).json({
        success: false,
        error: 'Reset link has expired. Please request a new one.',
      });
      return;
    }

    // Extract email from identifier (format: reset:email@example.com)
    const email = verificationToken.identifier.replace('reset:', '');

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Invalid reset link.',
      });
      return;
    }

    // Hash new password
    const passwordHash = await hashPassword(data.password);

    // Update user password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Delete the used token
    await prisma.verificationToken.delete({
      where: { token: tokenHash },
    });

    // Also delete any other pending reset tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: `reset:${user.email}`,
      },
    });

    // Send confirmation email
    try {
      await sendPasswordChangedEmail(user.email, user.name);
    } catch (emailError) {
      console.error('[API] Failed to send password changed email:', emailError);
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth.password_reset_completed',
        resource: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      data: {
        message: 'Password has been reset successfully. You can now log in with your new password.',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Reset password error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const data = verifyEmailSchema.parse(req.body);

    // Hash the provided token to compare with stored hash
    const tokenHash = hashToken(data.token);

    // Find the verification token by hash
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token: tokenHash },
    });

    if (!verificationToken) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired verification link.',
      });
      return;
    }

    // Check if token is expired
    if (new Date() > verificationToken.expires) {
      // Delete expired token
      await prisma.verificationToken.delete({
        where: { token: tokenHash },
      });
      res.status(400).json({
        success: false,
        error: 'Verification link has expired. Please request a new one.',
      });
      return;
    }

    // Extract email from identifier (format: verify:email@example.com)
    const email = verificationToken.identifier.replace('verify:', '');

    // Find and update user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Invalid verification link.',
      });
      return;
    }

    // Check if already verified
    if (user.emailVerified) {
      // Delete the token since email is already verified
      await prisma.verificationToken.delete({
        where: { token: tokenHash },
      });
      res.json({
        success: true,
        data: {
          message: 'Your email is already verified.',
          alreadyVerified: true,
        },
      });
      return;
    }

    // Update user email verified status
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });

    // Delete the used token
    await prisma.verificationToken.delete({
      where: { token: tokenHash },
    });

    // Send confirmation email
    try {
      await sendEmailVerifiedEmail(user.email, user.name);
    } catch (emailError) {
      console.error('[API] Failed to send email verified confirmation:', emailError);
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth.email_verified',
        resource: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      data: {
        message: 'Email verified successfully!',
        alreadyVerified: false,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Verify email error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify email' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const data = resendVerificationSchema.parse(req.body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({
        success: true,
        data: {
          message: 'If an account with that email exists and is not verified, we sent a verification link.',
        },
      });
      return;
    }

    // Check if already verified
    if (user.emailVerified) {
      res.json({
        success: true,
        data: {
          message: 'Your email is already verified.',
          alreadyVerified: true,
        },
      });
      return;
    }

    // Generate verification token
    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Delete any existing verification tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: `verify:${user.email}`,
      },
    });

    // Create new verification token (store hash, send original)
    await prisma.verificationToken.create({
      data: {
        identifier: `verify:${user.email}`,
        token: tokenHash,
        expires,
      },
    });

    // Send verification email with original token
    try {
      await sendVerificationEmail(user.email, token, user.name);
    } catch (emailError) {
      console.error('[API] Failed to send verification email:', emailError);
    }

    res.json({
      success: true,
      data: {
        message: 'If an account with that email exists and is not verified, we sent a verification link.',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Resend verification error:', error);
    res.status(500).json({ success: false, error: 'Failed to resend verification' });
  }
});

/**
 * POST /api/auth/change-password
 * Change password (requires authentication)
 */
router.post('/change-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const data = changePasswordSchema.parse(req.body);

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      res.status(400).json({ success: false, error: 'Cannot change password for this account' });
      return;
    }

    // Verify current password
    const valid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    // Hash new password
    const newPasswordHash = await hashPassword(data.newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth.change-password',
        resource: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // Send notification email
    try {
      await sendPasswordChangedEmail(user.email, user.name);
    } catch (emailError) {
      console.error('[API] Failed to send password changed email:', emailError);
    }

    res.json({
      success: true,
      data: {
        message: 'Password changed successfully',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Change password error:', error);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

/**
 * POST /api/auth/change-email
 * Request email change (sends confirmation to new email)
 */
router.post('/change-email', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const data = changeEmailSchema.parse(req.body);

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      res.status(400).json({ success: false, error: 'Cannot change email for this account' });
      return;
    }

    // Verify password
    const valid = await verifyPassword(data.password, user.passwordHash);
    if (!valid) {
      res.status(400).json({ success: false, error: 'Password is incorrect' });
      return;
    }

    // Check if new email is the same as current
    if (data.newEmail.toLowerCase() === user.email.toLowerCase()) {
      res.status(400).json({ success: false, error: 'New email must be different from current email' });
      return;
    }

    // Check if new email is already in use
    const existingUser = await prisma.user.findUnique({
      where: { email: data.newEmail },
    });

    if (existingUser) {
      res.status(400).json({ success: false, error: 'This email is already in use' });
      return;
    }

    // Delete any existing email change tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: { startsWith: `email-change:${userId}:` },
      },
    });

    // Generate token (store hash, send original)
    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token with new email in identifier
    await prisma.verificationToken.create({
      data: {
        identifier: `email-change:${userId}:${data.newEmail}`,
        token: tokenHash,
        expires,
      },
    });

    // Send confirmation email to NEW email
    try {
      await sendEmailChangeConfirmation(data.newEmail, token, user.name);
    } catch (emailError) {
      console.error('[API] Failed to send email change confirmation:', emailError);
      res.status(500).json({ success: false, error: 'Failed to send confirmation email' });
      return;
    }

    res.json({
      success: true,
      data: {
        message: 'Confirmation email sent to your new email address',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Change email error:', error);
    res.status(500).json({ success: false, error: 'Failed to request email change' });
  }
});

/**
 * POST /api/auth/confirm-email-change
 * Confirm email change with token
 */
router.post('/confirm-email-change', async (req: Request, res: Response) => {
  try {
    const data = confirmEmailChangeSchema.parse(req.body);

    // Hash the provided token to compare with stored hash
    const tokenHash = hashToken(data.token);

    // Find the token (identifier starts with 'email-change:')
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: { startsWith: 'email-change:' },
        token: tokenHash,
      },
    });

    if (!verificationToken) {
      res.status(400).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    // Check if token is expired
    if (verificationToken.expires < new Date()) {
      // Delete expired token
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token,
          },
        },
      });
      res.status(400).json({ success: false, error: 'Token has expired' });
      return;
    }

    // Parse identifier to get userId and newEmail
    // Format: email-change:userId:newEmail
    const parts = verificationToken.identifier.split(':');
    if (parts.length < 3) {
      res.status(400).json({ success: false, error: 'Invalid token format' });
      return;
    }

    const userId = parts[1];
    const newEmail = parts.slice(2).join(':'); // In case email contains ':'

    // Check if new email is still available
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail },
    });

    if (existingUser) {
      // Delete the token
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token,
          },
        },
      });
      res.status(400).json({ success: false, error: 'This email is already in use' });
      return;
    }

    // Get user to send notification to old email
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(400).json({ success: false, error: 'User not found' });
      return;
    }

    const oldEmail = user.email;

    // Update user email and mark as verified
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        emailVerified: new Date(),
      },
    });

    // Delete the used token
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: verificationToken.identifier,
          token: verificationToken.token,
        },
      },
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth.change-email',
        resource: 'user',
        resourceId: user.id,
        details: { oldEmail, newEmail },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // Send notification to OLD email
    try {
      await sendEmailChangedNotification(oldEmail, newEmail, user.name);
    } catch (emailError) {
      console.error('[API] Failed to send email changed notification:', emailError);
    }

    res.json({
      success: true,
      data: {
        message: 'Email changed successfully',
        newEmail,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    console.error('[API] Confirm email change error:', error);
    res.status(500).json({ success: false, error: 'Failed to confirm email change' });
  }
});

export default router;
