import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';
import jwt from 'jsonwebtoken';
import {
  ClientMessage,
  ServerMessage,
  TerminalStatus,
} from '@claude-terminal/shared';
import { ConnectionManager } from './ConnectionManager.js';
import { getPTYManager } from '../pty/PTYManager.js';
import { prisma } from '../lib/prisma.js';

interface TokenPayload {
  userId: string;
  email: string;
}

export class TerminalWebSocketServer {
  private wss: WSServer;
  private connectionManager: ConnectionManager;
  private jwtSecret: string;

  constructor(options: { port?: number; server?: any }) {
    this.jwtSecret = process.env.JWT_SECRET || 'development-secret';
    this.connectionManager = new ConnectionManager();

    this.wss = new WSServer({
      port: options.port,
      server: options.server,
      verifyClient: this.verifyClient.bind(this),
    });

    this.setupEventHandlers();
    this.setupPTYHandlers();

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
      const isDev = process.env.NODE_ENV === 'development';

      // In development, allow connections without token or with dev token
      if (isDev && (!token || token === 'dev')) {
        (info.req as any).userId = 'dev-user';
        console.log('[WS] Development mode: allowing connection without auth');
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
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const userId = (req as any).userId;
      console.log(`[WS] New connection from user ${userId}`);

      const connection = this.connectionManager.add(ws, userId);

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
        console.log(`[WS] Connection closed for user ${userId}`);
        this.connectionManager.remove(ws);
      });

      ws.on('error', (error) => {
        console.error(`[WS] Error for user ${userId}:`, error);
        this.connectionManager.remove(ws);
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

    // Verify ownership
    let terminal = await prisma.terminal.findFirst({
      where: isDev ? { id: terminalId } : { id: terminalId, userId },
    });

    // In development, create terminal if it doesn't exist
    if (!terminal && isDev) {
      console.log(`[WS] Dev mode: auto-creating terminal ${terminalId}`);
      // Ensure dev user exists
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

    // Associate connection with terminal
    this.connectionManager.associateTerminal(ws, terminalId);

    const ptyManager = getPTYManager();
    const instance = ptyManager.get(terminalId);

    // Get buffered output if PTY is running
    const bufferedOutput = instance?.outputBuffer.getContents();

    this.send(ws, {
      type: 'terminal.connected',
      terminalId,
      bufferedOutput,
    });

    this.send(ws, {
      type: 'terminal.status',
      terminalId,
      status: (instance?.status || terminal.status) as TerminalStatus,
    });
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
      console.error(`[WS] Failed to start terminal ${terminalId}:`, error);

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
   * Handle terminal stop request
   */
  private async handleTerminalStop(
    ws: WebSocket,
    userId: string,
    terminalId: string
  ): Promise<void> {
    // Verify ownership
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

    const ptyManager = getPTYManager();

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
    if (connection?.terminalId !== terminalId) {
      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: 'Not connected to this terminal',
      });
      return;
    }

    const ptyManager = getPTYManager();
    const instance = ptyManager.get(terminalId);

    if (!instance || instance.userId !== userId) {
      this.send(ws, {
        type: 'terminal.error',
        terminalId,
        error: 'Terminal not running or access denied',
      });
      return;
    }

    ptyManager.write(terminalId, data);

    // Update last active (ignore if terminal was deleted)
    try {
      await prisma.terminal.update({
        where: { id: terminalId },
        data: { lastActiveAt: new Date() },
      });
    } catch (error) {
      // Terminal might have been deleted, ignore
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
    const instance = ptyManager.get(terminalId);

    if (!instance || instance.userId !== userId) {
      return; // Silently ignore if not running
    }

    ptyManager.resize(terminalId, cols, rows);

    // Update dimensions (ignore if terminal was deleted)
    try {
      await prisma.terminal.update({
        where: { id: terminalId },
        data: { cols, rows },
      });
    } catch (error) {
      // Terminal might have been deleted, ignore
    }
  }

  /**
   * Set up PTY event handlers
   */
  private setupPTYHandlers(): void {
    const ptyManager = getPTYManager();

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
    });

    // Handle PTY exit
    ptyManager.on('exit', async (terminalId: string, exitCode: number) => {
      const status =
        exitCode === 0 ? TerminalStatus.STOPPED : TerminalStatus.CRASHED;

      try {
        // Try to update, but the terminal might have been deleted
        await prisma.terminal.update({
          where: { id: terminalId },
          data: { status },
        });
        this.broadcastStatus(terminalId, status);
      } catch (error) {
        // Terminal was likely deleted, ignore the error
        console.log(`[WS] Terminal ${terminalId} no longer exists, skipping status update`);
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
   * Get server stats
   */
  getStats() {
    return this.connectionManager.getStats();
  }

  /**
   * Shutdown the server
   */
  shutdown(): void {
    this.connectionManager.shutdown();
    this.wss.close();
    getPTYManager().shutdown();
  }
}
