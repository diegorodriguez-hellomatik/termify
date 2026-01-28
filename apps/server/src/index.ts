import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { TerminalWebSocketServer } from './websocket/WebSocketServer.js';
import { getPTYManager } from './pty/PTYManager.js';
import { prisma } from './lib/prisma.js';
import authRoutes from './api/auth.js';
import terminalsRoutes from './api/terminals.js';
import categoriesRoutes from './api/categories.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/terminals', terminalsRoutes);
app.use('/api/categories', categoriesRoutes);

// Stats endpoint
app.get('/api/stats', (req, res) => {
  const ptyManager = getPTYManager();
  res.json({
    ptyInstances: ptyManager.count,
    // wsStats will be added after wsServer is initialized
  });
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wsServer = new TerminalWebSocketServer({ server });

// Update stats endpoint with WebSocket stats
app.get('/api/stats', (req, res) => {
  const ptyManager = getPTYManager();
  res.json({
    ptyInstances: ptyManager.count,
    wsStats: wsServer.getStats(),
  });
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);

  // Close WebSocket connections
  wsServer.shutdown();

  // Close HTTP server
  server.close(() => {
    console.log('[Server] HTTP server closed');
  });

  // Disconnect Prisma
  await prisma.$disconnect();
  console.log('[Server] Database disconnected');

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Claude Terminal Platform - Server                       ║
║                                                           ║
║   HTTP API:    http://localhost:${PORT}                    ║
║   WebSocket:   ws://localhost:${PORT}                      ║
║   Health:      http://localhost:${PORT}/health             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
});
