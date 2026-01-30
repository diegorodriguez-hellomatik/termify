/**
 * EphemeralTerminalManager
 *
 * Manages ephemeral terminals that exist only in memory.
 * No database records are created - everything is stored in memory
 * and automatically cleaned up when the connection closes.
 */

import { TerminalStatus } from '@prisma/client';
import { DEFAULT_COLS, DEFAULT_ROWS } from '@termify/shared';

export interface EphemeralTerminal {
  id: string;
  userId: string;
  serverId: string;
  type: 'LOCAL' | 'SSH';
  name: string;
  status: TerminalStatus;
  cols: number;
  rows: number;
  createdAt: Date;
  // SSH connection info (for SSH terminals)
  sshHost?: string;
  sshPort?: number;
  sshUsername?: string;
  sshPassword?: string;
  sshPrivateKey?: string;
}

class EphemeralTerminalManager {
  private static instance: EphemeralTerminalManager;
  private terminals: Map<string, EphemeralTerminal> = new Map();

  private constructor() {}

  static getInstance(): EphemeralTerminalManager {
    if (!EphemeralTerminalManager.instance) {
      EphemeralTerminalManager.instance = new EphemeralTerminalManager();
    }
    return EphemeralTerminalManager.instance;
  }

  /**
   * Create a new ephemeral terminal
   */
  create(data: Omit<EphemeralTerminal, 'status' | 'cols' | 'rows' | 'createdAt'>): EphemeralTerminal {
    const terminal: EphemeralTerminal = {
      ...data,
      status: TerminalStatus.STOPPED,
      cols: DEFAULT_COLS,
      rows: DEFAULT_ROWS,
      createdAt: new Date(),
    };

    this.terminals.set(terminal.id, terminal);
    console.log(`[EphemeralManager] Created ephemeral terminal ${terminal.id} for user ${terminal.userId}`);

    return terminal;
  }

  /**
   * Get an ephemeral terminal by ID
   */
  get(id: string): EphemeralTerminal | undefined {
    return this.terminals.get(id);
  }

  /**
   * Check if a terminal exists and belongs to a user
   */
  verifyOwnership(id: string, userId: string): boolean {
    const terminal = this.terminals.get(id);
    return terminal?.userId === userId;
  }

  /**
   * Update terminal status
   */
  updateStatus(id: string, status: TerminalStatus): void {
    const terminal = this.terminals.get(id);
    if (terminal) {
      terminal.status = status;
    }
  }

  /**
   * Delete an ephemeral terminal
   */
  delete(id: string): boolean {
    const existed = this.terminals.has(id);
    this.terminals.delete(id);
    if (existed) {
      console.log(`[EphemeralManager] Deleted ephemeral terminal ${id}`);
    }
    return existed;
  }

  /**
   * Check if a terminal ID is ephemeral
   */
  isEphemeral(id: string): boolean {
    return this.terminals.has(id);
  }

  /**
   * Get all ephemeral terminals for a user (for debugging)
   */
  getByUser(userId: string): EphemeralTerminal[] {
    return Array.from(this.terminals.values()).filter(t => t.userId === userId);
  }

  /**
   * Get count of ephemeral terminals (for monitoring)
   */
  getCount(): number {
    return this.terminals.size;
  }

  /**
   * Get count of active ephemeral terminals for a specific server
   */
  getCountByServer(serverId: string): number {
    let count = 0;
    for (const terminal of this.terminals.values()) {
      if (terminal.serverId === serverId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get all ephemeral terminals for a specific server
   */
  getByServer(serverId: string): EphemeralTerminal[] {
    return Array.from(this.terminals.values()).filter(t => t.serverId === serverId);
  }

  /**
   * Get counts of active ephemeral terminals grouped by server ID
   */
  getCountsByServer(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const terminal of this.terminals.values()) {
      const current = counts.get(terminal.serverId) || 0;
      counts.set(terminal.serverId, current + 1);
    }
    return counts;
  }
}

export const ephemeralManager = EphemeralTerminalManager.getInstance();
