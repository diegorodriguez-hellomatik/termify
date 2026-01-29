import { prisma } from '../lib/prisma.js';
import { CursorPosition, CollaborativeMessage, TeamPresence, User } from '@termify/shared';
import { mapCollaborativeMessage } from '../lib/type-mappers.js';

/**
 * Service for managing collaborative features
 * - Remote cursors
 * - Terminal chat
 * - Follow mode
 * - Scroll sync
 * - Team presence
 */
export class CollaborationService {
  private static instance: CollaborationService;

  // In-memory cursor positions (terminalId -> odId -> position)
  private cursors: Map<string, Map<string, CursorPosition>> = new Map();

  // In-memory follow relationships (followerId -> targetId)
  private followers: Map<string, string> = new Map();

  // In-memory team presence (teamId -> userId -> presence)
  private teamPresence: Map<string, Map<string, TeamPresence>> = new Map();

  private constructor() {}

  static getInstance(): CollaborationService {
    if (!CollaborationService.instance) {
      CollaborationService.instance = new CollaborationService();
    }
    return CollaborationService.instance;
  }

  // ========================
  // Cursor Management
  // ========================

  /**
   * Update cursor position for a user in a terminal
   */
  updateCursor(
    terminalId: string,
    odId: string,
    userId: string,
    userName: string,
    userImage: string | null,
    x: number,
    y: number,
    scrollTop: number
  ): CursorPosition {
    if (!this.cursors.has(terminalId)) {
      this.cursors.set(terminalId, new Map());
    }

    const cursor: CursorPosition = {
      odId,
      visitorId: odId,
      userId,
      userName,
      userImage,
      x,
      y,
      scrollTop,
    };

    this.cursors.get(terminalId)!.set(odId, cursor);
    return cursor;
  }

  /**
   * Remove cursor when user disconnects
   */
  removeCursor(terminalId: string, odId: string): void {
    const terminalCursors = this.cursors.get(terminalId);
    if (terminalCursors) {
      terminalCursors.delete(odId);
      if (terminalCursors.size === 0) {
        this.cursors.delete(terminalId);
      }
    }
  }

  /**
   * Get all cursors for a terminal
   */
  getCursors(terminalId: string): CursorPosition[] {
    const terminalCursors = this.cursors.get(terminalId);
    return terminalCursors ? Array.from(terminalCursors.values()) : [];
  }

  /**
   * Clear all cursors for a terminal
   */
  clearTerminalCursors(terminalId: string): void {
    this.cursors.delete(terminalId);
  }

  // ========================
  // Chat Management
  // ========================

  /**
   * Save a chat message
   */
  async saveMessage(
    terminalId: string,
    userId: string,
    content: string
  ): Promise<CollaborativeMessage> {
    const message = await prisma.collaborativeMessage.create({
      data: {
        terminalId,
        userId,
        content,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
    });

    return mapCollaborativeMessage(message);
  }

  /**
   * Get chat history for a terminal
   */
  async getChatHistory(
    terminalId: string,
    limit: number = 50
  ): Promise<CollaborativeMessage[]> {
    const messages = await prisma.collaborativeMessage.findMany({
      where: { terminalId },
      include: {
        user: {
          select: { id: true, email: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Reverse to get chronological order
    return messages.reverse().map((m) => mapCollaborativeMessage(m));
  }

  // ========================
  // Follow Mode
  // ========================

  /**
   * Start following a user
   */
  startFollowing(followerId: string, targetId: string): void {
    this.followers.set(followerId, targetId);
  }

  /**
   * Stop following
   */
  stopFollowing(followerId: string): void {
    this.followers.delete(followerId);
  }

  /**
   * Get who a user is following
   */
  getFollowTarget(followerId: string): string | undefined {
    return this.followers.get(followerId);
  }

  /**
   * Get all followers of a user
   */
  getFollowers(targetId: string): string[] {
    const followers: string[] = [];
    for (const [followerId, target] of this.followers) {
      if (target === targetId) {
        followers.push(followerId);
      }
    }
    return followers;
  }

  // ========================
  // Team Presence
  // ========================

  /**
   * Update user presence in a team
   */
  updatePresence(
    teamId: string,
    userId: string,
    userName: string,
    userImage: string | null,
    status: 'online' | 'away' | 'busy',
    activeTerminalId: string | null
  ): TeamPresence {
    if (!this.teamPresence.has(teamId)) {
      this.teamPresence.set(teamId, new Map());
    }

    const presence: TeamPresence = {
      userId,
      userName,
      userImage,
      status,
      activeTerminalId,
      lastActivityAt: new Date(),
    };

    this.teamPresence.get(teamId)!.set(userId, presence);
    return presence;
  }

  /**
   * Remove user presence when they go offline
   */
  removePresence(teamId: string, userId: string): void {
    const teamPres = this.teamPresence.get(teamId);
    if (teamPres) {
      teamPres.delete(userId);
      if (teamPres.size === 0) {
        this.teamPresence.delete(teamId);
      }
    }
  }

  /**
   * Get all presence for a team
   */
  getTeamPresence(teamId: string): TeamPresence[] {
    const teamPres = this.teamPresence.get(teamId);
    return teamPres ? Array.from(teamPres.values()) : [];
  }

  /**
   * Get presence for a specific user in a team
   */
  getUserPresence(teamId: string, userId: string): TeamPresence | undefined {
    return this.teamPresence.get(teamId)?.get(userId);
  }

  /**
   * Remove all presence for a user (called when they disconnect)
   */
  removeAllUserPresence(userId: string): string[] {
    const affectedTeams: string[] = [];

    for (const [teamId, teamPres] of this.teamPresence) {
      if (teamPres.has(userId)) {
        teamPres.delete(userId);
        affectedTeams.push(teamId);

        if (teamPres.size === 0) {
          this.teamPresence.delete(teamId);
        }
      }
    }

    return affectedTeams;
  }

  // ========================
  // Command History
  // ========================

  /**
   * Log command execution for team history
   */
  async logTeamCommand(
    teamId: string,
    userId: string,
    terminalId: string,
    command: string,
    exitCode?: number,
    duration?: number
  ): Promise<void> {
    await prisma.teamCommandHistory.create({
      data: {
        teamId,
        userId,
        terminalId,
        command,
        exitCode,
        duration,
      },
    });
  }

  // ========================
  // Cleanup
  // ========================

  /**
   * Clean up all data for a terminal
   */
  cleanupTerminal(terminalId: string): void {
    this.clearTerminalCursors(terminalId);
  }

  /**
   * Clean up all data for a user
   */
  cleanupUser(odId: string, userId: string): void {
    // Remove cursors from all terminals
    for (const [terminalId, cursors] of this.cursors) {
      cursors.delete(odId);
      if (cursors.size === 0) {
        this.cursors.delete(terminalId);
      }
    }

    // Stop following
    this.stopFollowing(odId);

    // Remove as target (stop others from following)
    for (const [followerId, target] of this.followers) {
      if (target === odId) {
        this.followers.delete(followerId);
      }
    }

    // Remove presence from all teams
    this.removeAllUserPresence(userId);
  }

  /**
   * Get stats for debugging
   */
  getStats(): {
    terminalCursors: number;
    followers: number;
    teamsWithPresence: number;
    totalPresence: number;
  } {
    let totalPresence = 0;
    for (const teamPres of this.teamPresence.values()) {
      totalPresence += teamPres.size;
    }

    return {
      terminalCursors: this.cursors.size,
      followers: this.followers.size,
      teamsWithPresence: this.teamPresence.size,
      totalPresence,
    };
  }
}

export const collaborationService = CollaborationService.getInstance();
