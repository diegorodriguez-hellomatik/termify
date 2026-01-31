import { prisma } from '../lib/prisma.js';
import { NotificationType, Prisma } from '@prisma/client';
import { getWebSocketServer } from '../websocket/WebSocketServer.js';
import { pushService, PushNotificationPayload } from './PushService.js';

interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}

interface NotificationData {
  terminalId?: string;
  teamId?: string;
  taskId?: string;
  [key: string]: unknown;
}

export class NotificationService {
  private static instance: NotificationService;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Create a notification and send it via WebSocket and Push in real-time
   */
  async create(payload: NotificationPayload) {
    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        metadata: payload.metadata ?? undefined,
      },
    });

    // Send real-time notification via WebSocket
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.sendNotificationToUser(payload.userId, notification);
    }

    // Send push notification
    const metadata = payload.metadata as NotificationData | undefined;
    const pushPayload: PushNotificationPayload = {
      title: payload.title,
      body: payload.message,
      data: {
        terminalId: metadata?.terminalId,
        teamId: metadata?.teamId,
        taskId: metadata?.taskId,
      },
    };

    // Add actions for certain notification types
    if (metadata?.terminalId) {
      pushPayload.actions = [
        { action: 'view', title: 'View Terminal' },
      ];
    }

    // Send push notification asynchronously (don't wait)
    pushService.sendToUser(payload.userId, payload.type, pushPayload).catch((err) => {
      console.error('[NotificationService] Failed to send push notification:', err);
    });

    return notification;
  }

  /**
   * Static wrapper for backwards compatibility
   */
  static async create(payload: NotificationPayload) {
    return NotificationService.getInstance().create(payload);
  }

  /**
   * Notify user when a terminal is shared with them
   */
  static async notifyTerminalShared(params: {
    recipientId: string;
    terminalName: string;
    terminalId: string;
    shareId: string;
    sharedByName: string;
    permission: string;
  }) {
    return this.create({
      userId: params.recipientId,
      type: 'TERMINAL_SHARED',
      title: 'Terminal Shared',
      message: `${params.sharedByName} shared the terminal "${params.terminalName}" with you (${params.permission.toLowerCase()} access)`,
      metadata: {
        terminalId: params.terminalId,
        shareId: params.shareId,
        sharedByName: params.sharedByName,
        permission: params.permission,
      } as Prisma.InputJsonValue,
    });
  }

  /**
   * Notify user when terminal share is revoked
   */
  static async notifyShareRevoked(params: {
    recipientId: string;
    terminalName: string;
    terminalId: string;
    revokedByName: string;
  }) {
    return this.create({
      userId: params.recipientId,
      type: 'TERMINAL_SHARE_REVOKED',
      title: 'Share Access Revoked',
      message: `${params.revokedByName} revoked your access to the terminal "${params.terminalName}"`,
      metadata: {
        terminalId: params.terminalId,
        revokedByName: params.revokedByName,
      } as Prisma.InputJsonValue,
    });
  }

  /**
   * Notify user when terminal share permissions are updated
   */
  static async notifyShareUpdated(params: {
    recipientId: string;
    terminalName: string;
    terminalId: string;
    shareId: string;
    updatedByName: string;
    newPermission: string;
  }) {
    return this.create({
      userId: params.recipientId,
      type: 'TERMINAL_SHARE_UPDATED',
      title: 'Share Permissions Updated',
      message: `${params.updatedByName} updated your access to the terminal "${params.terminalName}" to ${params.newPermission.toLowerCase()}`,
      metadata: {
        terminalId: params.terminalId,
        shareId: params.shareId,
        updatedByName: params.updatedByName,
        newPermission: params.newPermission,
      } as Prisma.InputJsonValue,
    });
  }

  /**
   * Send a system notification
   */
  static async notifySystem(params: {
    userId: string;
    title: string;
    message: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.create({
      userId: params.userId,
      type: 'SYSTEM',
      title: params.title,
      message: params.message,
      metadata: params.metadata,
    });
  }

  // ========================
  // Team Notifications
  // ========================

  /**
   * Notify user when invited to a team
   */
  async notifyTeamInvite(userId: string, teamName: string, invitedByName: string, teamId: string) {
    return this.create({
      userId,
      type: 'TEAM_INVITE',
      title: 'Team Invitation',
      message: `${invitedByName} invited you to join the team "${teamName}"`,
      metadata: { teamId, invitedByName } as Prisma.InputJsonValue,
    });
  }

  /**
   * Notify team members when someone joins
   */
  async notifyTeamMemberJoined(userId: string, teamName: string, memberName: string, teamId: string) {
    return this.create({
      userId,
      type: 'TEAM_MEMBER_JOINED',
      title: 'New Team Member',
      message: `${memberName} joined the team "${teamName}"`,
      metadata: { teamId, memberName } as Prisma.InputJsonValue,
    });
  }

  /**
   * Notify user when removed from team or when they leave
   */
  async notifyTeamMemberLeft(userId: string, teamName: string, teamId: string, wasRemoved: boolean) {
    return this.create({
      userId,
      type: 'TEAM_MEMBER_LEFT',
      title: wasRemoved ? 'Removed from Team' : 'Left Team',
      message: wasRemoved
        ? `You have been removed from the team "${teamName}"`
        : `You left the team "${teamName}"`,
      metadata: { teamId, wasRemoved } as Prisma.InputJsonValue,
    });
  }

  /**
   * Notify user when their role changes
   */
  async notifyTeamRoleChanged(userId: string, teamName: string, newRole: string, teamId: string) {
    return this.create({
      userId,
      type: 'TEAM_ROLE_CHANGED',
      title: 'Role Changed',
      message: `Your role in "${teamName}" has been changed to ${newRole.toLowerCase()}`,
      metadata: { teamId, newRole } as Prisma.InputJsonValue,
    });
  }

  // ========================
  // Task Notifications
  // ========================

  /**
   * Notify user when assigned to a task
   */
  async notifyTaskAssigned(userId: string, taskTitle: string, teamId: string, taskId: string) {
    return this.create({
      userId,
      type: 'TASK_ASSIGNED',
      title: 'Task Assigned',
      message: `You have been assigned to the task "${taskTitle}"`,
      metadata: { teamId, taskId } as Prisma.InputJsonValue,
    });
  }

  /**
   * Notify user when unassigned from a task
   */
  async notifyTaskUnassigned(userId: string, taskTitle: string, teamId: string, taskId: string) {
    return this.create({
      userId,
      type: 'TASK_UNASSIGNED',
      title: 'Task Unassigned',
      message: `You have been unassigned from the task "${taskTitle}"`,
      metadata: { teamId, taskId } as Prisma.InputJsonValue,
    });
  }

  /**
   * Notify assignees when task status changes
   */
  async notifyTaskStatusChanged(userId: string, taskTitle: string, newStatus: string, teamId: string, taskId: string) {
    const statusLabels: Record<string, string> = {
      BACKLOG: 'Backlog',
      TODO: 'To Do',
      IN_PROGRESS: 'In Progress',
      IN_REVIEW: 'In Review',
      DONE: 'Done',
    };
    const statusLabel = statusLabels[newStatus] || newStatus;

    return this.create({
      userId,
      type: 'TASK_STATUS_CHANGED',
      title: 'Task Status Changed',
      message: `Task "${taskTitle}" moved to ${statusLabel}`,
      metadata: { teamId, taskId, newStatus } as Prisma.InputJsonValue,
    });
  }

  /**
   * Notify user when task is due soon (within 24 hours)
   */
  async notifyTaskDueSoon(userId: string, taskTitle: string, teamId: string, taskId: string, dueDate: Date) {
    return this.create({
      userId,
      type: 'TASK_DUE_SOON',
      title: 'Task Due Soon',
      message: `Task "${taskTitle}" is due ${dueDate.toLocaleDateString()}`,
      metadata: { teamId, taskId, dueDate: dueDate.toISOString() } as Prisma.InputJsonValue,
    });
  }

  /**
   * Notify user when task is overdue
   */
  async notifyTaskOverdue(userId: string, taskTitle: string, teamId: string, taskId: string) {
    return this.create({
      userId,
      type: 'TASK_OVERDUE',
      title: 'Task Overdue',
      message: `Task "${taskTitle}" is overdue`,
      metadata: { teamId, taskId } as Prisma.InputJsonValue,
    });
  }

  // ========================
  // Terminal Event Notifications (Push-focused)
  // ========================

  /**
   * Notify user when a terminal crashes (non-zero exit code)
   */
  async notifyTerminalCrashed(params: {
    userId: string;
    terminalId: string;
    terminalName: string;
    exitCode: number;
  }) {
    return this.create({
      userId: params.userId,
      type: 'TERMINAL_CRASHED',
      title: 'Terminal Crashed',
      message: `Terminal "${params.terminalName}" exited with code ${params.exitCode}`,
      metadata: {
        terminalId: params.terminalId,
        terminalName: params.terminalName,
        exitCode: params.exitCode,
      } as Prisma.InputJsonValue,
    });
  }

  /**
   * Notify user when an SSH connection fails
   */
  async notifySSHConnectionFailed(params: {
    userId: string;
    terminalId: string;
    terminalName: string;
    host: string;
    error: string;
  }) {
    return this.create({
      userId: params.userId,
      type: 'SSH_CONNECTION_FAILED',
      title: 'SSH Connection Failed',
      message: `Failed to connect to ${params.host}: ${params.error}`,
      metadata: {
        terminalId: params.terminalId,
        terminalName: params.terminalName,
        host: params.host,
        error: params.error,
      } as Prisma.InputJsonValue,
    });
  }

  /**
   * Notify terminal owner when a viewer joins
   */
  async notifyViewerJoined(params: {
    ownerId: string;
    viewerId: string;
    terminalId: string;
    terminalName: string;
    viewerName: string;
    viewerEmail: string;
  }) {
    return this.create({
      userId: params.ownerId,
      type: 'VIEWER_JOINED',
      title: 'Viewer Joined',
      message: `${params.viewerName || params.viewerEmail} joined "${params.terminalName}"`,
      metadata: {
        terminalId: params.terminalId,
        terminalName: params.terminalName,
        viewerId: params.viewerId,
        viewerName: params.viewerName,
        viewerEmail: params.viewerEmail,
      } as Prisma.InputJsonValue,
    });
  }

  /**
   * Notify terminal owner when a viewer leaves
   */
  async notifyViewerLeft(params: {
    ownerId: string;
    viewerId: string;
    terminalId: string;
    terminalName: string;
    viewerName: string;
    viewerEmail: string;
  }) {
    return this.create({
      userId: params.ownerId,
      type: 'VIEWER_LEFT',
      title: 'Viewer Left',
      message: `${params.viewerName || params.viewerEmail} left "${params.terminalName}"`,
      metadata: {
        terminalId: params.terminalId,
        terminalName: params.terminalName,
        viewerId: params.viewerId,
        viewerName: params.viewerName,
        viewerEmail: params.viewerEmail,
      } as Prisma.InputJsonValue,
    });
  }

  /**
   * Notify user when a long-running command completes
   */
  async notifyCommandCompleted(params: {
    userId: string;
    terminalId: string;
    terminalName: string;
    command?: string;
    duration?: number;
  }) {
    const durationText = params.duration
      ? ` after ${Math.round(params.duration / 1000)}s`
      : '';

    return this.create({
      userId: params.userId,
      type: 'COMMAND_COMPLETED',
      title: 'Command Completed',
      message: `Command finished in "${params.terminalName}"${durationText}`,
      metadata: {
        terminalId: params.terminalId,
        terminalName: params.terminalName,
        command: params.command,
        duration: params.duration,
      } as Prisma.InputJsonValue,
    });
  }
}
