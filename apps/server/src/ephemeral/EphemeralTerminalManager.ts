import { TerminalStatus } from '@termify/shared';

export interface EphemeralTerminal {
  id: string;
  userId: string;
  type: 'LOCAL' | 'SSH';
  status: TerminalStatus;
  cols: number;
  rows: number;
  createdAt: Date;
  // SSH specific
  sshHost?: string;
  sshPort?: number;
  sshUsername?: string;
  sshPassword?: string;
  sshPrivateKey?: string;
}

/**
 * Manages ephemeral (in-memory) terminals that are not persisted to the database.
 * These terminals exist only for the duration of the session and are automatically
 * cleaned up when the connection closes or the server restarts.
 */
class EphemeralTerminalManager {
  private terminals: Map<string, EphemeralTerminal> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Start cleanup interval to remove stale ephemeral terminals
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Create a new ephemeral terminal
   */
  create(options: {
    id: string;
    userId: string;
    type?: 'LOCAL' | 'SSH';
    cols?: number;
    rows?: number;
    sshHost?: string;
    sshPort?: number;
    sshUsername?: string;
    sshPassword?: string;
    sshPrivateKey?: string;
  }): EphemeralTerminal {
    const terminal: EphemeralTerminal = {
      id: options.id,
      userId: options.userId,
      type: options.type || 'LOCAL',
      status: TerminalStatus.STOPPED,
      cols: options.cols || 120,
      rows: options.rows || 30,
      createdAt: new Date(),
      sshHost: options.sshHost,
      sshPort: options.sshPort,
      sshUsername: options.sshUsername,
      sshPassword: options.sshPassword,
      sshPrivateKey: options.sshPrivateKey,
    };

    this.terminals.set(options.id, terminal);
    console.log(`[Ephemeral] Created terminal ${options.id} for user ${options.userId}`);
    return terminal;
  }

  /**
   * Get an ephemeral terminal by ID
   */
  get(terminalId: string): EphemeralTerminal | undefined {
    return this.terminals.get(terminalId);
  }

  /**
   * Check if a terminal ID belongs to an ephemeral terminal
   */
  isEphemeral(terminalId: string): boolean {
    return this.terminals.has(terminalId);
  }

  /**
   * Verify that a user owns an ephemeral terminal
   */
  verifyOwnership(terminalId: string, userId: string): boolean {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return false;
    return terminal.userId === userId;
  }

  /**
   * Update the status of an ephemeral terminal
   */
  updateStatus(terminalId: string, status: TerminalStatus): void {
    const terminal = this.terminals.get(terminalId);
    if (terminal) {
      terminal.status = status;
      console.log(`[Ephemeral] Terminal ${terminalId} status updated to ${status}`);
    }
  }

  /**
   * Update terminal dimensions
   */
  updateDimensions(terminalId: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(terminalId);
    if (terminal) {
      terminal.cols = cols;
      terminal.rows = rows;
    }
  }

  /**
   * Delete an ephemeral terminal
   */
  delete(terminalId: string): boolean {
    const deleted = this.terminals.delete(terminalId);
    if (deleted) {
      console.log(`[Ephemeral] Deleted terminal ${terminalId}`);
    }
    return deleted;
  }

  /**
   * Get all ephemeral terminals for a user
   */
  getByUser(userId: string): EphemeralTerminal[] {
    const userTerminals: EphemeralTerminal[] = [];
    for (const terminal of this.terminals.values()) {
      if (terminal.userId === userId) {
        userTerminals.push(terminal);
      }
    }
    return userTerminals;
  }

  /**
   * Get count of all ephemeral terminals
   */
  get count(): number {
    return this.terminals.size;
  }

  /**
   * Clean up stale ephemeral terminals
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, terminal] of this.terminals.entries()) {
      const age = now - terminal.createdAt.getTime();
      if (age > this.MAX_AGE_MS) {
        this.terminals.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Ephemeral] Cleaned up ${cleaned} stale terminals`);
    }
  }

  /**
   * Shutdown the manager
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.terminals.clear();
    console.log('[Ephemeral] Manager shutdown');
  }
}

// Export singleton instance
export const ephemeralManager = new EphemeralTerminalManager();
