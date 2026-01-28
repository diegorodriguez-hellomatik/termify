import WebSocket from 'ws';
import {
  RATE_LIMIT_MESSAGES_PER_MIN,
  WS_PING_INTERVAL,
  WS_PONG_TIMEOUT,
} from '@claude-terminal/shared';

export interface Connection {
  ws: WebSocket;
  userId: string;
  terminalId: string | null;
  isAlive: boolean;
  messageCount: number;
  lastMessageReset: number;
}

/**
 * Manages WebSocket connections with rate limiting and health checks
 */
export class ConnectionManager {
  private connections: Map<WebSocket, Connection> = new Map();
  private userConnections: Map<string, Set<WebSocket>> = new Map();
  private terminalConnections: Map<string, Set<WebSocket>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startPingInterval();
  }

  /**
   * Add a new connection
   */
  add(ws: WebSocket, userId: string): Connection {
    const connection: Connection = {
      ws,
      userId,
      terminalId: null,
      isAlive: true,
      messageCount: 0,
      lastMessageReset: Date.now(),
    };

    this.connections.set(ws, connection);

    // Track by user
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(ws);

    return connection;
  }

  /**
   * Remove a connection
   */
  remove(ws: WebSocket): void {
    const connection = this.connections.get(ws);
    if (!connection) return;

    // Remove from user tracking
    const userSockets = this.userConnections.get(connection.userId);
    if (userSockets) {
      userSockets.delete(ws);
      if (userSockets.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    // Remove from terminal tracking
    if (connection.terminalId) {
      const terminalSockets = this.terminalConnections.get(connection.terminalId);
      if (terminalSockets) {
        terminalSockets.delete(ws);
        if (terminalSockets.size === 0) {
          this.terminalConnections.delete(connection.terminalId);
        }
      }
    }

    this.connections.delete(ws);
  }

  /**
   * Get a connection by WebSocket
   */
  get(ws: WebSocket): Connection | undefined {
    return this.connections.get(ws);
  }

  /**
   * Associate a connection with a terminal
   */
  associateTerminal(ws: WebSocket, terminalId: string): void {
    const connection = this.connections.get(ws);
    if (!connection) return;

    // Remove from previous terminal if any
    if (connection.terminalId) {
      const prevSockets = this.terminalConnections.get(connection.terminalId);
      if (prevSockets) {
        prevSockets.delete(ws);
        if (prevSockets.size === 0) {
          this.terminalConnections.delete(connection.terminalId);
        }
      }
    }

    // Associate with new terminal
    connection.terminalId = terminalId;
    if (!this.terminalConnections.has(terminalId)) {
      this.terminalConnections.set(terminalId, new Set());
    }
    this.terminalConnections.get(terminalId)!.add(ws);
  }

  /**
   * Get all connections for a terminal
   */
  getTerminalConnections(terminalId: string): WebSocket[] {
    const sockets = this.terminalConnections.get(terminalId);
    return sockets ? Array.from(sockets) : [];
  }

  /**
   * Get all connections for a user
   */
  getUserConnections(userId: string): WebSocket[] {
    const sockets = this.userConnections.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  /**
   * Check rate limit for a connection
   */
  checkRateLimit(ws: WebSocket): boolean {
    const connection = this.connections.get(ws);
    if (!connection) return false;

    const now = Date.now();

    // Reset counter every minute
    if (now - connection.lastMessageReset > 60000) {
      connection.messageCount = 0;
      connection.lastMessageReset = now;
    }

    connection.messageCount++;
    return connection.messageCount <= RATE_LIMIT_MESSAGES_PER_MIN;
  }

  /**
   * Broadcast to all connections for a terminal
   */
  broadcastToTerminal(terminalId: string, message: string): void {
    const sockets = this.terminalConnections.get(terminalId);
    if (!sockets) return;

    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  /**
   * Send message to a specific connection
   */
  send(ws: WebSocket, message: object): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start ping interval to detect dead connections
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      for (const [ws, connection] of this.connections) {
        if (!connection.isAlive) {
          console.log(`[WS] Terminating dead connection for user ${connection.userId}`);
          ws.terminate();
          this.remove(ws);
          continue;
        }

        connection.isAlive = false;
        ws.ping();
      }
    }, WS_PING_INTERVAL);
  }

  /**
   * Mark connection as alive (on pong received)
   */
  markAlive(ws: WebSocket): void {
    const connection = this.connections.get(ws);
    if (connection) {
      connection.isAlive = true;
    }
  }

  /**
   * Get connection stats
   */
  getStats(): {
    totalConnections: number;
    uniqueUsers: number;
    activeTerminals: number;
  } {
    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.userConnections.size,
      activeTerminals: this.terminalConnections.size,
    };
  }

  /**
   * Shutdown - clean up all connections
   */
  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    for (const ws of this.connections.keys()) {
      ws.close(1001, 'Server shutting down');
    }

    this.connections.clear();
    this.userConnections.clear();
    this.terminalConnections.clear();
  }
}
