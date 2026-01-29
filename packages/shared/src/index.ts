// Terminal Status
export enum TerminalStatus {
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  CRASHED = 'CRASHED',
}

// Share Types
export enum ShareType {
  LINK = 'LINK',
  EMAIL = 'EMAIL',
}

// Share Permissions
export enum SharePermission {
  VIEW = 'VIEW',
  CONTROL = 'CONTROL',
}

// Notification Types
export enum NotificationType {
  TERMINAL_SHARED = 'TERMINAL_SHARED',
  TERMINAL_SHARE_REVOKED = 'TERMINAL_SHARE_REVOKED',
  TERMINAL_SHARE_UPDATED = 'TERMINAL_SHARE_UPDATED',
  SYSTEM = 'SYSTEM',
}

// Notification model
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// Terminal Share model
export interface TerminalShare {
  id: string;
  terminalId: string;
  type: ShareType;
  sharedWithId: string | null;
  sharedEmail: string | null;
  shareToken: string | null;
  permission: SharePermission;
  createdById: string;
  expiresAt: Date | null;
  lastAccessedAt: Date | null;
  accessCount: number;
  createdAt: Date;
}

// Viewer info for real-time presence
export interface TerminalViewer {
  odId: string;
  visitorId: string;
  email: string;
  name: string | null;
  image: string | null;
  permission: SharePermission;
  isOwner: boolean;
}

// Terminal model
export interface Terminal {
  id: string;
  userId: string;
  name: string;
  status: TerminalStatus;
  cols: number;
  rows: number;
  cwd: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// User model
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// WebSocket Messages - Client to Server
export type ClientMessage =
  | { type: 'terminal.connect'; terminalId: string; shareToken?: string }
  | { type: 'terminal.input'; terminalId: string; data: string }
  | { type: 'terminal.resize'; terminalId: string; cols: number; rows: number }
  | { type: 'terminal.start'; terminalId: string }
  | { type: 'terminal.stop'; terminalId: string }
  | { type: 'ping' };

// WebSocket Messages - Server to Client
export type ServerMessage =
  | { type: 'terminal.output'; terminalId: string; data: string }
  | { type: 'terminal.connected'; terminalId: string; bufferedOutput?: string; permission?: SharePermission }
  | { type: 'terminal.status'; terminalId: string; status: TerminalStatus }
  | { type: 'terminal.error'; terminalId: string; error: string }
  | { type: 'terminal.cwd'; terminalId: string; cwd: string }
  | { type: 'terminal.viewers'; terminalId: string; viewers: TerminalViewer[] }
  | { type: 'terminal.viewer.joined'; terminalId: string; viewer: TerminalViewer }
  | { type: 'terminal.viewer.left'; terminalId: string; odId: string }
  | { type: 'files.changed'; terminalId: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };

// API Request/Response types
export interface CreateTerminalRequest {
  name?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
}

export interface UpdateTerminalRequest {
  name?: string;
  cols?: number;
  rows?: number;
}

export interface TerminalListResponse {
  terminals: Terminal[];
  total: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Constants
export const DEFAULT_COLS = 120;
export const DEFAULT_ROWS = 30;
export const MAX_OUTPUT_BUFFER_SIZE = 100 * 1024; // 100KB
export const WS_PING_INTERVAL = 30000; // 30 seconds
export const WS_PONG_TIMEOUT = 10000; // 10 seconds
export const RATE_LIMIT_MESSAGES_PER_MIN = 3000; // ~50 messages/sec for fast typing
