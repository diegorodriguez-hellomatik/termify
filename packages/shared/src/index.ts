// Terminal Status
export enum TerminalStatus {
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  CRASHED = 'CRASHED',
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
  | { type: 'terminal.connect'; terminalId: string }
  | { type: 'terminal.input'; terminalId: string; data: string }
  | { type: 'terminal.resize'; terminalId: string; cols: number; rows: number }
  | { type: 'terminal.start'; terminalId: string }
  | { type: 'terminal.stop'; terminalId: string }
  | { type: 'ping' };

// WebSocket Messages - Server to Client
export type ServerMessage =
  | { type: 'terminal.output'; terminalId: string; data: string }
  | { type: 'terminal.connected'; terminalId: string; bufferedOutput?: string }
  | { type: 'terminal.status'; terminalId: string; status: TerminalStatus }
  | { type: 'terminal.error'; terminalId: string; error: string }
  | { type: 'terminal.cwd'; terminalId: string; cwd: string }
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
