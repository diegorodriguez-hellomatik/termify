const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
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
