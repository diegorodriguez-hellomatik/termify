import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../auth/middleware.js';

const router = Router();

// Get all servers for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const servers = await prisma.server.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(servers);
  } catch (error) {
    console.error('Error fetching servers:', error);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Get single server
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const server = await prisma.server.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json(server);
  } catch (error) {
    console.error('Error fetching server:', error);
    res.status(500).json({ error: 'Failed to fetch server' });
  }
});

// Create server
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, host, port, username, authType, privateKey, password, description } = req.body;
    const userId = req.user!.userId;

    const server = await prisma.server.create({
      data: {
        name,
        host,
        port: port || 22,
        username,
        authType: authType || 'password',
        privateKey,
        password,
        description,
        userId,
      },
    });

    res.status(201).json(server);
  } catch (error) {
    console.error('Error creating server:', error);
    res.status(500).json({ error: 'Failed to create server' });
  }
});

// Update server
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, host, port, username, authType, privateKey, password, description } = req.body;
    const userId = req.user!.userId;

    const server = await prisma.server.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        name,
        host,
        port,
        username,
        authType,
        privateKey,
        password,
        description,
        updatedAt: new Date(),
      },
    });

    if (server.count === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const updated = await prisma.server.findUnique({ where: { id } });
    res.json(updated);
  } catch (error) {
    console.error('Error updating server:', error);
    res.status(500).json({ error: 'Failed to update server' });
  }
});

// Delete server
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const deleted = await prisma.server.deleteMany({
      where: {
        id,
        userId,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting server:', error);
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

// Test server connection
router.post('/:id/test', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const server = await prisma.server.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // TODO: Implement actual SSH connection test
    // For now, just return success
    res.json({ success: true, message: 'Connection test not implemented' });
  } catch (error) {
    console.error('Error testing server connection:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

export default router;
