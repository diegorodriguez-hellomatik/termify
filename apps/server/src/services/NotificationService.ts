import { prisma } from '../lib/prisma.js';
import { NotificationType, Prisma } from '@prisma/client';

interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}

export class NotificationService {
  /**
   * Create a notification
   */
  static async create(payload: NotificationPayload) {
    return prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        metadata: payload.metadata ?? undefined,
      },
    });
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
}
