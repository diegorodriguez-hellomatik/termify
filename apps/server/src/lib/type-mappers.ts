/**
 * Type mappers to convert Prisma types to shared types
 *
 * Prisma generates nominal enum types that are incompatible with our shared enums,
 * even though they have the same values. These mappers use type assertions to
 * bridge the gap.
 */

import type {
  User as SharedUser,
  TeamServer as SharedTeamServer,
  TeamSnippet as SharedTeamSnippet,
  TeamTerminalShare as SharedTeamTerminalShare,
  TeamCommandHistory as SharedTeamCommandHistory,
  TeamAuditLog as SharedTeamAuditLog,
  CollaborativeMessage as SharedCollaborativeMessage,
  Workspace as SharedWorkspace,
  Terminal as SharedTerminal,
  ServerAuthMethod,
  ServerStatus,
  SharePermission,
  TerminalStatus,
  WorkspaceLayout,
  WorkspaceSettings,
} from '@termify/shared';

// User mapper - handles the optional createdAt/updatedAt
export function mapUser(prismaUser: {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}): Omit<SharedUser, 'createdAt' | 'updatedAt'> & { createdAt?: Date; updatedAt?: Date } {
  return {
    id: prismaUser.id,
    email: prismaUser.email,
    name: prismaUser.name,
    image: prismaUser.image,
  };
}

// Server mapper
export function mapTeamServer(server: {
  id: string;
  teamId: string;
  createdById: string;
  name: string;
  host: string;
  port: number;
  username: string | null;
  authMethod: string;
  description: string | null;
  documentation: string | null;
  tags: string[];
  lastStatus: string | null;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { id: string; email: string; name: string | null; image: string | null };
}): SharedTeamServer {
  return {
    id: server.id,
    teamId: server.teamId,
    createdById: server.createdById,
    name: server.name,
    host: server.host,
    port: server.port,
    username: server.username,
    authMethod: server.authMethod as ServerAuthMethod,
    description: server.description,
    documentation: server.documentation,
    tags: server.tags,
    lastStatus: server.lastStatus as ServerStatus | null,
    lastCheckedAt: server.lastCheckedAt,
    createdBy: server.createdBy ? mapUser(server.createdBy) as SharedUser : undefined,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
  };
}

// Snippet mapper
export function mapTeamSnippet(snippet: {
  id: string;
  teamId: string;
  createdById: string;
  name: string;
  command: string;
  description: string | null;
  category: string | null;
  tags: string[];
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { id: string; email: string; name: string | null; image: string | null };
}): SharedTeamSnippet {
  return {
    id: snippet.id,
    teamId: snippet.teamId,
    createdById: snippet.createdById,
    name: snippet.name,
    command: snippet.command,
    description: snippet.description,
    category: snippet.category,
    tags: snippet.tags,
    usageCount: snippet.usageCount,
    createdBy: snippet.createdBy ? mapUser(snippet.createdBy) as SharedUser : undefined,
    createdAt: snippet.createdAt,
    updatedAt: snippet.updatedAt,
  };
}

// Terminal share mapper
export function mapTeamTerminalShare(share: {
  id: string;
  terminalId: string;
  teamId: string;
  permission: string;
  createdAt: Date;
  terminal?: {
    id: string;
    name: string;
    status: string;
    type?: string;
    cols?: number;
    rows?: number;
  };
}): SharedTeamTerminalShare {
  return {
    id: share.id,
    terminalId: share.terminalId,
    teamId: share.teamId,
    permission: share.permission as SharePermission,
    terminal: share.terminal ? {
      id: share.terminal.id,
      userId: '',
      name: share.terminal.name,
      status: share.terminal.status as TerminalStatus,
      cols: share.terminal.cols ?? 120,
      rows: share.terminal.rows ?? 30,
      cwd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } : undefined,
    createdAt: share.createdAt,
  };
}

// Command history mapper
export function mapTeamCommandHistory(history: {
  id: string;
  teamId: string;
  userId: string;
  terminalId: string;
  command: string;
  exitCode: number | null;
  duration: number | null;
  createdAt: Date;
  user?: { id: string; email: string; name: string | null; image: string | null };
}): SharedTeamCommandHistory {
  return {
    id: history.id,
    teamId: history.teamId,
    userId: history.userId,
    terminalId: history.terminalId,
    command: history.command,
    exitCode: history.exitCode,
    duration: history.duration,
    user: history.user ? mapUser(history.user) as SharedUser : undefined,
    createdAt: history.createdAt,
  };
}

// Audit log mapper
export function mapTeamAuditLog(log: {
  id: string;
  teamId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: unknown;
  createdAt: Date;
  user?: { id: string; email: string; name: string | null; image: string | null };
}): SharedTeamAuditLog {
  return {
    id: log.id,
    teamId: log.teamId,
    userId: log.userId,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    details: log.details as Record<string, unknown> | null,
    user: log.user ? mapUser(log.user) as SharedUser : undefined,
    createdAt: log.createdAt,
  };
}

// Collaborative message mapper
export function mapCollaborativeMessage(message: {
  id: string;
  terminalId: string;
  userId: string;
  content: string;
  createdAt: Date;
  user?: { id: string; email: string; name: string | null; image: string | null };
}): SharedCollaborativeMessage {
  return {
    id: message.id,
    terminalId: message.terminalId,
    userId: message.userId,
    content: message.content,
    user: message.user ? mapUser(message.user) as SharedUser : undefined,
    createdAt: message.createdAt,
  };
}

// Workspace mapper
export function mapWorkspace(workspace: {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  position: number;
  layout: unknown;
  settings: unknown;
  createdAt: Date;
  updatedAt: Date;
}): SharedWorkspace {
  return {
    id: workspace.id,
    userId: workspace.userId,
    name: workspace.name,
    description: workspace.description,
    color: workspace.color,
    icon: workspace.icon,
    isDefault: workspace.isDefault,
    position: workspace.position,
    layout: workspace.layout as WorkspaceLayout | null,
    settings: workspace.settings as WorkspaceSettings | null,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}
