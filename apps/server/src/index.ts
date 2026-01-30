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
import snippetsRoutes from './api/snippets.js';
import profilesRoutes from './api/profiles.js';
import auditlogsRoutes from './api/auditlogs.js';
import apikeysRoutes from './api/apikeys.js';
import shareRoutes from './api/share.js';
import notificationsRoutes from './api/notifications.js';
import workspacesRoutes from './api/workspaces.js';
import teamsRoutes from './api/teams.js';
import tasksRoutes from './api/tasks.js';
import pushRoutes from './api/push.js';
import teamTerminalsRoutes from './api/team-terminals.js';
import teamWorkspacesRoutes from './api/team-workspaces.js';
import teamSnippetsRoutes from './api/team-snippets.js';
import teamServersRoutes from './api/team-servers.js';
import teamHistoryRoutes from './api/team-history.js';
import teamPresenceRoutes from './api/team-presence.js';
import teamRolesRoutes from './api/team-roles.js';
import taskCommandsRoutes from './api/task-commands.js';
import personalTasksRoutes from './api/personal-tasks.js';
import personalTaskBoardsRoutes from './api/personal-task-boards.js';
import usersRoutes from './api/users.js';
import terminalQueueRoutes from './api/terminal-queue.js';

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
app.use('/api', shareRoutes); // Must be before terminalsRoutes to handle /terminals/shared
app.use('/api/terminals', terminalsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/snippets', snippetsRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/auditlogs', auditlogsRoutes);
app.use('/api/apikeys', apikeysRoutes);
app.use('/api', notificationsRoutes);
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/teams', teamTerminalsRoutes);
app.use('/api/teams', teamWorkspacesRoutes);
app.use('/api/teams', teamSnippetsRoutes);
app.use('/api/teams', teamServersRoutes);
app.use('/api/teams', teamHistoryRoutes);
app.use('/api/teams', teamPresenceRoutes);
app.use('/api/teams', teamRolesRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/tasks', taskCommandsRoutes);
app.use('/api/personal-tasks', personalTasksRoutes);
app.use('/api/personal-task-boards', personalTaskBoardsRoutes);
app.use('/api', pushRoutes);
app.use('/api/users', usersRoutes);
app.use('/api', terminalQueueRoutes);

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
║   Termify - Server                                          ║
║                                                           ║
║   HTTP API:    http://localhost:${PORT}                    ║
║   WebSocket:   ws://localhost:${PORT}                      ║
║   Health:      http://localhost:${PORT}/health             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
});
