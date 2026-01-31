import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';
import jwt from 'jsonwebtoken';
import {
  ClientMessage,
  ServerMessage,
  ServerStatsData,
  TerminalStatus,
  SharePermission,
  ShareType,
  TerminalViewer,
  TeamMessage,
  WorkspaceMessage,
} from '@termify/shared';
import { ConnectionManager } from './ConnectionManager.js';
import { getPTYManager } from '../pty/PTYManager.js';
import { SSHManager } from '../ssh/SSHManager.js';
import { prisma } from '../lib/prisma.js';
import { NotificationService } from '../services/NotificationService.js';
import { ephemeralManager } from '../ephemeral/EphemeralTerminalManager.js';
import { serverStatsService } from '../services/ServerStatsService.js';

interface TokenPayload {
  userId: string;
  email: string;
}

interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

// Singleton instance
let wsServerInstance: TerminalWebSocketServer | null = null;

export function getWebSocketServer(): TerminalWebSocketServer | null {
  return wsServerInstance;
}

export class TerminalWebSocketServer {
  private wss: WSServer;
  private connectionManager: ConnectionManager;
  private jwtSecret: string;

  constructor(options: { port?: number; server?: any }) {
    wsServerInstance = this;
    this.jwtSecret = process.env.JWT_SECRET || 'development-secret';
    this.connectionManager = new ConnectionManager();

    this.wss = new WSServer({
      port: options.port,
      server: options.server,
      verifyClient: this.verifyClient.bind(this),
    });

    this.setupEventHandlers();
    this.setupPTYHandlers();
    this.setupSSHHandlers();
    this.setupServerStatsHandlers();

    console.log('[WS] WebSocket server initialized');
  }

  /**
   * Verify client before accepting connection
   */
  private verifyClient(
    info: { origin: string; req: IncomingMessage; secure: boolean },
    callback: (res: boolean, code?: number, message?: string) => void
  ): void {
    try {
      const url = parseUrl(info.req.url || '', true);
      const token = url.query.token as string;
      const shareToken = url.query.shareToken as string;
      const isDev = process.env.NODE_ENV === 'development';

      // Store shareToken for later use
      if (shareToken) {
        (info.req as any).shareToken = shareToken;
      }

      // In development, allow connections without token or with dev token
      if (isDev && (!token || token === 'dev')) {
        (info.req as any).userId = 'dev-user';
        console.log('[WS] Development mode: allowing connection without auth');
        callback(true);
        return;
      }

      // Allow connection with shareToken only (for public link shares)
      if (!token && shareToken) {
        (info.req as any).userId = null; // Anonymous user with share token
        console.log('[WS] Allowing connection with share token only');
        callback(true);
        return;
      }

      if (!token) {
        callback(false, 401, 'No token provided');
        return;
      }

      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;
      (info.req as any).userId = payload.userId;
      callback(true);
    } catch (error) {
      console.error('[WS] Auth error:', error);
      // In development, allow even if token is invalid
      if (process.env.NODE_ENV === 'development') {
        (info.req as any).userId = 'dev-user';
        console.log('[WS] Development mode: allowing connection despite auth error');
        callback(true);
        return;
      }
      callback(false, 401, 'Invalid token');
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      const userId = (req as any).userId;
      const shareToken = (req as any).shareToken;
      console.log(`[WS] New connection from user ${userId || 'anonymous'}`);

      // Get user info if authenticated
      let userInfo: { email: string; name: string | null; image: string | null } | undefined;
      if (userId && userId !== 'dev-user') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true, image: true },
        });
        if (user) {
          userInfo = user;
        }
      } else if (userId === 'dev-user') {
        userInfo = { email: 'dev@localhost', name: 'Dev User', image: null };
      }

      const connection = this.connectionManager.add(ws, userId || 'anonymous', userInfo);

      // Store share token in connection for later use
      (ws as any).shareToken = shareToken;

      ws.on('message', async (data: Buffer) => {
        try {
          // Rate limiting
          if (!this.connectionManager.checkRateLimit(ws)) {
            this.send(ws, { type: 'error', message: 'Rate limit exceeded' });
            return;
          }

          const message = JSON.parse(data.toString()) as ClientMessage;
          await this.handleMessage(ws, userId, message);
        } catch (error) {
          console.error('[WS] Message error:', error);
          this.send(ws, { type: 'error', message: 'Invalid message format' });
        }
      });

      ws.on('pong', () => {
        this.connectionManager.markAlive(ws);
      });

      ws.on('close', () => {
        console.log(`[WS] Connection closed for user ${userId || 'anonymous'}`);
        const conn = this.connectionManager.get(ws);
        const terminalId = conn?.terminalId;
        this.connectionManager.remove(ws);

        // Broadcast viewer left if was connected to a terminal
        if (terminalId && conn) {
          this.broadcastViewerLeft(terminalId, conn.visitorId, {
            userId: conn.userId,
            name: conn.name || undefined,
            email: conn.email,
          });
        }
      });

      ws.on('error', (error) => {
        console.error(`[WS] Error for user ${userId || 'anonymous'}:`, error);
        const conn = this.connectionManager.get(ws);
        const terminalId = conn?.terminalId;
        this.connectionManager.remove(ws);

        // Broadcast viewer left if was connected to a terminal
        if (terminalId && conn) {
          this.broadcastViewerLeft(terminalId, conn.visitorId, {
            userId: conn.userId,
            name: conn.name || undefined,
            email: conn.email,
          });
        }
      });
    });
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(
    ws: WebSocket,
    userId: string,
    message: ClientMessage
  ): Promise<void> {
    const ptyManager = getPTYManager();

    // Debug logging for all messages
    console.log(`[WS] Received message type: ${message.type}`, message.type === 'server.stats.subscribe' ? message : '');

    switch (message.type) {
      case 'ping':
        this.send(ws, { type: 'pong' });
        break;

      case 'terminal.connect':
        await this.handleTerminalConnect(ws, userId, message.terminalId);
        break;

      case 'terminal.start':
        await this.handleTerminalStart(ws, userId, message.terminalId);
        break;

      case 'terminal.stop':
        await this.handleTerminalStop(ws, userId, message.terminalId);
        break;

      case 'terminal.input':
        await this.handleTerminalInput(ws, userId, message.terminalId, message.data);
        break;

      case 'terminal.resize':
        await this.handleTerminalResize(
          ws,
          userId,
          message.terminalId,
          message.cols,
          message.rows
        );
        break;

      case 'team.subscribe':
        await this.handleTeamSubscribe(ws, userId, message.teamId);
        break;

      case 'team.unsubscribe':
        await this.handleTeamUnsubscribe(ws, message.teamId);
        break;

      case 'server.stats.subscribe':
        await this.handleServerStatsSubscribe(ws, userId, (message as any).serverId);
        break;

      case 'server.stats.unsubscribe':
        await this.handleServerStatsUnsubscribe(ws, (message as any).serverId);
        break;

      // Team chat messages
      case 'chat.team.send':
        await this.handleTeamChatSend(ws, userId, (message as any).teamId, (message as any).content);
        break;

      case 'chat.team.history':
        await this.handleTeamChatHistory(ws, userId, (message as any).teamId, (message as any).limit, (message as any).before);
        break;

      // Workspace messages
      case 'workspace.subscribe':
        await this.handleWorkspaceSubscribe(ws, userId, (message as any).workspaceId);
        break;

      case 'workspace.unsubscribe':
        await this.handleWorkspaceUnsubscribe(ws, (message as any).workspaceId);
        break;

      case 'chat.workspace.send':
        await this.handleWorkspaceChatSend(ws, userId, (message as any).workspaceId, (message as any).content);
        break;

      case 'chat.workspace.history':
        await this.handleWorkspaceChatHistory(ws, userId, (message as any).workspaceId, (message as any).limit, (message as any).before);
        break;

      default:
        this.send(ws, { type: 'error', message: 'Unknown message type' });
    }
  }

  /**
   * Handle terminal connection request
   */
  private async handleTerminalConnect(
    ws: WebSocket,
    userId: string,
    terminalId: string
  ): Promise<void> {
    const isDev = process.env.NODE_ENV === 'development';
    const shareToken = (ws as any).shareToken as string | undefined;

    // Check if this is an ephemeral terminal first
    const ephemeralTerminal = ephemeralManager.get(terminalId);
    if (ephemeralTerminal) {
      // Verify ownership for ephemeral terminal
      if (!ephemeralManager.verifyOwnership(terminalId, userId)) {
        this.send(ws, {
          type: 'terminal.error',
          terminalId,
          error: 'Access denied',
        });
        return;
      }

      // Associate connection with ephemeral terminal (owner has full control)
      console.log('[WS] Connecting to ephemeral terminal:', { terminalId, userId });
      this.connectionManager.associateTerminal(ws, terminalId, {
        permission: SharePermission.CONTROL,
        isOwner: true,
      });

      const ptyManager = getPTYManager();
      const sshManager = SSHManager.getInstance();
      const ptyInstance = ptyManager.get(terminalId);
      const sshRunning = sshManager.hasSession(terminalId);

      // Get buffered output if PTY/SSH is running
      const bufferedOutput = ptyInstance?.outputBuffer.getContents();

      this.send(ws, {
        type: 'terminal.connected',
        terminalId,
        bufferedOutput,
        permission: SharePermission.CONTROL,
      });

      this.send(ws, {
        type: 'terminal.status',
        terminalId,
        status: (ptyInstance?.status || (sshRunning ? TerminalStatus.RUNNING : ephemeralTerminal.status)) as TerminalStatus,
      });

      // Send viewers list (for ephemeral, just the owner)
      this.sendViewersList(ws, terminalId);
      return;
    }

    // Check access: owner, email share, or link share
    let terminal = await prisma.terminal.findUnique({
      where: { id: terminalId },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    // In development, create terminal if it doesn't exist
    if (!terminal && isDev) {
      console.log(`[WS] Dev mode: auto-creating terminal ${terminalId}`);
      let devUser = await prisma.user.findFirst({ where: { email: 'dev@localhost' } });
      if (!devUser) {
        devUser = await prisma.user.create({
          data: { email: 'dev@localhost', name: 'Dev User' },
        });
      }
      terminal = await prisma.terminal.create({
        data: {
          id: terminalId,
          userId: devUser.id,
          name: 'Dev Terminal',
          cols: 120,
          rows: 30,
        },
        include: {
          user: { select: { id: true, email: true } },
        },
      });
    }

    if (!terminal) {
      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: 'Terminal not found',
      });
      return;
    }

    // Determine access level
    let permission: SharePermission | null = null;
    let isOwner = false;

    // Check if user is owner
    if (userId && terminal.userId === userId) {
      isOwner = true;
      permission = SharePermission.CONTROL;
    }
    // Check if user is owner in dev mode
    else if (isDev && userId === 'dev-user') {
      isOwner = true;
      permission = SharePermission.CONTROL;
    }
    // Check link share
    else if (shareToken) {
      const linkShare = await prisma.terminalShare.findUnique({
        where: { shareToken },
      });
      if (linkShare && linkShare.terminalId === terminalId) {
        // Check expiration
        if (linkShare.expiresAt && linkShare.expiresAt < new Date()) {
          this.send(ws, {
            type: 'terminal.error',
            terminalId,
            error: 'Share link has expired',
          });
          return;
        }
        permission = linkShare.permission as SharePermission;
        // Update access stats
        await prisma.terminalShare.update({
          where: { id: linkShare.id },
          data: {
            lastAccessedAt: new Date(),
            accessCount: { increment: 1 },
          },
        });
      }
    }
    // Check email share
    else if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const emailShare = await prisma.terminalShare.findFirst({
          where: {
            terminalId,
            type: ShareType.EMAIL,
            OR: [
              { sharedWithId: userId },
              { sharedEmail: user.email },
            ],
          },
        });
        if (emailShare) {
          permission = emailShare.permission as SharePermission;
          // Update sharedWithId if not set
          if (!emailShare.sharedWithId) {
            await prisma.terminalShare.update({
              where: { id: emailShare.id },
              data: { sharedWithId: userId },
            });
          }
        }
      }
    }

    // No access
    if (!permission) {
      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: 'Access denied',
      });
      return;
    }

    // Associate connection with terminal and permission
    console.log('[WS] Associating terminal:', { terminalId, permission, isOwner });
    this.connectionManager.associateTerminal(ws, terminalId, { permission, isOwner });

    // Verify association worked
    const verifyConnection = this.connectionManager.get(ws);
    console.log('[WS] After association:', {
      terminalId: verifyConnection?.terminalId,
      permission: verifyConnection?.permission,
    });

    const ptyManager = getPTYManager();
    const instance = ptyManager.get(terminalId);

    // Get buffered output if PTY is running
    const bufferedOutput = instance?.outputBuffer.getContents();

    this.send(ws, {
      type: 'terminal.connected',
      terminalId,
      bufferedOutput,
      permission,
    });

    this.send(ws, {
      type: 'terminal.status',
      terminalId,
      status: (instance?.status || terminal.status) as TerminalStatus,
    });

    // Broadcast viewer joined and send current viewers
    this.broadcastViewerJoined(ws, terminalId);
    this.sendViewersList(ws, terminalId);
  }

  /**
   * Handle terminal start request
   */
  private async handleTerminalStart(
    ws: WebSocket,
    userId: string,
    terminalId: string
  ): Promise<void> {
    const isDev = process.env.NODE_ENV === 'development';

    // Check if this is an ephemeral terminal first
    const ephemeralTerminal = ephemeralManager.get(terminalId);
    if (ephemeralTerminal) {
      // Verify ownership for ephemeral terminal
      if (!ephemeralManager.verifyOwnership(terminalId, userId)) {
        this.send(ws, {
          type: 'terminal.error',
          terminalId,
          error: 'Access denied',
        });
        return;
      }

      // Route to appropriate handler based on type
      if (ephemeralTerminal.type === 'SSH') {
        await this.handleEphemeralSSHStart(ws, userId, terminalId, ephemeralTerminal);
      } else {
        await this.handleEphemeralPTYStart(ws, userId, terminalId, ephemeralTerminal);
      }
      return;
    }

    // Verify ownership (relaxed in dev mode)
    let terminal = await prisma.terminal.findFirst({
      where: isDev ? { id: terminalId } : { id: terminalId, userId },
    });

    // In development, create terminal if it doesn't exist
    if (!terminal && isDev) {
      console.log(`[WS] Dev mode: auto-creating terminal ${terminalId} for start`);
      let devUser = await prisma.user.findFirst({ where: { email: 'dev@localhost' } });
      if (!devUser) {
        devUser = await prisma.user.create({
          data: { email: 'dev@localhost', name: 'Dev User' },
        });
      }
      terminal = await prisma.terminal.create({
        data: {
          id: terminalId,
          userId: devUser.id,
          name: 'Dev Terminal',
          cols: 120,
          rows: 30,
        },
      });
    }

    if (!terminal) {
      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: 'Terminal not found or access denied',
      });
      return;
    }

    // Check terminal type and route to appropriate handler
    if (terminal.type === 'SSH') {
      await this.handleSSHTerminalStart(ws, userId, terminalId, terminal);
    } else {
      await this.handlePTYTerminalStart(ws, userId, terminalId, terminal);
    }
  }

  /**
   * Handle PTY (local) terminal start
   */
  private async handlePTYTerminalStart(
    ws: WebSocket,
    userId: string,
    terminalId: string,
    terminal: any
  ): Promise<void> {
    const ptyManager = getPTYManager();

    // Check if already running
    if (ptyManager.has(terminalId)) {
      this.send(ws, {
        type: 'terminal.status',
        terminalId,
        status: TerminalStatus.RUNNING,
      });
      return;
    }

    try {
      // Update status to starting
      await prisma.terminal.update({
        where: { id: terminalId },
        data: { status: TerminalStatus.STARTING },
      });

      this.broadcastStatus(terminalId, TerminalStatus.STARTING);

      // Create PTY instance
      await ptyManager.create(terminalId, userId, {
        cols: terminal.cols,
        rows: terminal.rows,
        cwd: terminal.cwd || undefined,
      });

      // Update status to running
      await prisma.terminal.update({
        where: { id: terminalId },
        data: { status: TerminalStatus.RUNNING, lastActiveAt: new Date() },
      });

      this.broadcastStatus(terminalId, TerminalStatus.RUNNING);
    } catch (error) {
      console.error(`[WS] Failed to start PTY terminal ${terminalId}:`, error);

      await prisma.terminal.update({
        where: { id: terminalId },
        data: { status: TerminalStatus.CRASHED },
      });

      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: error instanceof Error ? error.message : 'Failed to start terminal',
      });

      this.broadcastStatus(terminalId, TerminalStatus.CRASHED);
    }
  }

  /**
   * Handle SSH terminal start
   */
  private async handleSSHTerminalStart(
    ws: WebSocket,
    userId: string,
    terminalId: string,
    terminal: any
  ): Promise<void> {
    const sshManager = SSHManager.getInstance();

    // Check if already running
    if (sshManager.hasSession(terminalId)) {
      this.send(ws, {
        type: 'terminal.status',
        terminalId,
        status: TerminalStatus.RUNNING,
      });
      return;
    }

    // Validate SSH config
    if (!terminal.sshHost || !terminal.sshUsername) {
      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: 'SSH configuration is incomplete',
      });
      return;
    }

    try {
      // Update status to starting
      await prisma.terminal.update({
        where: { id: terminalId },
        data: { status: TerminalStatus.STARTING },
      });

      this.broadcastStatus(terminalId, TerminalStatus.STARTING);

      // Create SSH session
      await sshManager.createSession(
        terminalId,
        {
          host: terminal.sshHost,
          port: terminal.sshPort || 22,
          username: terminal.sshUsername,
          password: terminal.sshPassword || undefined,
          privateKey: terminal.sshPrivateKey || undefined,
        },
        terminal.cols,
        terminal.rows
      );

      // Update status to running
      await prisma.terminal.update({
        where: { id: terminalId },
        data: { status: TerminalStatus.RUNNING, lastActiveAt: new Date() },
      });

      this.broadcastStatus(terminalId, TerminalStatus.RUNNING);
    } catch (error) {
      console.error(`[WS] Failed to start SSH terminal ${terminalId}:`, error);

      await prisma.terminal.update({
        where: { id: terminalId },
        data: { status: TerminalStatus.CRASHED },
      });

      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: error instanceof Error ? error.message : 'Failed to connect to SSH server',
      });

      this.broadcastStatus(terminalId, TerminalStatus.CRASHED);
    }
  }

  /**
   * Handle ephemeral PTY (local) terminal start
   */
  private async handleEphemeralPTYStart(
    ws: WebSocket,
    userId: string,
    terminalId: string,
    ephemeral: ReturnType<typeof ephemeralManager.get>
  ): Promise<void> {
    if (!ephemeral) return;

    const ptyManager = getPTYManager();

    // Check if already running
    if (ptyManager.has(terminalId)) {
      this.send(ws, {
        type: 'terminal.status',
        terminalId,
        status: TerminalStatus.RUNNING,
      });
      return;
    }

    try {
      // Update ephemeral status to starting
      ephemeralManager.updateStatus(terminalId, TerminalStatus.STARTING);
      this.broadcastStatus(terminalId, TerminalStatus.STARTING);

      // Create PTY instance
      await ptyManager.create(terminalId, userId, {
        cols: ephemeral.cols,
        rows: ephemeral.rows,
      });

      // Update ephemeral status to running
      ephemeralManager.updateStatus(terminalId, TerminalStatus.RUNNING);
      this.broadcastStatus(terminalId, TerminalStatus.RUNNING);
    } catch (error) {
      console.error(`[WS] Failed to start ephemeral PTY terminal ${terminalId}:`, error);

      ephemeralManager.updateStatus(terminalId, TerminalStatus.CRASHED);

      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: error instanceof Error ? error.message : 'Failed to start terminal',
      });

      this.broadcastStatus(terminalId, TerminalStatus.CRASHED);
    }
  }

  /**
   * Handle ephemeral SSH terminal start
   */
  private async handleEphemeralSSHStart(
    ws: WebSocket,
    userId: string,
    terminalId: string,
    ephemeral: ReturnType<typeof ephemeralManager.get>
  ): Promise<void> {
    if (!ephemeral) return;

    const sshManager = SSHManager.getInstance();

    // Check if already running
    if (sshManager.hasSession(terminalId)) {
      this.send(ws, {
        type: 'terminal.status',
        terminalId,
        status: TerminalStatus.RUNNING,
      });
      return;
    }

    // Validate SSH config
    if (!ephemeral.sshHost || !ephemeral.sshUsername) {
      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: 'SSH configuration is incomplete',
      });
      return;
    }

    try {
      // Update ephemeral status to starting
      ephemeralManager.updateStatus(terminalId, TerminalStatus.STARTING);
      this.broadcastStatus(terminalId, TerminalStatus.STARTING);

      // Create SSH session
      await sshManager.createSession(
        terminalId,
        {
          host: ephemeral.sshHost,
          port: ephemeral.sshPort || 22,
          username: ephemeral.sshUsername,
          password: ephemeral.sshPassword || undefined,
          privateKey: ephemeral.sshPrivateKey || undefined,
        },
        ephemeral.cols,
        ephemeral.rows
      );

      // Update ephemeral status to running
      ephemeralManager.updateStatus(terminalId, TerminalStatus.RUNNING);
      this.broadcastStatus(terminalId, TerminalStatus.RUNNING);
    } catch (error) {
      console.error(`[WS] Failed to start ephemeral SSH terminal ${terminalId}:`, error);

      ephemeralManager.updateStatus(terminalId, TerminalStatus.CRASHED);

      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: error instanceof Error ? error.message : 'Failed to connect to SSH server',
      });

      this.broadcastStatus(terminalId, TerminalStatus.CRASHED);
    }
  }

  /**
   * Handle terminal stop request
   */
  private async handleTerminalStop(
    ws: WebSocket,
    userId: string,
    terminalId: string
  ): Promise<void> {
    const ptyManager = getPTYManager();
    const sshManager = SSHManager.getInstance();

    // Check if this is an ephemeral terminal
    const ephemeralTerminal = ephemeralManager.get(terminalId);
    if (ephemeralTerminal) {
      // Verify ownership
      if (!ephemeralManager.verifyOwnership(terminalId, userId)) {
        this.send(ws, {
          type: 'terminal.error',
          terminalId,
          error: 'Access denied',
        });
        return;
      }

      // Kill PTY or SSH (no buffer saving for ephemeral)
      if (ptyManager.has(terminalId)) {
        ptyManager.kill(terminalId);
      } else if (sshManager.hasSession(terminalId)) {
        sshManager.destroySession(terminalId);
      }

      ephemeralManager.updateStatus(terminalId, TerminalStatus.STOPPED);
      this.broadcastStatus(terminalId, TerminalStatus.STOPPED);
      return;
    }

    // Verify ownership for persistent terminal
    const terminal = await prisma.terminal.findFirst({
      where: { id: terminalId, userId },
    });

    if (!terminal) {
      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: 'Terminal not found or access denied',
      });
      return;
    }

    // Save output buffer before killing
    const instance = ptyManager.get(terminalId);
    if (instance) {
      const buffer = instance.outputBuffer.getBytes();
      await prisma.terminal.update({
        where: { id: terminalId },
        data: { outputBuffer: new Uint8Array(buffer) },
      });
    }

    ptyManager.kill(terminalId);

    await prisma.terminal.update({
      where: { id: terminalId },
      data: { status: TerminalStatus.STOPPED },
    });

    this.broadcastStatus(terminalId, TerminalStatus.STOPPED);
  }

  /**
   * Handle terminal input
   */
  private async handleTerminalInput(
    ws: WebSocket,
    userId: string,
    terminalId: string,
    data: string
  ): Promise<void> {
    const connection = this.connectionManager.get(ws);

    // Debug logging
    console.log('[WS] handleTerminalInput:', {
      terminalId,
      connectionExists: !!connection,
      connectionTerminalId: connection?.terminalId,
      match: connection?.terminalId === terminalId,
    });

    if (!connection) {
      console.error('[WS] No connection found for WebSocket');
      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: 'Connection not found. Please refresh the page.',
      });
      return;
    }

    if (connection.terminalId !== terminalId) {
      console.error('[WS] Terminal ID mismatch:', {
        expected: terminalId,
        actual: connection.terminalId,
      });
      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: 'Not connected to this terminal',
      });
      return;
    }

    // Check if user has CONTROL permission
    if (connection.permission !== SharePermission.CONTROL) {
      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: 'View-only access. You cannot write to this terminal.',
      });
      return;
    }

    const ptyManager = getPTYManager();
    const sshManager = SSHManager.getInstance();

    // Try PTY first
    const ptyInstance = ptyManager.get(terminalId);
    if (ptyInstance) {
      // For shared terminals, we don't check userId ownership of PTY instance
      // Permission check above is sufficient
      ptyManager.write(terminalId, data);
    }
    // Try SSH
    else if (sshManager.hasSession(terminalId)) {
      sshManager.write(terminalId, data);
    }
    // Neither running
    else {
      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: 'Terminal not running',
      });
      return;
    }

    // Update last active (skip for ephemeral terminals, ignore if terminal was deleted)
    if (!ephemeralManager.isEphemeral(terminalId)) {
      try {
        await prisma.terminal.update({
          where: { id: terminalId },
          data: { lastActiveAt: new Date() },
        });
      } catch (error) {
        // Terminal might have been deleted, ignore
      }
    }
  }

  /**
   * Handle terminal resize
   */
  private async handleTerminalResize(
    ws: WebSocket,
    userId: string,
    terminalId: string,
    cols: number,
    rows: number
  ): Promise<void> {
    const ptyManager = getPTYManager();
    const sshManager = SSHManager.getInstance();

    // Try PTY first
    const ptyInstance = ptyManager.get(terminalId);
    if (ptyInstance && ptyInstance.userId === userId) {
      ptyManager.resize(terminalId, cols, rows);
    }
    // Try SSH
    else if (sshManager.hasSession(terminalId)) {
      sshManager.resize(terminalId, cols, rows);
    }
    // Not running, silently ignore
    else {
      return;
    }

    // Update dimensions (skip for ephemeral terminals, ignore if terminal was deleted)
    if (!ephemeralManager.isEphemeral(terminalId)) {
      try {
        await prisma.terminal.update({
          where: { id: terminalId },
          data: { cols, rows },
        });
      } catch (error) {
        // Terminal might have been deleted, ignore
      }
    }
  }

  /**
   * Set up PTY event handlers
   */
  private setupPTYHandlers(): void {
    const ptyManager = getPTYManager();

    // Track recent input to detect file-changing commands
    const recentInputs = new Map<string, string>();
    const pendingRefresh = new Map<string, NodeJS.Timeout>();

    // Forward PTY output to connected clients
    ptyManager.on('data', (terminalId: string, data: string) => {
      const message: ServerMessage = {
        type: 'terminal.output',
        terminalId,
        data,
      };
      this.connectionManager.broadcastToTerminal(
        terminalId,
        JSON.stringify(message)
      );

      // Check if recent input was a file-changing command
      const recentInput = recentInputs.get(terminalId) || '';

      // Commands that likely change files/directories
      const fileChangingCommands = [
        /^cd\s/i,
        /^mkdir\s/i,
        /^rmdir\s/i,
        /^rm\s/i,
        /^touch\s/i,
        /^mv\s/i,
        /^cp\s/i,
        /^ln\s/i,
        /^git\s+(checkout|pull|merge|rebase|reset|stash|clone)/i,
        /^npm\s+(install|uninstall|update)/i,
        /^yarn\s+(add|remove|install)/i,
        /^pnpm\s+(add|remove|install)/i,
        /^unzip\s/i,
        /^tar\s/i,
        /^wget\s/i,
        /^curl\s.*-o/i,
      ];

      const mightChangeFiles = fileChangingCommands.some(pattern => pattern.test(recentInput.trim()));

      // Detect shell prompt patterns that indicate command completed
      const promptPatterns = [
        /\$\s*$/, />\s*$/, /❯\s*$/, /#\s*$/, /\]\s*$/,
        /➜\s*$/, /λ\s*$/, /⟩\s*$/,
      ];
      const hasPrompt = promptPatterns.some(p => p.test(data));

      if (mightChangeFiles && hasPrompt) {
        // Debounce file refresh notifications
        if (pendingRefresh.has(terminalId)) {
          clearTimeout(pendingRefresh.get(terminalId)!);
        }

        pendingRefresh.set(terminalId, setTimeout(() => {
          pendingRefresh.delete(terminalId);
          recentInputs.delete(terminalId);

          // Broadcast files.changed event
          const refreshMessage: ServerMessage = {
            type: 'files.changed',
            terminalId,
          };
          this.connectionManager.broadcastToTerminal(
            terminalId,
            JSON.stringify(refreshMessage)
          );
        }, 300)); // Wait 300ms for any trailing output
      }
    });

    // Track input to detect commands
    ptyManager.on('input', (terminalId: string, input: string) => {
      // Accumulate input until Enter
      const current = recentInputs.get(terminalId) || '';
      if (input === '\r' || input === '\n') {
        // Keep the accumulated command for detection
      } else {
        recentInputs.set(terminalId, current + input);
      }
    });

    // Handle CWD changes
    ptyManager.on('cwd', async (terminalId: string, cwd: string) => {
      // Update the database with the new CWD (skip for ephemeral terminals)
      if (!ephemeralManager.isEphemeral(terminalId)) {
        try {
          await prisma.terminal.update({
            where: { id: terminalId },
            data: { cwd },
          });
        } catch (error) {
          // Terminal might have been deleted, ignore
        }
      }

      // Broadcast CWD change to connected clients
      const message: ServerMessage = {
        type: 'terminal.cwd',
        terminalId,
        cwd,
      };
      this.connectionManager.broadcastToTerminal(
        terminalId,
        JSON.stringify(message)
      );
    });

    // Handle working state changes
    ptyManager.on('working', async (terminalId: string, isWorking: boolean) => {
      console.log(`[WS] Terminal ${terminalId} working state: ${isWorking}`);

      // Get the PTY instance to find the userId
      const ptyInstance = ptyManager.get(terminalId);
      const userId = ptyInstance?.userId;

      // Update database (skip for ephemeral terminals)
      if (!ephemeralManager.isEphemeral(terminalId)) {
        try {
          await prisma.terminal.update({
            where: { id: terminalId },
            data: { isWorking },
          });
        } catch (error) {
          // Terminal might have been deleted, ignore
        }
      }

      // Broadcast to all clients subscribed to this terminal
      const message: ServerMessage = {
        type: 'terminal.working',
        terminalId,
        isWorking,
      };
      this.connectionManager.broadcastToTerminal(
        terminalId,
        JSON.stringify(message)
      );

      // Also broadcast to the owner's other connections (for terminals list page)
      if (userId) {
        this.connectionManager.sendToUser(userId, message);
      }
    });

    // Handle PTY exit
    ptyManager.on('exit', async (terminalId: string, exitCode: number) => {
      const status =
        exitCode === 0 ? TerminalStatus.STOPPED : TerminalStatus.CRASHED;

      // Check if this is an ephemeral terminal
      if (ephemeralManager.isEphemeral(terminalId)) {
        ephemeralManager.updateStatus(terminalId, status);
        this.broadcastStatus(terminalId, status);
        console.log(`[WS] Ephemeral terminal ${terminalId} exited with code ${exitCode}`);
        return;
      }

      try {
        // Try to update, but the terminal might have been deleted
        const terminal = await prisma.terminal.update({
          where: { id: terminalId },
          data: { status },
        });
        this.broadcastStatus(terminalId, status);

        // Send push notification if terminal crashed (non-zero exit code)
        if (exitCode !== 0) {
          const notificationService = NotificationService.getInstance();
          notificationService.notifyTerminalCrashed({
            userId: terminal.userId,
            terminalId: terminal.id,
            terminalName: terminal.name,
            exitCode,
          }).catch((err) => {
            console.error('[WS] Failed to send terminal crashed notification:', err);
          });
        }
      } catch (error) {
        // Terminal was likely deleted, ignore the error
        console.log(`[WS] Terminal ${terminalId} no longer exists, skipping status update`);
      }
    });
  }

  /**
   * Set up SSH event handlers
   */
  private setupSSHHandlers(): void {
    const sshManager = SSHManager.getInstance();

    // Forward SSH output to connected clients
    sshManager.on('data', (terminalId: string, data: string) => {
      const message: ServerMessage = {
        type: 'terminal.output',
        terminalId,
        data,
      };
      this.connectionManager.broadcastToTerminal(
        terminalId,
        JSON.stringify(message)
      );
    });

    // Handle SSH session close
    sshManager.on('close', async (terminalId: string) => {
      // Check if this is an ephemeral terminal
      if (ephemeralManager.isEphemeral(terminalId)) {
        ephemeralManager.updateStatus(terminalId, TerminalStatus.STOPPED);
        this.broadcastStatus(terminalId, TerminalStatus.STOPPED);
        console.log(`[WS] Ephemeral SSH terminal ${terminalId} closed`);
        return;
      }

      try {
        await prisma.terminal.update({
          where: { id: terminalId },
          data: { status: TerminalStatus.STOPPED },
        });
        this.broadcastStatus(terminalId, TerminalStatus.STOPPED);
      } catch (error) {
        console.log(`[WS] SSH Terminal ${terminalId} no longer exists, skipping status update`);
      }
    });

    // Handle SSH errors
    sshManager.on('error', async (terminalId: string, error: Error) => {
      console.error(`[WS] SSH error for terminal ${terminalId}:`, error);

      // Check if this is an ephemeral terminal
      if (ephemeralManager.isEphemeral(terminalId)) {
        ephemeralManager.updateStatus(terminalId, TerminalStatus.CRASHED);
        this.broadcastStatus(terminalId, TerminalStatus.CRASHED);

        // Send error message to connected clients
        const message: ServerMessage = {
          type: 'terminal.error',
          terminalId,
          error: error.message,
        };
        this.connectionManager.broadcastToTerminal(
          terminalId,
          JSON.stringify(message)
        );
        console.log(`[WS] Ephemeral SSH terminal ${terminalId} error: ${error.message}`);
        return;
      }

      try {
        const terminal = await prisma.terminal.update({
          where: { id: terminalId },
          data: { status: TerminalStatus.CRASHED },
        });
        this.broadcastStatus(terminalId, TerminalStatus.CRASHED);

        // Send error message to connected clients
        const message: ServerMessage = {
          type: 'terminal.error',
          terminalId,
          error: error.message,
        };
        this.connectionManager.broadcastToTerminal(
          terminalId,
          JSON.stringify(message)
        );

        // Send push notification for SSH connection failure
        const notificationService = NotificationService.getInstance();
        notificationService.notifySSHConnectionFailed({
          userId: terminal.userId,
          terminalId: terminal.id,
          terminalName: terminal.name,
          host: terminal.sshHost || 'unknown',
          error: error.message,
        }).catch((err) => {
          console.error('[WS] Failed to send SSH error notification:', err);
        });
      } catch (err) {
        console.log(`[WS] SSH Terminal ${terminalId} no longer exists, skipping error update`);
      }
    });
  }

  /**
   * Broadcast status change to all connections
   */
  private broadcastStatus(terminalId: string, status: TerminalStatus): void {
    const message: ServerMessage = {
      type: 'terminal.status',
      terminalId,
      status,
    };
    this.connectionManager.broadcastToTerminal(
      terminalId,
      JSON.stringify(message)
    );
  }

  /**
   * Send message to a single connection
   */
  private send(ws: WebSocket, message: ServerMessage): void {
    this.connectionManager.send(ws, message);
  }

  /**
   * Broadcast viewer joined to all connections on a terminal
   */
  private async broadcastViewerJoined(ws: WebSocket, terminalId: string): Promise<void> {
    const connection = this.connectionManager.get(ws);
    if (!connection) return;

    const viewer: TerminalViewer = {
      odId: connection.odId,
      visitorId: connection.visitorId,
      email: connection.email,
      name: connection.name,
      image: connection.image,
      permission: connection.permission || SharePermission.VIEW,
      isOwner: connection.isOwner,
    };

    const message: ServerMessage = {
      type: 'terminal.viewer.joined',
      terminalId,
      viewer,
    };

    // Broadcast to all other connections on this terminal
    const sockets = this.connectionManager.getTerminalConnections(terminalId);
    for (const socket of sockets) {
      if (socket !== ws && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    }

    // Send push notification to terminal owner (if viewer is not the owner)
    console.log('[WS] broadcastViewerJoined - checking notification:', {
      isOwner: connection.isOwner,
      email: connection.email,
      userId: connection.userId,
      terminalId,
    });

    if (!connection.isOwner && connection.email) {
      try {
        const terminal = await prisma.terminal.findUnique({
          where: { id: terminalId },
          select: { userId: true, name: true },
        });

        console.log('[WS] broadcastViewerJoined - terminal owner check:', {
          terminalUserId: terminal?.userId,
          connectionUserId: connection.userId,
          shouldNotify: terminal && terminal.userId !== connection.userId,
        });

        if (terminal && terminal.userId !== connection.userId) {
          const notificationService = NotificationService.getInstance();
          console.log('[WS] broadcastViewerJoined - sending notification to owner:', terminal.userId);
          notificationService.notifyViewerJoined({
            ownerId: terminal.userId,
            viewerId: connection.userId,
            terminalId,
            terminalName: terminal.name,
            viewerName: connection.name || '',
            viewerEmail: connection.email,
          }).catch((err) => {
            console.error('[WS] Failed to send viewer joined notification:', err);
          });
        }
      } catch (err) {
        console.error('[WS] Failed to fetch terminal for viewer notification:', err);
      }
    } else {
      console.log('[WS] broadcastViewerJoined - skipping notification (isOwner or no email)');
    }
  }

  /**
   * Broadcast viewer left to all connections on a terminal
   */
  private async broadcastViewerLeft(terminalId: string, visitorId: string, viewerInfo?: { userId?: string; name?: string; email?: string }): Promise<void> {
    const message: ServerMessage = {
      type: 'terminal.viewer.left',
      terminalId,
      odId: visitorId,
    };

    this.connectionManager.broadcastToTerminal(terminalId, JSON.stringify(message));

    // Send push notification to terminal owner (if we have viewer info and they're not the owner)
    if (viewerInfo?.email && viewerInfo?.userId) {
      try {
        const terminal = await prisma.terminal.findUnique({
          where: { id: terminalId },
          select: { userId: true, name: true },
        });

        console.log('[WS] broadcastViewerLeft - checking notification:', {
          terminalUserId: terminal?.userId,
          viewerUserId: viewerInfo.userId,
          shouldNotify: terminal && terminal.userId !== viewerInfo.userId,
        });

        if (terminal && terminal.userId !== viewerInfo.userId) {
          const notificationService = NotificationService.getInstance();
          notificationService.notifyViewerLeft({
            ownerId: terminal.userId,
            viewerId: viewerInfo.userId,
            terminalId,
            terminalName: terminal.name,
            viewerName: viewerInfo.name || '',
            viewerEmail: viewerInfo.email,
          }).catch((err) => {
            console.error('[WS] Failed to send viewer left notification:', err);
          });
        } else {
          console.log('[WS] broadcastViewerLeft - skipping notification (owner left their own terminal)');
        }
      } catch (err) {
        console.error('[WS] Failed to fetch terminal for viewer left notification:', err);
      }
    } else {
      console.log('[WS] broadcastViewerLeft - skipping notification (no email or userId):', { viewerInfo });
    }
  }

  /**
   * Send current viewers list to a connection
   */
  private sendViewersList(ws: WebSocket, terminalId: string): void {
    const viewers = this.connectionManager.getTerminalViewers(terminalId);
    const viewerList: TerminalViewer[] = viewers.map((v) => ({
      odId: v.odId,
      visitorId: v.visitorId,
      email: v.email,
      name: v.name,
      image: v.image,
      permission: v.permission || SharePermission.VIEW,
      isOwner: v.isOwner,
    }));

    this.send(ws, {
      type: 'terminal.viewers',
      terminalId,
      viewers: viewerList,
    });
  }

  /**
   * Handle team subscription request
   */
  private async handleTeamSubscribe(
    ws: WebSocket,
    userId: string,
    teamId: string
  ): Promise<void> {
    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      this.send(ws, {
        type: 'error',
        message: 'You are not a member of this team',
      });
      return;
    }

    // Subscribe to team
    this.connectionManager.subscribeToTeam(ws, teamId);
    this.send(ws, { type: 'team.subscribed', teamId });
    console.log(`[WS] User ${userId} subscribed to team ${teamId}`);
  }

  /**
   * Handle team unsubscription request
   */
  private async handleTeamUnsubscribe(
    ws: WebSocket,
    teamId: string
  ): Promise<void> {
    this.connectionManager.unsubscribeFromTeam(ws, teamId);
    console.log(`[WS] Connection unsubscribed from team ${teamId}`);
  }

  /**
   * Broadcast a message to all subscribers of a team
   */
  broadcastToTeam(teamId: string, message: ServerMessage): void {
    this.connectionManager.broadcastToTeam(teamId, JSON.stringify(message));
  }

  /**
   * Broadcast a message to all connections of a user
   */
  broadcastToUser(userId: string, message: any): void {
    this.connectionManager.sendToUser(userId, message);
  }

  /**
   * Get server stats
   */
  getStats() {
    return this.connectionManager.getStats();
  }

  /**
   * Send a notification to a user via WebSocket
   */
  sendNotificationToUser(userId: string, notification: any): void {
    const message: ServerMessage = {
      type: 'notification',
      notification,
    };
    this.connectionManager.sendToUser(userId, message);
  }

  // ============================================
  // Server Stats Methods
  // ============================================

  /**
   * Handle server stats subscription
   */
  private async handleServerStatsSubscribe(
    ws: WebSocket,
    userId: string,
    serverId: string
  ): Promise<void> {
    if (!serverId) {
      this.send(ws, { type: 'error', message: 'Server ID required' });
      return;
    }

    const isDev = process.env.NODE_ENV === 'development';
    console.log(`[WS] handleServerStatsSubscribe: serverId=${serverId}, userId=${userId}, isDev=${isDev}`);

    // Verify user owns the server (in dev mode, skip userId check)
    const server = await prisma.server.findFirst({
      where: isDev ? { id: serverId } : { id: serverId, userId },
    });

    console.log(`[WS] handleServerStatsSubscribe: server found=${!!server}, host=${server?.host}`);

    if (!server) {
      this.send(ws, { type: 'error', message: 'Server not found or access denied' });
      return;
    }

    // Track subscription in connection FIRST so error events are received
    this.connectionManager.subscribeToServer(ws, serverId);

    // Send subscribed message
    const msg: ServerMessage = {
      type: 'server.stats.subscribed',
      serverId,
    };
    this.send(ws, msg);

    // Send initial terminal count
    const terminalCount = ephemeralManager.getCountByServer(serverId);
    const countMsg: ServerMessage = {
      type: 'server.terminalCount',
      serverId,
      count: terminalCount,
    };
    this.send(ws, countMsg);

    console.log(`[WS] User ${userId} subscribed to server stats: ${serverId} (${terminalCount} terminals)`);

    // Start collecting if not already (do this AFTER subscription is tracked)
    if (!serverStatsService.isCollecting(serverId)) {
      try {
        await serverStatsService.startCollecting(serverId, userId);
      } catch (err) {
        // Error will be emitted via the 'error' event, which is handled separately
        console.error(`[WS] Failed to start collecting for ${serverId}:`, err);
      }
    }
  }

  /**
   * Handle server stats unsubscription
   */
  private async handleServerStatsUnsubscribe(
    ws: WebSocket,
    serverId: string
  ): Promise<void> {
    if (!serverId) return;

    this.connectionManager.unsubscribeFromServer(ws, serverId);

    // If no one is subscribed, stop collecting
    const subscribers = this.connectionManager.getServerSubscribers(serverId);
    if (subscribers.length === 0) {
      serverStatsService.stopCollecting(serverId);
    }

    const msg: ServerMessage = {
      type: 'server.stats.unsubscribed',
      serverId,
    };
    this.send(ws, msg);

    console.log(`[WS] Unsubscribed from server stats: ${serverId}`);
  }

  /**
   * Broadcast server stats to subscribers
   */
  broadcastServerStats(serverId: string, stats: ServerStatsData): void {
    const subscribers = this.connectionManager.getServerSubscribers(serverId);
    const message: ServerMessage = {
      type: 'server.stats',
      serverId,
      stats,
    };

    for (const ws of subscribers) {
      this.send(ws, message);
    }
  }

  /**
   * Setup server stats event listeners
   */
  private setupServerStatsHandlers(): void {
    serverStatsService.on('stats', ({ serverId, stats }) => {
      this.broadcastServerStats(serverId, stats);
    });

    serverStatsService.on('error', ({ serverId, error }) => {
      const subscribers = this.connectionManager.getServerSubscribers(serverId);
      const message: ServerMessage = {
        type: 'server.stats.error',
        serverId,
        error,
      };
      for (const ws of subscribers) {
        this.send(ws, message);
      }
    });

    serverStatsService.on('connected', ({ serverId }) => {
      const subscribers = this.connectionManager.getServerSubscribers(serverId);
      const message: ServerMessage = {
        type: 'server.stats.connected',
        serverId,
      };
      for (const ws of subscribers) {
        this.send(ws, message);
      }
    });

    serverStatsService.on('disconnected', ({ serverId }) => {
      const subscribers = this.connectionManager.getServerSubscribers(serverId);
      const message: ServerMessage = {
        type: 'server.stats.disconnected',
        serverId,
      };
      for (const ws of subscribers) {
        this.send(ws, message);
      }
    });

    // Listen for terminal count updates from EphemeralTerminalManager
    ephemeralManager.on('terminalCountUpdate', ({ serverId, count }) => {
      const subscribers = this.connectionManager.getServerSubscribers(serverId);
      const message: ServerMessage = {
        type: 'server.terminalCount',
        serverId,
        count,
      };
      for (const ws of subscribers) {
        this.send(ws, message);
      }
    });
  }

  // ============================================
  // Team Chat Methods
  // ============================================

  /**
   * Handle team chat message send
   */
  private async handleTeamChatSend(
    ws: WebSocket,
    userId: string,
    teamId: string,
    content: string
  ): Promise<void> {
    if (!content?.trim()) {
      this.send(ws, { type: 'error', message: 'Message content is required' });
      return;
    }

    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      this.send(ws, { type: 'error', message: 'You are not a member of this team' });
      return;
    }

    // Create message
    const message = await prisma.teamMessage.create({
      data: {
        teamId,
        userId,
        content: content.trim(),
      },
      include: {
        user: { select: { id: true, email: true, name: true, image: true } },
      },
    });

    // Broadcast to all team subscribers
    const serverMessage: ServerMessage = {
      type: 'chat.team.message',
      teamId,
      message: {
        id: message.id,
        teamId: message.teamId,
        userId: message.userId,
        content: message.content,
        user: message.user,
        createdAt: message.createdAt,
      } as TeamMessage,
    };

    this.connectionManager.broadcastToTeam(teamId, JSON.stringify(serverMessage));

    // Send notifications to team members who are NOT subscribed to the team chat
    this.sendTeamChatNotifications(teamId, userId, message.user?.name || 'Someone', content.trim()).catch((err) => {
      console.error('[WS] Failed to send team chat notifications:', err);
    });
  }

  /**
   * Send notifications to team members not currently subscribed to team chat
   */
  private async sendTeamChatNotifications(
    teamId: string,
    senderId: string,
    senderName: string,
    messageContent: string
  ): Promise<void> {
    // Get all team members except the sender
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        teamId,
        userId: { not: senderId },
      },
      select: { userId: true },
    });

    // Get the team name
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true },
    });

    // Get users who are currently subscribed to this team
    const subscribedUserIds = this.connectionManager.getTeamSubscriberUserIds(teamId);

    // Send notification only to members who are NOT subscribed
    const notificationService = NotificationService.getInstance();
    for (const member of teamMembers) {
      if (!subscribedUserIds.includes(member.userId)) {
        notificationService.notifyTeamChatMessage({
          recipientId: member.userId,
          teamId,
          teamName: team?.name || 'Team',
          senderName,
          messagePreview: messageContent.length > 50 ? messageContent.slice(0, 50) + '...' : messageContent,
        }).catch((err) => {
          console.error('[WS] Failed to send team chat notification to user:', member.userId, err);
        });
      }
    }
  }

  /**
   * Handle team chat history request
   */
  private async handleTeamChatHistory(
    ws: WebSocket,
    userId: string,
    teamId: string,
    limit: number = 50,
    before?: string
  ): Promise<void> {
    // Verify membership
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      this.send(ws, { type: 'error', message: 'You are not a member of this team' });
      return;
    }

    // Fetch messages
    const messages = await prisma.teamMessage.findMany({
      where: {
        teamId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      include: {
        user: { select: { id: true, email: true, name: true, image: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });

    // Send messages in chronological order
    this.send(ws, {
      type: 'chat.team.messages',
      teamId,
      messages: messages.reverse().map((m) => ({
        id: m.id,
        teamId: m.teamId,
        userId: m.userId,
        content: m.content,
        user: m.user,
        createdAt: m.createdAt,
      })),
    });

    // Also send online members
    const onlineMembers = this.connectionManager.getTeamOnlineMembers(teamId);
    this.send(ws, {
      type: 'chat.team.online',
      teamId,
      members: onlineMembers,
    });
  }

  // ============================================
  // Workspace Chat Methods
  // ============================================

  /**
   * Handle workspace subscription
   */
  private async handleWorkspaceSubscribe(
    ws: WebSocket,
    userId: string,
    workspaceId: string
  ): Promise<void> {
    // Verify access (owner or shared)
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { userId },
          { shares: { some: { sharedWithId: userId } } },
          { team: { members: { some: { userId } } } },
        ],
      },
    });

    if (!workspace) {
      this.send(ws, { type: 'error', message: 'Workspace not found or access denied' });
      return;
    }

    // Subscribe to workspace
    this.connectionManager.subscribeToWorkspace(ws, workspaceId);
    this.send(ws, { type: 'workspace.subscribed', workspaceId });
    console.log(`[WS] User ${userId} subscribed to workspace ${workspaceId}`);
  }

  /**
   * Handle workspace unsubscription
   */
  private async handleWorkspaceUnsubscribe(
    ws: WebSocket,
    workspaceId: string
  ): Promise<void> {
    this.connectionManager.unsubscribeFromWorkspace(ws, workspaceId);
    console.log(`[WS] Connection unsubscribed from workspace ${workspaceId}`);
  }

  /**
   * Handle workspace chat message send
   */
  private async handleWorkspaceChatSend(
    ws: WebSocket,
    userId: string,
    workspaceId: string,
    content: string
  ): Promise<void> {
    console.log('[WS] handleWorkspaceChatSend:', { userId, workspaceId, content: content?.substring(0, 50) });

    if (!content?.trim()) {
      this.send(ws, { type: 'error', message: 'Message content is required' });
      return;
    }

    // Verify access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { userId },
          { shares: { some: { sharedWithId: userId } } },
          { team: { members: { some: { userId } } } },
        ],
      },
    });

    if (!workspace) {
      console.log('[WS] Workspace access denied for chat send:', workspaceId);
      this.send(ws, { type: 'error', message: 'Workspace not found or access denied' });
      return;
    }

    // Create message
    const message = await prisma.workspaceMessage.create({
      data: {
        workspaceId,
        userId,
        content: content.trim(),
      },
      include: {
        user: { select: { id: true, email: true, name: true, image: true } },
      },
    });

    console.log('[WS] Message created:', message.id);

    // Broadcast to all workspace subscribers
    const serverMessage: ServerMessage = {
      type: 'chat.workspace.message',
      workspaceId,
      message: {
        id: message.id,
        workspaceId: message.workspaceId,
        userId: message.userId,
        content: message.content,
        user: message.user,
        createdAt: message.createdAt,
      } as WorkspaceMessage,
    };

    console.log('[WS] Broadcasting chat.workspace.message to workspace:', workspaceId);
    this.connectionManager.broadcastToWorkspace(workspaceId, JSON.stringify(serverMessage));
  }

  /**
   * Handle workspace chat history request
   */
  private async handleWorkspaceChatHistory(
    ws: WebSocket,
    userId: string,
    workspaceId: string,
    limit: number = 50,
    before?: string
  ): Promise<void> {
    console.log('[WS] handleWorkspaceChatHistory:', { userId, workspaceId, limit, before });

    // Verify access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { userId },
          { shares: { some: { sharedWithId: userId } } },
          { team: { members: { some: { userId } } } },
        ],
      },
    });

    if (!workspace) {
      console.log('[WS] Workspace not found or access denied:', workspaceId);
      this.send(ws, { type: 'error', message: 'Workspace not found or access denied' });
      return;
    }

    // Fetch messages
    const messages = await prisma.workspaceMessage.findMany({
      where: {
        workspaceId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      include: {
        user: { select: { id: true, email: true, name: true, image: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });

    console.log('[WS] Sending chat.workspace.messages:', messages.length, 'messages for workspace:', workspaceId);

    // Send messages in chronological order
    this.send(ws, {
      type: 'chat.workspace.messages',
      workspaceId,
      messages: messages.reverse().map((m) => ({
        id: m.id,
        workspaceId: m.workspaceId,
        userId: m.userId,
        content: m.content,
        user: m.user,
        createdAt: m.createdAt,
      })),
    });

    // Also send online users
    const onlineUsers = this.connectionManager.getWorkspaceOnlineUsers(workspaceId);
    this.send(ws, {
      type: 'chat.workspace.online',
      workspaceId,
      users: onlineUsers,
    });
  }

  /**
   * Broadcast a message to all subscribers of a workspace
   */
  broadcastToWorkspace(workspaceId: string, message: ServerMessage): void {
    this.connectionManager.broadcastToWorkspace(workspaceId, JSON.stringify(message));
  }

  /**
   * Shutdown the server
   */
  shutdown(): void {
    this.connectionManager.shutdown();
    this.wss.close();
    getPTYManager().shutdown();
    SSHManager.getInstance().destroyAll();

    // Stop all stats collectors
    for (const serverId of serverStatsService.getActiveCollectors()) {
      serverStatsService.stopCollecting(serverId);
    }
  }
}
