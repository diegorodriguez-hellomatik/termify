const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Users API (avatar upload, profile)
export const usersApi = {
  // Upload avatar (multipart/form-data)
  uploadAvatar: async (file: File, token: string) => {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetch(`${API_URL}/api/users/avatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    return response.json() as Promise<ApiResponse<{ image: string; user: any }>>;
  },

  // Delete avatar
  deleteAvatar: (token: string) =>
    api<{ message: string }>('/api/users/avatar', {
      method: 'DELETE',
      token,
    }),

  // Update profile
  updateProfile: (data: { name?: string }, token: string) =>
    api<{ user: any }>('/api/users/profile', {
      method: 'PATCH',
      body: data,
      token,
    }),

  // Get current user
  getMe: (token: string) =>
    api<{ user: { id: string; email: string; name: string | null; image: string | null; createdAt: string } }>(
      '/api/users/me',
      { token }
    ),
};

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
    api<{ user: any; accessToken: string; refreshToken: string; message?: string }>(
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
    api<{ id: string; email: string; name: string | null; emailVerified: string | null }>('/api/auth/me', {
      token,
    }),

  forgotPassword: (email: string) =>
    api<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
    }),

  resetPassword: (token: string, password: string) =>
    api<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: { token, password },
    }),

  verifyEmail: (token: string) =>
    api<{ message: string; alreadyVerified?: boolean }>('/api/auth/verify-email', {
      method: 'POST',
      body: { token },
    }),

  resendVerification: (email: string) =>
    api<{ message: string; alreadyVerified?: boolean }>('/api/auth/resend-verification', {
      method: 'POST',
      body: { email },
    }),

  changePassword: (currentPassword: string, newPassword: string, token: string) =>
    api<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
      token,
    }),

  changeEmail: (newEmail: string, password: string, token: string) =>
    api<{ message: string }>('/api/auth/change-email', {
      method: 'POST',
      body: { newEmail, password },
      token,
    }),

  confirmEmailChange: (token: string) =>
    api<{ message: string; newEmail: string }>('/api/auth/confirm-email-change', {
      method: 'POST',
      body: { token },
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
    data: { name?: string; cols?: number; rows?: number; cwd?: string; categoryId?: string },
    token: string
  ) =>
    api<any>('/api/terminals', { method: 'POST', body: data, token }),

  update: (
    id: string,
    data: {
      name?: string;
      cols?: number;
      rows?: number;
      categoryId?: string | null;
      position?: number;
      // Display settings
      fontSize?: number | null;
      fontFamily?: string | null;
      theme?: string | null;
    },
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

// Workspace Share Types
export interface WorkspaceShare {
  id: string;
  workspaceId: string;
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

export interface SharedWorkspace {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  terminalCount: number;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
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

// Workspace Sharing API
export const workspaceShareApi = {
  // Get all shares for a workspace (owner only)
  getShares: (workspaceId: string, token: string) =>
    api<{ shares: WorkspaceShare[] }>(`/api/workspaces/${workspaceId}/share`, { token }),

  // Create a share link
  createShareLink: (
    workspaceId: string,
    data: { permission?: SharePermission; expiresIn?: number },
    token: string
  ) =>
    api<{ share: WorkspaceShare; shareUrl: string }>(
      `/api/workspaces/${workspaceId}/share/link`,
      { method: 'POST', body: data, token }
    ),

  // Share with user by email
  shareWithEmail: (
    workspaceId: string,
    data: { email: string; permission?: SharePermission },
    token: string
  ) =>
    api<{ share: WorkspaceShare }>(
      `/api/workspaces/${workspaceId}/share/email`,
      { method: 'POST', body: data, token }
    ),

  // Update share permissions
  updateShare: (
    workspaceId: string,
    shareId: string,
    data: { permission: SharePermission },
    token: string
  ) =>
    api<{ share: WorkspaceShare }>(
      `/api/workspaces/${workspaceId}/share/${shareId}`,
      { method: 'PATCH', body: data, token }
    ),

  // Revoke a share
  deleteShare: (workspaceId: string, shareId: string, token: string) =>
    api<void>(`/api/workspaces/${workspaceId}/share/${shareId}`, {
      method: 'DELETE',
      token,
    }),

  // Access shared workspace by token (public)
  accessByToken: (shareToken: string, token?: string) =>
    api<{
      share: { id: string; permission: SharePermission; type: ShareType };
      workspace: {
        id: string;
        name: string;
        description: string | null;
        color: string | null;
        icon: string | null;
        layout: any | null;
        floatingLayout: any | null;
        settings: any | null;
        user: {
          id: string;
          email: string;
          name: string | null;
          image: string | null;
        };
        terminals: Array<{
          id: string;
          name: string;
          status: string;
          type: string;
          cols: number;
          rows: number;
          cwd: string | null;
          isFavorite: boolean;
          lastActiveAt: string | null;
          position: number;
        }>;
        terminalCount: number;
      };
      isAuthenticated: boolean;
    }>(`/api/share/workspace/${shareToken}`, { token }),

  // Get workspaces shared with me
  getSharedWithMe: (token: string) =>
    api<{ workspaces: SharedWorkspace[]; total: number }>(
      '/api/workspaces/shared',
      { token }
    ),
};

// Workspace Types
export interface WorkspaceSettings {
  theme?: string;
  defaultCols?: number;
  defaultRows?: number;
  activeTerminalId?: string;
}

export interface WorkspaceLayout {
  id: string;
  type: 'terminal' | 'file' | 'split';
  terminalId?: string;
  filePath?: string;
  fileName?: string;
  fileExtension?: string;
  direction?: 'horizontal' | 'vertical';
  children?: WorkspaceLayout[];
  sizes?: number[];
}

// Floating window position for Windows-style layout
export interface FloatingWindowPosition {
  terminalId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isCustomized: boolean;
}

// Layout mode and floating window positions
export interface FloatingLayout {
  mode: 'split' | 'floating';
  windows?: FloatingWindowPosition[];
}

export interface Workspace {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  isDefault: boolean;
  position: number;
  layout?: WorkspaceLayout | null;
  floatingLayout?: FloatingLayout | null;
  settings?: WorkspaceSettings | null;
  terminalCount: number;
  terminals?: WorkspaceTerminalItem[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceTerminalItem {
  id: string;
  name: string;
  status: string;
  type: string;
  cols: number;
  rows: number;
  cwd: string | null;
  isFavorite: boolean;
  position: number;
  lastActiveAt: string | null;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  // Display settings
  fontSize: number | null;
  fontFamily: string | null;
  theme: string | null;
}

// Workspaces API
export const workspacesApi = {
  list: (token: string) =>
    api<{ workspaces: Workspace[] }>('/api/workspaces', { token }),

  get: (id: string, token: string) =>
    api<Workspace>(`/api/workspaces/${id}`, { token }),

  create: (
    data: {
      name: string;
      description?: string;
      color?: string;
      icon?: string;
      isDefault?: boolean;
    },
    token: string
  ) =>
    api<Workspace>('/api/workspaces', { method: 'POST', body: data, token }),

  update: (
    id: string,
    data: {
      name?: string;
      description?: string | null;
      color?: string | null;
      icon?: string | null;
      isDefault?: boolean;
      position?: number;
      layout?: WorkspaceLayout | null;
      floatingLayout?: FloatingLayout | null;
      settings?: WorkspaceSettings | null;
    },
    token: string
  ) =>
    api<Workspace>(`/api/workspaces/${id}`, { method: 'PATCH', body: data, token }),

  delete: (id: string, token: string) =>
    api<void>(`/api/workspaces/${id}`, { method: 'DELETE', token }),

  reorder: (data: { workspaceIds: string[] }, token: string) =>
    api<void>('/api/workspaces/reorder', { method: 'POST', body: data, token }),

  // Terminal management within workspace
  addTerminal: (
    workspaceId: string,
    data: { terminalId: string; position?: number },
    token: string
  ) =>
    api<void>(`/api/workspaces/${workspaceId}/terminals`, {
      method: 'POST',
      body: data,
      token,
    }),

  removeTerminal: (workspaceId: string, terminalId: string, token: string) =>
    api<void>(`/api/workspaces/${workspaceId}/terminals/${terminalId}`, {
      method: 'DELETE',
      token,
    }),

  reorderTerminals: (
    workspaceId: string,
    data: { terminalIds: string[] },
    token: string
  ) =>
    api<void>(`/api/workspaces/${workspaceId}/terminals/reorder`, {
      method: 'POST',
      body: data,
      token,
    }),
};

// Team Types
export type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER';
// TaskStatus is now a custom string (status key from TaskStatusConfig)
// Default values: 'backlog', 'todo', 'in_progress', 'in_review', 'done'
export type TaskStatus = string;
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// TaskStatusConfig - Custom task status configuration
export interface TaskStatusConfig {
  id: string;
  userId?: string | null;
  teamId?: string | null;
  key: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  image: string | null;
  role: TeamRole;
  memberCount: number;
  taskCount: number;
  members?: TeamMember[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  role: TeamRole;
  customRoleId?: string | null;
  customRole?: TeamCustomRole | null;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: string;
}

// Team Permissions
export enum TeamPermission {
  // Terminals
  CREATE_TERMINAL = 'create_terminal',
  EDIT_TERMINAL = 'edit_terminal',
  DELETE_TERMINAL = 'delete_terminal',
  SHARE_TERMINAL = 'share_terminal',
  // Workspaces
  CREATE_WORKSPACE = 'create_workspace',
  EDIT_WORKSPACE = 'edit_workspace',
  DELETE_WORKSPACE = 'delete_workspace',
  // Snippets
  CREATE_SNIPPET = 'create_snippet',
  EDIT_SNIPPET = 'edit_snippet',
  DELETE_SNIPPET = 'delete_snippet',
  // Servers
  CREATE_SERVER = 'create_server',
  EDIT_SERVER = 'edit_server',
  DELETE_SERVER = 'delete_server',
  // Members
  INVITE_MEMBER = 'invite_member',
  REMOVE_MEMBER = 'remove_member',
  CHANGE_MEMBER_ROLE = 'change_member_role',
  // Tasks
  CREATE_TASK = 'create_task',
  EDIT_TASK = 'edit_task',
  DELETE_TASK = 'delete_task',
  ASSIGN_TASK = 'assign_task',
  // Team Settings
  EDIT_TEAM_SETTINGS = 'edit_team_settings',
  MANAGE_ROLES = 'manage_roles',
  VIEW_AUDIT_LOG = 'view_audit_log',
  VIEW_HISTORY = 'view_history',
}

export interface TeamCustomRole {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  color: string;
  permissions: string[];
  position: number;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  teamId: string;
  createdById: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  dueDate: string | null;
  createdBy?: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  assignees?: TaskAssignee[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssignee {
  id: string;
  taskId: string;
  teamMemberId: string;
  teamMember?: {
    id: string;
    userId: string;
    role: TeamRole;
    user?: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
    };
  };
  createdAt: string;
}

// Teams API
export const teamsApi = {
  list: (token: string) =>
    api<{ teams: Team[] }>('/api/teams', { token }),

  get: (id: string, token: string) =>
    api<Team>(`/api/teams/${id}`, { token }),

  create: (
    data: { name: string; description?: string; color?: string; icon?: string; image?: string },
    token: string
  ) =>
    api<Team>('/api/teams', { method: 'POST', body: data, token }),

  update: (
    id: string,
    data: { name?: string; description?: string | null; color?: string; icon?: string | null; image?: string | null },
    token: string
  ) =>
    api<Team>(`/api/teams/${id}`, { method: 'PATCH', body: data, token }),

  uploadImage: async (id: string, file: File, token: string): Promise<ApiResponse<{ url: string }>> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/api/teams/${id}/image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();
    return data;
  },

  delete: (id: string, token: string) =>
    api<void>(`/api/teams/${id}`, { method: 'DELETE', token }),

  invite: (
    id: string,
    data: { email: string; role?: 'ADMIN' | 'MEMBER' },
    token: string
  ) =>
    api<TeamMember>(`/api/teams/${id}/invite`, { method: 'POST', body: data, token }),

  updateMemberRole: (
    teamId: string,
    memberId: string,
    data: { role: 'ADMIN' | 'MEMBER' },
    token: string
  ) =>
    api<TeamMember>(`/api/teams/${teamId}/members/${memberId}/role`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  removeMember: (teamId: string, memberId: string, token: string) =>
    api<void>(`/api/teams/${teamId}/members/${memberId}`, {
      method: 'DELETE',
      token,
    }),
};

// Team Roles API
export const teamRolesApi = {
  list: (teamId: string, token: string) =>
    api<{ roles: TeamCustomRole[] }>(`/api/teams/${teamId}/roles`, { token }),

  get: (teamId: string, roleId: string, token: string) =>
    api<TeamCustomRole>(`/api/teams/${teamId}/roles/${roleId}`, { token }),

  create: (
    teamId: string,
    data: {
      name: string;
      description?: string;
      color?: string;
      permissions: string[];
    },
    token: string
  ) =>
    api<TeamCustomRole>(`/api/teams/${teamId}/roles`, {
      method: 'POST',
      body: data,
      token,
    }),

  update: (
    teamId: string,
    roleId: string,
    data: {
      name?: string;
      description?: string | null;
      color?: string;
      permissions?: string[];
      position?: number;
    },
    token: string
  ) =>
    api<TeamCustomRole>(`/api/teams/${teamId}/roles/${roleId}`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  delete: (teamId: string, roleId: string, token: string) =>
    api<void>(`/api/teams/${teamId}/roles/${roleId}`, {
      method: 'DELETE',
      token,
    }),

  assignToMember: (
    teamId: string,
    memberId: string,
    data: { customRoleId: string | null },
    token: string
  ) =>
    api<TeamMember>(`/api/teams/${teamId}/members/${memberId}/custom-role`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  getMemberPermissions: (teamId: string, memberId: string, token: string) =>
    api<{ permissions: string[] }>(
      `/api/teams/${teamId}/members/${memberId}/permissions`,
      { token }
    ),
};

// Tasks API
export const tasksApi = {
  list: (teamId: string, token: string) =>
    api<{ tasks: Task[] }>(`/api/tasks?teamId=${teamId}`, { token }),

  get: (id: string, token: string) =>
    api<Task>(`/api/tasks/${id}`, { token }),

  create: (
    data: {
      teamId: string;
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      dueDate?: string;
      assigneeIds?: string[];
    },
    token: string
  ) =>
    api<Task>('/api/tasks', { method: 'POST', body: data, token }),

  update: (
    id: string,
    data: {
      title?: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      position?: number;
      dueDate?: string | null;
    },
    token: string
  ) =>
    api<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: data, token }),

  delete: (id: string, token: string) =>
    api<void>(`/api/tasks/${id}`, { method: 'DELETE', token }),

  assign: (taskId: string, teamMemberId: string, token: string) =>
    api<TaskAssignee>(`/api/tasks/${taskId}/assign`, {
      method: 'POST',
      body: { teamMemberId },
      token,
    }),

  unassign: (taskId: string, assigneeId: string, token: string) =>
    api<void>(`/api/tasks/${taskId}/assign/${assigneeId}`, {
      method: 'DELETE',
      token,
    }),

  reorder: (
    data: { taskIds: string[]; status: TaskStatus },
    token: string
  ) =>
    api<void>('/api/tasks/reorder', { method: 'POST', body: data, token }),
};

// Notification Types
export type NotificationType =
  | 'TERMINAL_SHARED'
  | 'TERMINAL_SHARE_REVOKED'
  | 'TERMINAL_SHARE_UPDATED'
  | 'SYSTEM'
  | 'TEAM_INVITE'
  | 'TEAM_MEMBER_JOINED'
  | 'TEAM_MEMBER_LEFT'
  | 'TEAM_ROLE_CHANGED'
  | 'TASK_ASSIGNED'
  | 'TASK_UNASSIGNED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_DUE_SOON'
  | 'TASK_OVERDUE'
  // Push notification events
  | 'TERMINAL_CRASHED'
  | 'SSH_CONNECTION_FAILED'
  | 'VIEWER_JOINED'
  | 'VIEWER_LEFT'
  | 'COMMAND_COMPLETED';

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

// Push Subscription Types
export interface PushPreferences {
  terminalCrashed: boolean;
  sshConnectionFailed: boolean;
  viewerActivity: boolean;
  commandCompleted: boolean;
  shareNotifications: boolean;
}

export interface PushSubscriptionInfo {
  id: string;
  endpoint: string;
  userAgent: string | null;
  preferences: PushPreferences;
  createdAt: string;
  updatedAt: string;
}

// Push Notifications API
export const pushApi = {
  // Get VAPID public key
  getVapidPublicKey: () =>
    api<{ publicKey: string }>('/api/push/vapid-public-key'),

  // Subscribe to push notifications
  subscribe: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    token: string
  ) =>
    api<{ id: string; preferences: PushPreferences }>('/api/push/subscribe', {
      method: 'POST',
      body: subscription,
      token,
    }),

  // Unsubscribe from push notifications
  unsubscribe: (endpoint: string, token: string) =>
    api<{ removed: boolean }>('/api/push/unsubscribe', {
      method: 'DELETE',
      body: { endpoint },
      token,
    }),

  // Get all subscriptions for current user
  getSubscriptions: (token: string) =>
    api<{ subscriptions: PushSubscriptionInfo[] }>('/api/push/subscriptions', {
      token,
    }),

  // Update notification preferences
  updatePreferences: (
    endpoint: string,
    preferences: Partial<PushPreferences>,
    token: string
  ) =>
    api<{ preferences: PushPreferences }>('/api/push/preferences', {
      method: 'PATCH',
      body: { endpoint, preferences },
      token,
    }),

  // Send test notification
  sendTest: (token: string) =>
    api<{ sent: number; failed: number; message: string }>('/api/push/test', {
      method: 'POST',
      token,
    }),
};

// ========================
// Personal Servers Types
// ========================

export type ServerAuthMethod = 'PASSWORD' | 'KEY' | 'AGENT';
export type ServerStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string | null;
  authMethod: ServerAuthMethod;
  description: string | null;
  documentation: string | null;
  tags: string[];
  lastStatus: ServerStatus | null;
  lastCheckedAt: string | null;
  isDefault: boolean;
  projectCount?: number;
  connectionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServerConnection {
  id: string;
  terminalId: string | null;
  success: boolean;
  error: string | null;
  createdAt: string;
}

export interface ServerDetails extends Server {
  projects: {
    id: string;
    name: string;
    status: string;
    workingDirectory: string;
    createdAt: string;
  }[];
  connections: ServerConnection[];
}

// Personal Servers API
export const serversApi = {
  list: (token: string) =>
    api<{ servers: Server[]; total: number }>('/api/servers', { token }),

  get: (id: string, token: string) =>
    api<ServerDetails>(`/api/servers/${id}`, { token }),

  create: (
    data: {
      name: string;
      host: string;
      port?: number;
      username: string;
      authMethod?: ServerAuthMethod;
      password?: string;
      privateKey?: string;
      description?: string;
      documentation?: string;
      tags?: string[];
    },
    token: string
  ) =>
    api<Server>('/api/servers', { method: 'POST', body: data, token }),

  update: (
    id: string,
    data: {
      name?: string;
      host?: string;
      port?: number;
      username?: string;
      authMethod?: ServerAuthMethod;
      password?: string | null;
      privateKey?: string | null;
      description?: string | null;
      documentation?: string | null;
      tags?: string[];
    },
    token: string
  ) =>
    api<Server>(`/api/servers/${id}`, { method: 'PATCH', body: data, token }),

  delete: (id: string, token: string) =>
    api<void>(`/api/servers/${id}`, { method: 'DELETE', token }),

  test: (id: string, token: string) =>
    api<{
      connected: boolean;
      serverInfo?: string;
      error?: string;
      status: ServerStatus;
      checkedAt: string;
    }>(`/api/servers/${id}/test`, { method: 'POST', token }),

  testConnection: (
    data: {
      host: string;
      port?: number;
      username: string;
      password?: string;
      privateKey?: string;
    },
    token: string
  ) =>
    api<{
      connected: boolean;
      serverInfo?: string;
      error?: string;
    }>('/api/servers/test', { method: 'POST', body: data, token }),

  connect: (
    id: string,
    data: { name?: string; password?: string; privateKey?: string },
    token: string
  ) =>
    api<{
      terminal: {
        id: string;
        name: string;
        type: string;
        status: string;
        sshHost?: string;
        sshPort?: number;
        sshUsername?: string;
        createdAt: string;
      };
    }>(`/api/servers/${id}/connect`, { method: 'POST', body: data, token }),

  getConnections: (id: string, token: string) =>
    api<{ connections: ServerConnection[]; total: number }>(
      `/api/servers/${id}/connections`,
      { token }
    ),
};

// ========================
// Team Collaboration Types
// ========================

export interface TeamTerminalShare {
  id: string;
  terminalId: string;
  permission: SharePermission;
  terminal: {
    id: string;
    name: string;
    status: string;
    type: string;
    cols: number;
    rows: number;
    cwd: string | null;
    isFavorite: boolean;
    lastActiveAt: string | null;
    owner: {
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
    createdAt: string;
    updatedAt: string;
  };
  createdAt: string;
}

export interface TeamSnippet {
  id: string;
  name: string;
  command: string;
  description: string | null;
  category: string | null;
  tags: string[];
  usageCount: number;
  createdBy: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TeamEnvVariable {
  id: string;
  name: string;
  value: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamServer {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string | null;
  authMethod: ServerAuthMethod;
  description: string | null;
  documentation: string | null;
  tags: string[];
  lastStatus: ServerStatus | null;
  lastCheckedAt: string | null;
  createdBy: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TeamCommandHistory {
  id: string;
  command: string;
  exitCode: number | null;
  duration: number | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  terminal: {
    id: string;
    name: string;
    type: string;
  };
  createdAt: string;
}

export interface TeamAuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  createdAt: string;
}

export interface TeamPresence {
  userId: string;
  userName: string;
  userImage: string | null;
  status: 'online' | 'away' | 'busy';
  activeTerminalId: string | null;
  lastActivityAt: string;
}

export interface TeamNotificationPrefs {
  terminalErrors: boolean;
  longCommands: boolean;
  longCommandThreshold: number;
  taskMentions: boolean;
  serverStatus: boolean;
}

export interface TaskCommand {
  id: string;
  command: string;
  description: string | null;
  position: number;
  isCompleted: boolean;
  completedAt: string | null;
  exitCode: number | null;
  createdAt: string;
  updatedAt: string;
}

// ========================
// Team Terminals API
// ========================

export const teamTerminalsApi = {
  list: (teamId: string, token: string) =>
    api<{ terminals: TeamTerminalShare[]; total: number }>(
      `/api/teams/${teamId}/terminals`,
      { token }
    ),

  share: (
    teamId: string,
    data: { terminalId: string; permission?: SharePermission },
    token: string
  ) =>
    api<TeamTerminalShare>(`/api/teams/${teamId}/terminals`, {
      method: 'POST',
      body: data,
      token,
    }),

  updatePermission: (
    teamId: string,
    terminalId: string,
    data: { permission: SharePermission },
    token: string
  ) =>
    api<TeamTerminalShare>(`/api/teams/${teamId}/terminals/${terminalId}`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  remove: (teamId: string, terminalId: string, token: string) =>
    api<void>(`/api/teams/${teamId}/terminals/${terminalId}`, {
      method: 'DELETE',
      token,
    }),

  create: (
    teamId: string,
    data: {
      name: string;
      type?: 'LOCAL' | 'SSH';
      cols?: number;
      rows?: number;
      cwd?: string;
      categoryId?: string;
      sshHost?: string;
      sshPort?: number;
      sshUsername?: string;
    },
    token: string
  ) =>
    api<TeamTerminalShare>(`/api/teams/${teamId}/terminals/create`, {
      method: 'POST',
      body: data,
      token,
    }),
};

// ========================
// Team Workspaces API
// ========================

export interface TeamWorkspace {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  isTeamDefault: boolean;
  position: number;
  layout: WorkspaceLayout | null;
  settings: WorkspaceSettings | null;
  owner: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  terminalCount: number;
  terminals: {
    id: string;
    name: string;
    status: string;
    type: string;
    position: number;
  }[];
  createdAt: string;
  updatedAt: string;
}

export const teamWorkspacesApi = {
  list: (teamId: string, token: string) =>
    api<{ workspaces: TeamWorkspace[]; total: number }>(
      `/api/teams/${teamId}/workspaces`,
      { token }
    ),

  share: (
    teamId: string,
    data: { workspaceId: string; isTeamDefault?: boolean },
    token: string
  ) =>
    api<TeamWorkspace>(`/api/teams/${teamId}/workspaces`, {
      method: 'POST',
      body: data,
      token,
    }),

  update: (
    teamId: string,
    workspaceId: string,
    data: { layout?: WorkspaceLayout | null; isTeamDefault?: boolean },
    token: string
  ) =>
    api<TeamWorkspace>(`/api/teams/${teamId}/workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  remove: (teamId: string, workspaceId: string, token: string) =>
    api<void>(`/api/teams/${teamId}/workspaces/${workspaceId}`, {
      method: 'DELETE',
      token,
    }),
};

// ========================
// Team Snippets API
// ========================

export const teamSnippetsApi = {
  list: (teamId: string, token: string, params?: { category?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);
    const query = searchParams.toString();
    return api<{ snippets: TeamSnippet[]; categories: string[]; total: number }>(
      `/api/teams/${teamId}/snippets${query ? `?${query}` : ''}`,
      { token }
    );
  },

  create: (
    teamId: string,
    data: {
      name: string;
      command: string;
      description?: string;
      category?: string;
      tags?: string[];
    },
    token: string
  ) =>
    api<TeamSnippet>(`/api/teams/${teamId}/snippets`, {
      method: 'POST',
      body: data,
      token,
    }),

  update: (
    teamId: string,
    snippetId: string,
    data: {
      name?: string;
      command?: string;
      description?: string | null;
      category?: string | null;
      tags?: string[];
    },
    token: string
  ) =>
    api<TeamSnippet>(`/api/teams/${teamId}/snippets/${snippetId}`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  delete: (teamId: string, snippetId: string, token: string) =>
    api<void>(`/api/teams/${teamId}/snippets/${snippetId}`, {
      method: 'DELETE',
      token,
    }),

  use: (teamId: string, snippetId: string, token: string) =>
    api<{ id: string; usageCount: number }>(`/api/teams/${teamId}/snippets/${snippetId}/use`, {
      method: 'POST',
      token,
    }),
};

// ========================
// Team Env Variables API
// ========================

export const teamEnvVariablesApi = {
  list: (teamId: string, token: string) =>
    api<{ envVariables: TeamEnvVariable[]; total: number }>(
      `/api/teams/${teamId}/env-variables`,
      { token }
    ),

  create: (
    teamId: string,
    data: { name: string; value: string; isSecret?: boolean },
    token: string
  ) =>
    api<TeamEnvVariable>(`/api/teams/${teamId}/env-variables`, {
      method: 'POST',
      body: data,
      token,
    }),

  update: (
    teamId: string,
    envVarId: string,
    data: { value?: string; isSecret?: boolean },
    token: string
  ) =>
    api<TeamEnvVariable>(`/api/teams/${teamId}/env-variables/${envVarId}`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  delete: (teamId: string, envVarId: string, token: string) =>
    api<void>(`/api/teams/${teamId}/env-variables/${envVarId}`, {
      method: 'DELETE',
      token,
    }),

  getValue: (teamId: string, envVarId: string, token: string) =>
    api<{ id: string; name: string; value: string }>(
      `/api/teams/${teamId}/env-variables/${envVarId}/value`,
      { token }
    ),
};

// ========================
// Team Servers API
// ========================

export const teamServersApi = {
  list: (teamId: string, token: string) =>
    api<{ servers: TeamServer[]; total: number }>(
      `/api/teams/${teamId}/servers`,
      { token }
    ),

  get: (teamId: string, serverId: string, token: string) =>
    api<TeamServer>(`/api/teams/${teamId}/servers/${serverId}`, { token }),

  create: (
    teamId: string,
    data: {
      name: string;
      host: string;
      port?: number;
      username?: string;
      authMethod?: ServerAuthMethod;
      description?: string;
      documentation?: string;
      tags?: string[];
    },
    token: string
  ) =>
    api<TeamServer>(`/api/teams/${teamId}/servers`, {
      method: 'POST',
      body: data,
      token,
    }),

  update: (
    teamId: string,
    serverId: string,
    data: {
      name?: string;
      host?: string;
      port?: number;
      username?: string;
      authMethod?: ServerAuthMethod;
      description?: string | null;
      documentation?: string | null;
      tags?: string[];
    },
    token: string
  ) =>
    api<TeamServer>(`/api/teams/${teamId}/servers/${serverId}`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  delete: (teamId: string, serverId: string, token: string) =>
    api<void>(`/api/teams/${teamId}/servers/${serverId}`, {
      method: 'DELETE',
      token,
    }),

  check: (teamId: string, serverId: string, token: string) =>
    api<{
      connected: boolean;
      serverInfo?: string;
      error?: string;
      status: ServerStatus;
      checkedAt: string;
    }>(`/api/teams/${teamId}/servers/${serverId}/check`, {
      method: 'POST',
      token,
    }),

  connect: (
    teamId: string,
    serverId: string,
    data: { password?: string; privateKey?: string },
    token: string
  ) =>
    api<{ terminalId: string; terminalName: string }>(
      `/api/teams/${teamId}/servers/${serverId}/connect`,
      { method: 'POST', body: data, token }
    ),
};

// ========================
// Team History API
// ========================

export const teamHistoryApi = {
  list: (
    teamId: string,
    token: string,
    params?: {
      search?: string;
      userId?: string;
      terminalId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.userId) searchParams.set('userId', params.userId);
    if (params?.terminalId) searchParams.set('terminalId', params.terminalId);
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return api<{
      history: TeamCommandHistory[];
      total: number;
      limit: number;
      offset: number;
    }>(`/api/teams/${teamId}/history${query ? `?${query}` : ''}`, { token });
  },

  stats: (teamId: string, token: string) =>
    api<{
      totalCommands: number;
      commandsByUser: { user: any; count: number }[];
      activityLast24h: number;
    }>(`/api/teams/${teamId}/history/stats`, { token }),
};

// ========================
// Team Audit Logs API
// ========================

export const teamAuditLogsApi = {
  list: (
    teamId: string,
    token: string,
    params?: {
      action?: string;
      resource?: string;
      userId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.action) searchParams.set('action', params.action);
    if (params?.resource) searchParams.set('resource', params.resource);
    if (params?.userId) searchParams.set('userId', params.userId);
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    return api<{
      logs: TeamAuditLog[];
      total: number;
      limit: number;
      offset: number;
    }>(`/api/teams/${teamId}/audit-logs${query ? `?${query}` : ''}`, { token });
  },

  actions: (teamId: string, token: string) =>
    api<{ actions: string[] }>(`/api/teams/${teamId}/audit-logs/actions`, { token }),
};

// ========================
// Team Presence API
// ========================

export const teamPresenceApi = {
  get: (teamId: string, token: string) =>
    api<{
      presence: TeamPresence[];
      onlineCount: number;
      stats: {
        memberCount: number;
        activeTasks: number;
        activeTerminals: number;
        commandsLast24h: number;
      };
    }>(`/api/teams/${teamId}/presence`, { token }),

  getNotificationPrefs: (teamId: string, token: string) =>
    api<TeamNotificationPrefs>(`/api/teams/${teamId}/notification-prefs`, { token }),

  updateNotificationPrefs: (
    teamId: string,
    data: Partial<TeamNotificationPrefs>,
    token: string
  ) =>
    api<TeamNotificationPrefs>(`/api/teams/${teamId}/notification-prefs`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  activity: (teamId: string, token: string, limit?: number) =>
    api<{ activities: TeamAuditLog[] }>(
      `/api/teams/${teamId}/activity${limit ? `?limit=${limit}` : ''}`,
      { token }
    ),
};

// ========================
// Task Commands API
// ========================

export const taskCommandsApi = {
  list: (taskId: string, token: string) =>
    api<{ commands: TaskCommand[]; total: number }>(
      `/api/tasks/${taskId}/commands`,
      { token }
    ),

  create: (
    taskId: string,
    data: { command: string; description?: string; position?: number },
    token: string
  ) =>
    api<TaskCommand>(`/api/tasks/${taskId}/commands`, {
      method: 'POST',
      body: data,
      token,
    }),

  update: (
    taskId: string,
    commandId: string,
    data: {
      command?: string;
      description?: string | null;
      position?: number;
      isCompleted?: boolean;
    },
    token: string
  ) =>
    api<TaskCommand>(`/api/tasks/${taskId}/commands/${commandId}`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  delete: (taskId: string, commandId: string, token: string) =>
    api<void>(`/api/tasks/${taskId}/commands/${commandId}`, {
      method: 'DELETE',
      token,
    }),

  execute: (taskId: string, commandId: string, exitCode: number, token: string) =>
    api<TaskCommand>(`/api/tasks/${taskId}/commands/${commandId}/execute`, {
      method: 'POST',
      body: { exitCode },
      token,
    }),

  reorder: (taskId: string, commandIds: string[], token: string) =>
    api<void>(`/api/tasks/${taskId}/commands/reorder`, {
      method: 'POST',
      body: { commandIds },
      token,
    }),
};

// ========================
// Personal Tasks
// ========================

export interface PersonalTask {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  dueDate: string | null;
  workspaceId: string | null;
  commands: string | null; // JSON array of commands
  terminalQueueId: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const personalTasksApi = {
  list: (token: string, workspaceId?: string | null) => {
    const params = new URLSearchParams();
    if (workspaceId !== undefined) {
      params.set('workspaceId', workspaceId === null ? 'null' : workspaceId);
    }
    const query = params.toString();
    return api<{ tasks: PersonalTask[] }>(
      `/api/personal-tasks${query ? `?${query}` : ''}`,
      { token }
    );
  },

  get: (id: string, token: string) =>
    api<PersonalTask>(`/api/personal-tasks/${id}`, { token }),

  create: (
    data: {
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      dueDate?: string | null;
      workspaceId?: string | null;
      commands?: string[] | null;
    },
    token: string
  ) =>
    api<PersonalTask>('/api/personal-tasks', { method: 'POST', body: data, token }),

  update: (
    id: string,
    data: {
      title?: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      position?: number;
      dueDate?: string | null;
      workspaceId?: string | null;
      commands?: string[] | null;
    },
    token: string
  ) =>
    api<PersonalTask>(`/api/personal-tasks/${id}`, { method: 'PATCH', body: data, token }),

  delete: (id: string, token: string) =>
    api<void>(`/api/personal-tasks/${id}`, { method: 'DELETE', token }),

  reorder: (
    data: { taskIds: string[]; status: TaskStatus },
    token: string
  ) =>
    api<void>('/api/personal-tasks/reorder', { method: 'POST', body: data, token }),

  execute: (
    id: string,
    data: { terminalId: string },
    token: string
  ) =>
    api<{ task: PersonalTask; queue: TerminalTaskQueue }>(
      `/api/personal-tasks/${id}/execute`,
      { method: 'POST', body: data, token }
    ),
};

// ========================
// Terminal Task Queue
// ========================

export type QueueStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type CommandStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface TerminalQueueCommand {
  id: string;
  queueId: string;
  command: string;
  status: CommandStatus;
  position: number;
  output: string | null;
  exitCode: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface TerminalTaskQueue {
  id: string;
  terminalId: string;
  userId: string;
  name: string;
  status: QueueStatus;
  position: number;
  commands: TerminalQueueCommand[];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export const terminalQueueApi = {
  list: (terminalId: string, token: string) =>
    api<{ queues: TerminalTaskQueue[] }>(
      `/api/terminals/${terminalId}/queue`,
      { token }
    ),

  get: (terminalId: string, queueId: string, token: string) =>
    api<{ queue: TerminalTaskQueue }>(
      `/api/terminals/${terminalId}/queue/${queueId}`,
      { token }
    ),

  create: (
    terminalId: string,
    data: {
      name: string;
      commands: Array<{ command: string; position?: number }>;
    },
    token: string
  ) =>
    api<{ queue: TerminalTaskQueue }>(
      `/api/terminals/${terminalId}/queue`,
      { method: 'POST', body: data, token }
    ),

  delete: (terminalId: string, queueId: string, token: string) =>
    api<void>(`/api/terminals/${terminalId}/queue/${queueId}`, {
      method: 'DELETE',
      token,
    }),

  start: (terminalId: string, queueId: string, token: string) =>
    api<{ queue: TerminalTaskQueue }>(
      `/api/terminals/${terminalId}/queue/${queueId}/start`,
      { method: 'POST', token }
    ),

  cancel: (terminalId: string, queueId: string, token: string) =>
    api<{ queue: TerminalTaskQueue }>(
      `/api/terminals/${terminalId}/queue/${queueId}/cancel`,
      { method: 'POST', token }
    ),

  reorder: (terminalId: string, queueIds: string[], token: string) =>
    api<void>(`/api/terminals/${terminalId}/queue/reorder`, {
      method: 'POST',
      body: { queueIds },
      token,
    }),
};

// ========================
// Task Status Config API
// ========================

export const taskStatusApi = {
  // Personal task statuses
  list: (token: string) =>
    api<{ statuses: TaskStatusConfig[] }>('/api/task-statuses', { token }),

  create: (
    data: {
      key: string;
      name: string;
      color: string;
      position?: number;
      isDefault?: boolean;
    },
    token: string
  ) =>
    api<TaskStatusConfig>('/api/task-statuses', { method: 'POST', body: data, token }),

  update: (
    id: string,
    data: {
      name?: string;
      color?: string;
      position?: number;
      isDefault?: boolean;
    },
    token: string
  ) =>
    api<TaskStatusConfig>(`/api/task-statuses/${id}`, { method: 'PATCH', body: data, token }),

  delete: (id: string, moveToStatusId?: string, token?: string) => {
    const url = moveToStatusId
      ? `/api/task-statuses/${id}?moveToStatusId=${moveToStatusId}`
      : `/api/task-statuses/${id}`;
    return api<void>(url, { method: 'DELETE', token });
  },

  reorder: (statusIds: string[], token: string) =>
    api<void>('/api/task-statuses/reorder', {
      method: 'POST',
      body: { statusIds },
      token,
    }),
};

export const teamTaskStatusApi = {
  // Team task statuses
  list: (teamId: string, token: string) =>
    api<{ statuses: TaskStatusConfig[] }>(`/api/teams/${teamId}/task-statuses`, { token }),

  create: (
    teamId: string,
    data: {
      key: string;
      name: string;
      color: string;
      position?: number;
      isDefault?: boolean;
    },
    token: string
  ) =>
    api<TaskStatusConfig>(`/api/teams/${teamId}/task-statuses`, { method: 'POST', body: data, token }),

  update: (
    teamId: string,
    statusId: string,
    data: {
      name?: string;
      color?: string;
      position?: number;
      isDefault?: boolean;
    },
    token: string
  ) =>
    api<TaskStatusConfig>(`/api/teams/${teamId}/task-statuses/${statusId}`, { method: 'PATCH', body: data, token }),

  delete: (teamId: string, statusId: string, moveToStatusId?: string, token?: string) => {
    const url = moveToStatusId
      ? `/api/teams/${teamId}/task-statuses/${statusId}?moveToStatusId=${moveToStatusId}`
      : `/api/teams/${teamId}/task-statuses/${statusId}`;
    return api<void>(url, { method: 'DELETE', token });
  },

  reorder: (teamId: string, statusIds: string[], token: string) =>
    api<void>(`/api/teams/${teamId}/task-statuses/reorder`, {
      method: 'POST',
      body: { statusIds },
      token,
    }),
};
