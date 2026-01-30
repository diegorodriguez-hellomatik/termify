import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';
import { storageService } from '../services/StorageService.js';

const router = Router();

// Configure multer for memory storage (we'll process in memory with Sharp)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP and GIF are allowed.'));
    }
  },
});

// Upload avatar
// POST /api/users/avatar
router.post(
  '/avatar',
  authMiddleware,
  upload.single('avatar'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      // Check if storage is configured
      if (!storageService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: 'Storage service not configured',
        });
      }

      // Upload and compress the avatar
      const imageUrl = await storageService.uploadAvatar(req.file.buffer, userId);

      // Update user's image in database
      const user = await prisma.user.update({
        where: { id: userId },
        data: { image: imageUrl },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
        },
      });

      return res.json({
        success: true,
        data: {
          image: user.image,
          user,
        },
      });
    } catch (error) {
      console.error('[Users] Avatar upload error:', error);

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'File too large. Maximum size is 5MB.',
          });
        }
      }

      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to upload avatar',
      });
    }
  }
);

// Delete avatar
// DELETE /api/users/avatar
router.delete('/avatar', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Delete from storage
    await storageService.deleteAvatar(userId);

    // Update user's image to null
    await prisma.user.update({
      where: { id: userId },
      data: { image: null },
    });

    return res.json({
      success: true,
      data: { message: 'Avatar deleted successfully' },
    });
  } catch (error) {
    console.error('[Users] Avatar delete error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete avatar',
    });
  }
});

// Update profile
// PATCH /api/users/profile
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

router.patch('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const validation = updateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors,
      });
    }

    const { name } = validation.data;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
      },
    });

    return res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('[Users] Profile update error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update profile',
    });
  }
});

// Get current user profile
// GET /api/users/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

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
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('[Users] Get profile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get profile',
    });
  }
});

export default router;
