const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  token?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string | unknown[];
}

/**
 * Make API request
 */
export async function api<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, token } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return response.json();
}

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; name?: string }) =>
    api<{ user: any; accessToken: string; refreshToken: string }>(
      '/api/auth/register',
      { method: 'POST', body: data }
    ),

  login: (data: { email: string; password: string }) =>
    api<{ user: any; accessToken: string; refreshToken: string }>(
      '/api/auth/login',
      { method: 'POST', body: data }
    ),

  oauth: (data: {
    email: string;
    name?: string;
    image?: string;
    provider: string;
    providerAccountId: string;
  }) =>
    api<{ user: any; accessToken: string; refreshToken: string }>(
      '/api/auth/oauth',
      { method: 'POST', body: data }
    ),

  refresh: (refreshToken: string) =>
    api<{ accessToken: string }>('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    }),

  me: (token: string) =>
    api<{ id: string; email: string; name: string | null }>('/api/auth/me', {
      token,
    }),
};

// SSH Test Connection Response
export interface SSHTestResult {
  connected: boolean;
  serverInfo?: string;
  error?: string;
}

// SSH Terminal Config
export interface SSHConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
}

// Terminals API
export const terminalsApi = {
  list: (token: string) =>
    api<{ terminals: any[]; total: number }>('/api/terminals', { token }),

  get: (id: string, token: string) =>
    api<any>(`/api/terminals/${id}`, { token }),

  create: (
    data: {
      name?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
      categoryId?: string;
      claudeSessionId?: string;
      sshConfig?: {
        host: string;
        port?: number;
        username: string;
        password?: string;
        privateKey?: string;
      };
    },
    token: string
  ) =>
    api<any>('/api/terminals', { method: 'POST', body: data, token }),

  update: (
    id: string,
    data: { name?: string; cols?: number; rows?: number; categoryId?: string | null; position?: number },
    token: string
  ) =>
    api<any>(`/api/terminals/${id}`, { method: 'PATCH', body: data, token }),

  delete: (id: string, token: string) =>
    api<void>(`/api/terminals/${id}`, { method: 'DELETE', token }),

  reorder: (data: { terminalIds: string[] }, token: string) =>
    api<void>('/api/terminals/reorder', { method: 'POST', body: data, token }),

  toggleFavorite: (id: string, isFavorite: boolean, token: string) =>
    api<any>(`/api/terminals/${id}/favorite`, {
      method: 'PATCH',
      body: { isFavorite },
      token,
    }),

  // SSH Methods
  testSSH: (data: SSHConfig, token: string) =>
    api<SSHTestResult>('/api/terminals/ssh/test', {
      method: 'POST',
      body: data,
      token,
    }),

  createSSH: (
    data: {
      name?: string;
      cols?: number;
      rows?: number;
      categoryId?: string;
      host: string;
      port?: number;
      username: string;
      password?: string;
      privateKey?: string;
    },
    token: string
  ) =>
    api<any>('/api/terminals/ssh', { method: 'POST', body: data, token }),
};

// Categories API
export const categoriesApi = {
  list: (token: string) =>
    api<{ categories: any[] }>('/api/categories', { token }),

  create: (data: { name: string; color?: string; icon?: string }, token: string) =>
    api<any>('/api/categories', { method: 'POST', body: data, token }),

  update: (
    id: string,
    data: { name?: string; color?: string; icon?: string; position?: number },
    token: string
  ) =>
    api<any>(`/api/categories/${id}`, { method: 'PATCH', body: data, token }),

  delete: (id: string, token: string) =>
    api<void>(`/api/categories/${id}`, { method: 'DELETE', token }),

  reorder: (data: { categoryIds: string[] }, token: string) =>
    api<void>('/api/categories/reorder', { method: 'POST', body: data, token }),
};

// Snippets API
export interface Snippet {
  id: string;
  name: string;
  command: string;
  description?: string | null;
  category?: string | null;
  tags: string[];
  isFavorite: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export const snippetsApi = {
  list: (token: string, params?: { category?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);
    const query = searchParams.toString();
    return api<{ snippets: Snippet[]; categories: string[]; total: number }>(
      `/api/snippets${query ? `?${query}` : ''}`,
      { token }
    );
  },

  get: (id: string, token: string) =>
    api<Snippet>(`/api/snippets/${id}`, { token }),

  create: (
    data: { name: string; command: string; description?: string; category?: string; tags?: string[] },
    token: string
  ) =>
    api<Snippet>('/api/snippets', { method: 'POST', body: data, token }),

  update: (
    id: string,
    data: { name?: string; command?: string; description?: string | null; category?: string | null; tags?: string[]; isFavorite?: boolean },
    token: string
  ) =>
    api<Snippet>(`/api/snippets/${id}`, { method: 'PATCH', body: data, token }),

  use: (id: string, token: string) =>
    api<Snippet>(`/api/snippets/${id}/use`, { method: 'POST', token }),

  delete: (id: string, token: string) =>
    api<void>(`/api/snippets/${id}`, { method: 'DELETE', token }),
};

// Profiles API
export interface TerminalProfile {
  id: string;
  name: string;
  icon?: string | null;
  color: string;
  description?: string | null;
  cols: number;
  rows: number;
  cwd?: string | null;
  shell?: string | null;
  env?: Record<string, string> | null;
  initCommands: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export const profilesApi = {
  list: (token: string) =>
    api<{ profiles: TerminalProfile[]; total: number }>('/api/profiles', { token }),

  get: (id: string, token: string) =>
    api<TerminalProfile>(`/api/profiles/${id}`, { token }),

  create: (
    data: {
      name: string;
      icon?: string;
      color?: string;
      description?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
      shell?: string;
      env?: Record<string, string>;
      initCommands?: string[];
      isDefault?: boolean;
    },
    token: string
  ) =>
    api<TerminalProfile>('/api/profiles', { method: 'POST', body: data, token }),

  update: (
    id: string,
    data: {
      name?: string;
      icon?: string | null;
      color?: string;
      description?: string | null;
      cols?: number;
      rows?: number;
      cwd?: string | null;
      shell?: string | null;
      env?: Record<string, string> | null;
      initCommands?: string[];
      isDefault?: boolean;
    },
    token: string
  ) =>
    api<TerminalProfile>(`/api/profiles/${id}`, { method: 'PATCH', body: data, token }),

  delete: (id: string, token: string) =>
    api<void>(`/api/profiles/${id}`, { method: 'DELETE', token }),
};

// Audit Logs API
export interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export const auditlogsApi = {
  list: (token: string, params?: { limit?: number; offset?: number; action?: string; resource?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    if (params?.action) searchParams.set('action', params.action);
    if (params?.resource) searchParams.set('resource', params.resource);
    const query = searchParams.toString();
    return api<{ logs: AuditLog[]; total: number; limit: number; offset: number }>(
      `/api/auditlogs${query ? `?${query}` : ''}`,
      { token }
    );
  },

  create: (
    data: { action: string; resource: string; resourceId?: string; details?: Record<string, any> },
    token: string
  ) =>
    api<AuditLog>('/api/auditlogs', { method: 'POST', body: data, token }),

  clear: (token: string) =>
    api<void>('/api/auditlogs', { method: 'DELETE', token }),
};

// API Keys API
export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  key?: string; // Only returned on creation
  permissions: string[];
  lastUsedAt?: string | null;
  usageCount: number;
  expiresAt?: string | null;
  createdAt: string;
}

export const apikeysApi = {
  list: (token: string) =>
    api<{ apiKeys: ApiKey[] }>('/api/apikeys', { token }),

  create: (
    data: { name: string; permissions?: string[]; expiresIn?: number },
    token: string
  ) =>
    api<{ apiKey: ApiKey; warning: string }>('/api/apikeys', { method: 'POST', body: data, token }),

  update: (
    id: string,
    data: { name?: string; permissions?: string[] },
    token: string
  ) =>
    api<{ apiKey: ApiKey }>(`/api/apikeys/${id}`, { method: 'PATCH', body: data, token }),

  revoke: (id: string, token: string) =>
    api<{ message: string }>(`/api/apikeys/${id}`, { method: 'DELETE', token }),
};

// Files API (for terminal file explorer)
export interface FileEntry {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  modifiedAt: string | null;
  extension: string | null;
}

export interface FilesResponse {
  path: string;
  relativePath: string;
  parentPath: string;
  canGoUp: boolean;
  files: FileEntry[];
}

export interface FileContent {
  path: string;
  name: string;
  extension: string;
  size: number;
  isBinary: boolean;
  isTruncated: boolean;
  content: string | null;
  modifiedAt?: string;
  message?: string;
}

export const filesApi = {
  list: (terminalId: string, path: string, token: string) =>
    api<FilesResponse>(`/api/terminals/${terminalId}/files?path=${encodeURIComponent(path)}`, { token }),

  read: (terminalId: string, filePath: string, token: string, maxSize?: number) => {
    const params = new URLSearchParams({ path: filePath });
    if (maxSize) params.set('maxSize', maxSize.toString());
    return api<FileContent>(`/api/terminals/${terminalId}/file?${params}`, { token });
  },

  write: (terminalId: string, filePath: string, content: string, token: string) =>
    api<{ path: string; name: string; size: number; modifiedAt: string }>(
      `/api/terminals/${terminalId}/file`,
      { method: 'PUT', body: { path: filePath, content }, token }
    ),
};

// Share Types
export type ShareType = 'LINK' | 'EMAIL';
export type SharePermission = 'VIEW' | 'CONTROL';

export interface TerminalShare {
  id: string;
  terminalId: string;
  type: ShareType;
  sharedWithId: string | null;
  sharedEmail: string | null;
  shareToken: string | null;
  permission: SharePermission;
  createdById: string;
  expiresAt: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
  createdAt: string;
  sharedWith?: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  } | null;
  createdBy?: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface SharedTerminal {
  id: string;
  name: string;
  status: string;
  type: string;
  cols: number;
  rows: number;
  cwd: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
  } | null;
  share: {
    id: string;
    permission: SharePermission;
    createdBy: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
    };
    createdAt: string;
  };
}

// Sharing API
export const shareApi = {
  // Get all shares for a terminal (owner only)
  getShares: (terminalId: string, token: string) =>
    api<{ shares: TerminalShare[] }>(`/api/terminals/${terminalId}/share`, { token }),

  // Create a share link
  createShareLink: (
    terminalId: string,
    data: { permission?: SharePermission; expiresIn?: number },
    token: string
  ) =>
    api<{ share: TerminalShare; shareUrl: string }>(
      `/api/terminals/${terminalId}/share/link`,
      { method: 'POST', body: data, token }
    ),

  // Share with user by email
  shareWithEmail: (
    terminalId: string,
    data: { email: string; permission?: SharePermission },
    token: string
  ) =>
    api<{ share: TerminalShare }>(
      `/api/terminals/${terminalId}/share/email`,
      { method: 'POST', body: data, token }
    ),

  // Update share permissions
  updateShare: (
    terminalId: string,
    shareId: string,
    data: { permission: SharePermission },
    token: string
  ) =>
    api<{ share: TerminalShare }>(
      `/api/terminals/${terminalId}/share/${shareId}`,
      { method: 'PATCH', body: data, token }
    ),

  // Revoke a share
  deleteShare: (terminalId: string, shareId: string, token: string) =>
    api<void>(`/api/terminals/${terminalId}/share/${shareId}`, {
      method: 'DELETE',
      token,
    }),

  // Access shared terminal by token (public)
  accessByToken: (shareToken: string, token?: string) =>
    api<{
      share: { id: string; permission: SharePermission; type: ShareType };
      terminal: any;
      isAuthenticated: boolean;
    }>(`/api/share/${shareToken}`, { token }),

  // Get terminals shared with me
  getSharedWithMe: (token: string) =>
    api<{ terminals: SharedTerminal[]; total: number }>(
      '/api/terminals/shared',
      { token }
    ),
};

// Notification Types
export type NotificationType = 'TERMINAL_SHARED' | 'TERMINAL_SHARE_REVOKED' | 'TERMINAL_SHARE_UPDATED' | 'SYSTEM';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

// Notifications API
export const notificationsApi = {
  // Get all notifications
  list: (token: string, unreadOnly?: boolean) =>
    api<{ notifications: Notification[]; unreadCount: number }>(
      `/api/notifications${unreadOnly ? '?unread=true' : ''}`,
      { token }
    ),

  // Get unread count only
  getUnreadCount: (token: string) =>
    api<{ unreadCount: number }>('/api/notifications/unread-count', { token }),

  // Mark specific notifications as read
  markAsRead: (notificationIds: string[], token: string) =>
    api<void>('/api/notifications/mark-read', {
      method: 'PATCH',
      body: { notificationIds },
      token,
    }),

  // Mark all notifications as read
  markAllAsRead: (token: string) =>
    api<void>('/api/notifications/mark-all-read', {
      method: 'PATCH',
      token,
    }),

  // Delete a notification
  delete: (id: string, token: string) =>
    api<void>(`/api/notifications/${id}`, {
      method: 'DELETE',
      token,
    }),

  // Delete all notifications
  deleteAll: (token: string) =>
    api<void>('/api/notifications', {
      method: 'DELETE',
      token,
    }),
};

// Claude Sessions API
export interface ClaudeSession {
  id: string;
  projectPath: string;
  projectName: string;
  lastModified: string;
  messageCount: number;
  firstMessage?: string;
  cwd?: string;
}

export interface ClaudeProject {
  path: string;
  name: string;
  sessions: ClaudeSession[];
}

export interface ClaudeSessionsResponse {
  projects: ClaudeProject[];
  totalProjects: number;
  totalSessions: number;
  message?: string;
}

export interface ClaudeSessionDetail {
  id: string;
  projectPath: string;
  projectName: string;
  cwd?: string;
  lastModified: string;
  fileSize: number;
  messageCount: number;
  messages: Array<{
    type: string;
    content: any;
    timestamp: string;
  }>;
}

export const claudeSessionsApi = {
  list: (token: string) =>
    api<ClaudeSessionsResponse>('/api/claude-sessions', { token }),

  listRemote: (
    sshConfig: {
      host: string;
      port?: number;
      username: string;
      password?: string;
      privateKey?: string;
    },
    token: string
  ) =>
    api<ClaudeSessionsResponse>('/api/claude-sessions/remote', {
      method: 'POST',
      body: sshConfig,
      token,
    }),

  get: (projectPath: string, sessionId: string, token: string) =>
    api<ClaudeSessionDetail>(`/api/claude-sessions/${encodeURIComponent(projectPath)}/${sessionId}`, { token }),

  getCurrent: (token: string) =>
    api<ClaudeSession | null>('/api/claude-sessions/current', { token }),
};
