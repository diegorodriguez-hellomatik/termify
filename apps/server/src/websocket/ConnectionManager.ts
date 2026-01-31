import WebSocket from 'ws';
import {
  RATE_LIMIT_MESSAGES_PER_MIN,
  WS_PING_INTERVAL,
  WS_PONG_TIMEOUT,
  SharePermission,
} from '@termify/shared';

export interface Connection {
  ws: WebSocket;
  odId: string;
  visitorId: string;
  userId: string;
  email: string;
  name: string | null;
  image: string | null;
  terminalId: string | null;
  permission: SharePermission | null;
  isOwner: boolean;
  isAlive: boolean;
  messageCount: number;
  lastMessageReset: number;
  teamSubscriptions: Set<string>;
  serverSubscriptions: Set<string>;
  workspaceSubscriptions: Set<string>;
}

/**
 * Manages WebSocket connections with rate limiting and health checks
 */
export class ConnectionManager {
  private connections: Map<WebSocket, Connection> = new Map();
  private userConnections: Map<string, Set<WebSocket>> = new Map();
  private terminalConnections: Map<string, Set<WebSocket>> = new Map();
  private teamConnections: Map<string, Set<WebSocket>> = new Map();
  private serverConnections: Map<string, Set<WebSocket>> = new Map();
  private workspaceConnections: Map<string, Set<WebSocket>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startPingInterval();
  }

  /**
   * Add a new connection
   */
  add(ws: WebSocket, userId: string, userInfo?: { email: string; name: string | null; image: string | null }): Connection {
    const visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const connection: Connection = {
      ws,
      odId: visitorId,
      visitorId,
      userId,
      email: userInfo?.email || 'anonymous',
      name: userInfo?.name || null,
      image: userInfo?.image || null,
      terminalId: null,
      permission: null,
      isOwner: false,
      isAlive: true,
      messageCount: 0,
      lastMessageReset: Date.now(),
      teamSubscriptions: new Set(),
      serverSubscriptions: new Set(),
      workspaceSubscriptions: new Set(),
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

    // Remove from team tracking
    for (const teamId of connection.teamSubscriptions) {
      const teamSockets = this.teamConnections.get(teamId);
      if (teamSockets) {
        teamSockets.delete(ws);
        if (teamSockets.size === 0) {
          this.teamConnections.delete(teamId);
        }
      }
    }

    // Remove from server tracking
    for (const serverId of connection.serverSubscriptions) {
      const serverSockets = this.serverConnections.get(serverId);
      if (serverSockets) {
        serverSockets.delete(ws);
        if (serverSockets.size === 0) {
          this.serverConnections.delete(serverId);
        }
      }
    }

    // Remove from workspace tracking
    for (const workspaceId of connection.workspaceSubscriptions) {
      const workspaceSockets = this.workspaceConnections.get(workspaceId);
      if (workspaceSockets) {
        workspaceSockets.delete(ws);
        if (workspaceSockets.size === 0) {
          this.workspaceConnections.delete(workspaceId);
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
  associateTerminal(ws: WebSocket, terminalId: string, options?: { permission: SharePermission | null; isOwner: boolean }): void {
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
    connection.permission = options?.permission ?? null;
    connection.isOwner = options?.isOwner ?? false;
    if (!this.terminalConnections.has(terminalId)) {
      this.terminalConnections.set(terminalId, new Set());
    }
    this.terminalConnections.get(terminalId)!.add(ws);
  }

  /**
   * Get viewers for a terminal (connections with their user info)
   */
  getTerminalViewers(terminalId: string): Array<{
    odId: string;
    visitorId: string;
    email: string;
    name: string | null;
    image: string | null;
    permission: SharePermission | null;
    isOwner: boolean;
  }> {
    const sockets = this.terminalConnections.get(terminalId);
    if (!sockets) return [];

    const viewers: Array<{
      odId: string;
      visitorId: string;
      email: string;
      name: string | null;
      image: string | null;
      permission: SharePermission | null;
      isOwner: boolean;
    }> = [];

    for (const ws of sockets) {
      const conn = this.connections.get(ws);
      if (conn) {
        viewers.push({
          odId: conn.odId,
          visitorId: conn.visitorId,
          email: conn.email,
          name: conn.name,
          image: conn.image,
          permission: conn.permission,
          isOwner: conn.isOwner,
        });
      }
    }

    return viewers;
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
   * Subscribe a connection to a team
   */
  subscribeToTeam(ws: WebSocket, teamId: string): void {
    const connection = this.connections.get(ws);
    if (!connection) return;

    connection.teamSubscriptions.add(teamId);

    if (!this.teamConnections.has(teamId)) {
      this.teamConnections.set(teamId, new Set());
    }
    this.teamConnections.get(teamId)!.add(ws);
  }

  /**
   * Unsubscribe a connection from a team
   */
  unsubscribeFromTeam(ws: WebSocket, teamId: string): void {
    const connection = this.connections.get(ws);
    if (!connection) return;

    connection.teamSubscriptions.delete(teamId);

    const teamSockets = this.teamConnections.get(teamId);
    if (teamSockets) {
      teamSockets.delete(ws);
      if (teamSockets.size === 0) {
        this.teamConnections.delete(teamId);
      }
    }
  }

  /**
   * Broadcast to all connections subscribed to a team
   */
  broadcastToTeam(teamId: string, message: string): void {
    const sockets = this.teamConnections.get(teamId);
    if (!sockets) return;

    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  /**
   * Subscribe a connection to server stats
   */
  subscribeToServer(ws: WebSocket, serverId: string): void {
    const connection = this.connections.get(ws);
    if (!connection) return;

    connection.serverSubscriptions.add(serverId);

    if (!this.serverConnections.has(serverId)) {
      this.serverConnections.set(serverId, new Set());
    }
    this.serverConnections.get(serverId)!.add(ws);
  }

  /**
   * Unsubscribe a connection from server stats
   */
  unsubscribeFromServer(ws: WebSocket, serverId: string): void {
    const connection = this.connections.get(ws);
    if (!connection) return;

    connection.serverSubscriptions.delete(serverId);

    const serverSockets = this.serverConnections.get(serverId);
    if (serverSockets) {
      serverSockets.delete(ws);
      if (serverSockets.size === 0) {
        this.serverConnections.delete(serverId);
      }
    }
  }

  /**
   * Get all connections subscribed to a server
   */
  getServerSubscribers(serverId: string): WebSocket[] {
    const sockets = this.serverConnections.get(serverId);
    return sockets ? Array.from(sockets) : [];
  }

  /**
   * Subscribe a connection to a workspace
   */
  subscribeToWorkspace(ws: WebSocket, workspaceId: string): void {
    const connection = this.connections.get(ws);
    if (!connection) {
      console.log('[CM] subscribeToWorkspace: connection not found');
      return;
    }

    connection.workspaceSubscriptions.add(workspaceId);

    if (!this.workspaceConnections.has(workspaceId)) {
      this.workspaceConnections.set(workspaceId, new Set());
    }
    this.workspaceConnections.get(workspaceId)!.add(ws);

    console.log('[CM] subscribeToWorkspace:', {
      workspaceId,
      userId: connection.userId,
      totalSubscribers: this.workspaceConnections.get(workspaceId)!.size,
    });
  }

  /**
   * Unsubscribe a connection from a workspace
   */
  unsubscribeFromWorkspace(ws: WebSocket, workspaceId: string): void {
    const connection = this.connections.get(ws);
    if (!connection) return;

    connection.workspaceSubscriptions.delete(workspaceId);

    const workspaceSockets = this.workspaceConnections.get(workspaceId);
    if (workspaceSockets) {
      workspaceSockets.delete(ws);
      if (workspaceSockets.size === 0) {
        this.workspaceConnections.delete(workspaceId);
      }
    }
  }

  /**
   * Broadcast to all connections subscribed to a workspace
   */
  broadcastToWorkspace(workspaceId: string, message: string): void {
    const sockets = this.workspaceConnections.get(workspaceId);
    console.log('[CM] broadcastToWorkspace:', {
      workspaceId,
      subscriberCount: sockets?.size ?? 0,
      hasSubscribers: !!sockets,
    });

    if (!sockets) return;

    let sentCount = 0;
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sentCount++;
      }
    }
    console.log('[CM] broadcastToWorkspace sent to', sentCount, 'sockets');
  }

  /**
   * Get user IDs of all connections subscribed to a team
   */
  getTeamSubscriberUserIds(teamId: string): string[] {
    const sockets = this.teamConnections.get(teamId);
    if (!sockets) return [];

    const userIds = new Set<string>();
    for (const ws of sockets) {
      const conn = this.connections.get(ws);
      if (conn) {
        userIds.add(conn.userId);
      }
    }

    return Array.from(userIds);
  }

  /**
   * Get online members for a team
   */
  getTeamOnlineMembers(teamId: string): Array<{
    odId: string;
    visitorId: string;
    userId: string;
    email: string;
    name: string | null;
    image: string | null;
  }> {
    const sockets = this.teamConnections.get(teamId);
    if (!sockets) return [];

    const members: Array<{
      odId: string;
      visitorId: string;
      userId: string;
      email: string;
      name: string | null;
      image: string | null;
    }> = [];

    // Deduplicate by userId
    const seenUserIds = new Set<string>();
    for (const ws of sockets) {
      const conn = this.connections.get(ws);
      if (conn && !seenUserIds.has(conn.userId)) {
        seenUserIds.add(conn.userId);
        members.push({
          odId: conn.odId,
          visitorId: conn.visitorId,
          userId: conn.userId,
          email: conn.email,
          name: conn.name,
          image: conn.image,
        });
      }
    }

    return members;
  }

  /**
   * Get online users for a workspace
   */
  getWorkspaceOnlineUsers(workspaceId: string): Array<{
    odId: string;
    visitorId: string;
    userId: string;
    email: string;
    name: string | null;
    image: string | null;
  }> {
    const sockets = this.workspaceConnections.get(workspaceId);
    if (!sockets) return [];

    const users: Array<{
      odId: string;
      visitorId: string;
      userId: string;
      email: string;
      name: string | null;
      image: string | null;
    }> = [];

    // Deduplicate by userId
    const seenUserIds = new Set<string>();
    for (const ws of sockets) {
      const conn = this.connections.get(ws);
      if (conn && !seenUserIds.has(conn.userId)) {
        seenUserIds.add(conn.userId);
        users.push({
          odId: conn.odId,
          visitorId: conn.visitorId,
          userId: conn.userId,
          email: conn.email,
          name: conn.name,
          image: conn.image,
        });
      }
    }

    return users;
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
   * Send message to all connections of a user
   */
  sendToUser(userId: string, message: object): void {
    const sockets = this.userConnections.get(userId);
    if (!sockets) return;

    const messageStr = JSON.stringify(message);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
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
    activeTeams: number;
    activeServers: number;
    activeWorkspaces: number;
  } {
    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.userConnections.size,
      activeTerminals: this.terminalConnections.size,
      activeTeams: this.teamConnections.size,
      activeServers: this.serverConnections.size,
      activeWorkspaces: this.workspaceConnections.size,
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
    this.teamConnections.clear();
    this.serverConnections.clear();
    this.workspaceConnections.clear();
  }
}
