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
  // Team notifications
  TEAM_INVITE = 'TEAM_INVITE',
  TEAM_MEMBER_JOINED = 'TEAM_MEMBER_JOINED',
  TEAM_MEMBER_LEFT = 'TEAM_MEMBER_LEFT',
  TEAM_ROLE_CHANGED = 'TEAM_ROLE_CHANGED',
  // Task notifications
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_UNASSIGNED = 'TASK_UNASSIGNED',
  TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED',
  TASK_DUE_SOON = 'TASK_DUE_SOON',
  TASK_OVERDUE = 'TASK_OVERDUE',
}

// Team Role (legacy - for backwards compatibility)
export enum TeamRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

// Team Permissions - Granular permissions for team resources
export enum TeamPermission {
  // Terminal permissions
  CREATE_TERMINAL = 'create_terminal',
  EDIT_TERMINAL = 'edit_terminal',
  DELETE_TERMINAL = 'delete_terminal',
  VIEW_TERMINAL = 'view_terminal',
  CONTROL_TERMINAL = 'control_terminal',

  // Workspace permissions
  CREATE_WORKSPACE = 'create_workspace',
  EDIT_WORKSPACE = 'edit_workspace',
  DELETE_WORKSPACE = 'delete_workspace',
  VIEW_WORKSPACE = 'view_workspace',

  // Snippet permissions
  CREATE_SNIPPET = 'create_snippet',
  EDIT_SNIPPET = 'edit_snippet',
  DELETE_SNIPPET = 'delete_snippet',
  VIEW_SNIPPET = 'view_snippet',

  // Server permissions
  CREATE_SERVER = 'create_server',
  EDIT_SERVER = 'edit_server',
  DELETE_SERVER = 'delete_server',
  VIEW_SERVER = 'view_server',
  CONNECT_SERVER = 'connect_server',

  // Task permissions
  CREATE_TASK = 'create_task',
  EDIT_TASK = 'edit_task',
  DELETE_TASK = 'delete_task',
  ASSIGN_TASK = 'assign_task',

  // Member permissions
  INVITE_MEMBER = 'invite_member',
  KICK_MEMBER = 'kick_member',
  CHANGE_MEMBER_ROLE = 'change_member_role',
  VIEW_MEMBERS = 'view_members',

  // Team management
  EDIT_TEAM_SETTINGS = 'edit_team_settings',
  DELETE_TEAM = 'delete_team',
  MANAGE_ROLES = 'manage_roles',
  VIEW_ACTIVITY = 'view_activity',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
}

// Default permission sets for built-in roles
export const DEFAULT_OWNER_PERMISSIONS: TeamPermission[] = Object.values(TeamPermission);

export const DEFAULT_ADMIN_PERMISSIONS: TeamPermission[] = [
  // All terminal permissions
  TeamPermission.CREATE_TERMINAL,
  TeamPermission.EDIT_TERMINAL,
  TeamPermission.DELETE_TERMINAL,
  TeamPermission.VIEW_TERMINAL,
  TeamPermission.CONTROL_TERMINAL,
  // All workspace permissions
  TeamPermission.CREATE_WORKSPACE,
  TeamPermission.EDIT_WORKSPACE,
  TeamPermission.DELETE_WORKSPACE,
  TeamPermission.VIEW_WORKSPACE,
  // All snippet permissions
  TeamPermission.CREATE_SNIPPET,
  TeamPermission.EDIT_SNIPPET,
  TeamPermission.DELETE_SNIPPET,
  TeamPermission.VIEW_SNIPPET,
  // All server permissions
  TeamPermission.CREATE_SERVER,
  TeamPermission.EDIT_SERVER,
  TeamPermission.DELETE_SERVER,
  TeamPermission.VIEW_SERVER,
  TeamPermission.CONNECT_SERVER,
  // All task permissions
  TeamPermission.CREATE_TASK,
  TeamPermission.EDIT_TASK,
  TeamPermission.DELETE_TASK,
  TeamPermission.ASSIGN_TASK,
  // Member management (except delete team)
  TeamPermission.INVITE_MEMBER,
  TeamPermission.KICK_MEMBER,
  TeamPermission.CHANGE_MEMBER_ROLE,
  TeamPermission.VIEW_MEMBERS,
  // Team settings
  TeamPermission.EDIT_TEAM_SETTINGS,
  TeamPermission.VIEW_ACTIVITY,
  TeamPermission.VIEW_AUDIT_LOGS,
];

export const DEFAULT_MEMBER_PERMISSIONS: TeamPermission[] = [
  TeamPermission.VIEW_TERMINAL,
  TeamPermission.CONTROL_TERMINAL,
  TeamPermission.VIEW_WORKSPACE,
  TeamPermission.VIEW_SNIPPET,
  TeamPermission.VIEW_SERVER,
  TeamPermission.CONNECT_SERVER,
  TeamPermission.CREATE_TASK,
  TeamPermission.EDIT_TASK,
  TeamPermission.VIEW_MEMBERS,
  TeamPermission.VIEW_ACTIVITY,
];

// Task Status - Now using custom statuses from TaskStatusConfig
// Status values are now lowercase strings: "backlog", "todo", "in_progress", "in_review", "done"
// TaskStatus is now a string type to support custom statuses
export type TaskStatus = string;

// Default task status keys (lowercase)
export const DEFAULT_TASK_STATUS_KEYS = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
export type TaskStatusKey = typeof DEFAULT_TASK_STATUS_KEYS[number] | string;

// TaskStatusConfig model
export interface TaskStatusConfig {
  id: string;
  userId?: string | null;
  teamId?: string | null;
  key: string;
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Task Priority
export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// Queue Status
export enum QueueStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// Command Status
export enum CommandStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

// Server Auth Method
export enum ServerAuthMethod {
  PASSWORD = 'PASSWORD',
  KEY = 'KEY',
  AGENT = 'AGENT',
}

// Server Status
export enum ServerStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  UNKNOWN = 'UNKNOWN',
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
  isWorking?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// User model
export interface User {
  id: string;
  email: string;
  name: string | null;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Team model
export interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  memberCount?: number;
  taskCount?: number;
  members?: TeamMember[];
  roles?: TeamCustomRole[];
  createdAt: Date;
  updatedAt: Date;
}

// TeamCustomRole model
export interface TeamCustomRole {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  color: string;
  permissions: TeamPermission[];
  position: number;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// TeamMember model
export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole; // Legacy field
  customRoleId: string | null;
  customRole?: TeamCustomRole;
  user?: User;
  createdAt: Date;
  updatedAt: Date;
}

// Task model
export interface Task {
  id: string;
  teamId: string;
  createdById: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  dueDate: Date | null;
  team?: Team;
  createdBy?: User;
  assignees?: TaskAssignee[];
  createdAt: Date;
  updatedAt: Date;
}

// TaskAssignee model
export interface TaskAssignee {
  id: string;
  taskId: string;
  teamMemberId: string;
  teamMember?: TeamMember;
  createdAt: Date;
}

// TaskTerminalHistory model
export interface TaskTerminalHistory {
  id: string;
  taskId: string;
  terminalId: string;
  startedAt: Date;
  endedAt: Date | null;
  duration: number | null;
}

// Team Terminal Share model
export interface TeamTerminalShare {
  id: string;
  terminalId: string;
  teamId: string;
  permission: SharePermission;
  terminal?: Terminal;
  team?: Team;
  createdAt: Date;
}

// Team Snippet model
export interface TeamSnippet {
  id: string;
  teamId: string;
  createdById: string;
  name: string;
  command: string;
  description: string | null;
  category: string | null;
  tags: string[];
  usageCount: number;
  createdBy?: User;
  createdAt: Date;
  updatedAt: Date;
}

// Team Environment Variable model
export interface TeamEnvVariable {
  id: string;
  teamId: string;
  name: string;
  value: string;
  isSecret: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Team Server model
export interface TeamServer {
  id: string;
  teamId: string;
  createdById: string;
  name: string;
  host: string;
  port: number;
  username: string | null;
  authMethod: ServerAuthMethod;
  description: string | null;
  documentation: string | null;
  tags: string[];
  lastStatus: ServerStatus | null;
  lastCheckedAt: Date | null;
  createdBy?: User;
  createdAt: Date;
  updatedAt: Date;
}

// Team Command History model
export interface TeamCommandHistory {
  id: string;
  teamId: string;
  userId: string;
  terminalId: string;
  command: string;
  exitCode: number | null;
  duration: number | null;
  user?: User;
  createdAt: Date;
}

// Team Audit Log model
export interface TeamAuditLog {
  id: string;
  teamId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  user?: User;
  createdAt: Date;
}

// Team Notification Preferences model
export interface TeamNotificationPrefs {
  id: string;
  teamId: string;
  userId: string;
  terminalErrors: boolean;
  longCommands: boolean;
  longCommandThreshold: number;
  taskMentions: boolean;
  serverStatus: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// User info for messages (partial user data)
export interface MessageUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

// Collaborative Message model
export interface CollaborativeMessage {
  id: string;
  terminalId: string;
  userId: string;
  content: string;
  user?: MessageUser;
  createdAt: Date;
}

// Team Message model
export interface TeamMessage {
  id: string;
  teamId: string;
  userId: string;
  content: string;
  user?: MessageUser;
  createdAt: Date;
}

// Workspace Message model
export interface WorkspaceMessage {
  id: string;
  workspaceId: string;
  userId: string;
  content: string;
  user?: MessageUser;
  createdAt: Date;
}

// Online Member for teams/workspaces
export interface OnlineMember {
  odId: string;
  visitorId: string;
  userId: string;
  email: string;
  name: string | null;
  image: string | null;
}

// Task Command model
export interface TaskCommand {
  id: string;
  taskId: string;
  command: string;
  description: string | null;
  position: number;
  isCompleted: boolean;
  completedAt: Date | null;
  exitCode: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// Terminal Task Queue model
export interface TerminalTaskQueue {
  id: string;
  terminalId: string;
  userId: string;
  name: string;
  status: QueueStatus;
  position: number;
  commands?: TerminalQueueCommand[];
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

// Terminal Queue Command model
export interface TerminalQueueCommand {
  id: string;
  queueId: string;
  command: string;
  status: CommandStatus;
  position: number;
  output: string | null;
  exitCode: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

// Team Presence model (in-memory)
export interface TeamPresence {
  userId: string;
  userName: string;
  userImage: string | null;
  status: 'online' | 'away' | 'busy';
  activeTerminalId: string | null;
  lastActivityAt: Date;
}

// Cursor Position for collaboration
export interface CursorPosition {
  odId: string;
  visitorId: string;
  userId: string;
  userName: string;
  userImage: string | null;
  x: number;
  y: number;
  scrollTop: number;
}

// WebSocket Messages - Client to Server
export type ClientMessage =
  | { type: 'terminal.connect'; terminalId: string; shareToken?: string }
  | { type: 'terminal.input'; terminalId: string; data: string }
  | { type: 'terminal.resize'; terminalId: string; cols: number; rows: number }
  | { type: 'terminal.start'; terminalId: string }
  | { type: 'terminal.stop'; terminalId: string }
  | { type: 'team.subscribe'; teamId: string }
  | { type: 'team.unsubscribe'; teamId: string }
  // Team chat messages
  | { type: 'chat.team.send'; teamId: string; content: string }
  | { type: 'chat.team.history'; teamId: string; limit?: number; before?: string }
  // Workspace messages
  | { type: 'workspace.subscribe'; workspaceId: string }
  | { type: 'workspace.unsubscribe'; workspaceId: string }
  | { type: 'chat.workspace.send'; workspaceId: string; content: string }
  | { type: 'chat.workspace.history'; workspaceId: string; limit?: number; before?: string }
  // Collaboration messages
  | { type: 'terminal.cursor.move'; terminalId: string; x: number; y: number; scrollTop: number }
  | { type: 'terminal.chat.send'; terminalId: string; content: string }
  | { type: 'terminal.chat.history'; terminalId: string; limit?: number }
  | { type: 'terminal.follow.start'; terminalId: string; targetOdId: string }
  | { type: 'terminal.follow.stop'; terminalId: string }
  | { type: 'terminal.scroll.sync'; terminalId: string; scrollTop: number }
  // Presence messages
  | { type: 'presence.update'; status: 'online' | 'away' | 'busy'; activeTerminalId?: string | null }
  // Server stats messages
  | { type: 'server.stats.subscribe'; serverId: string }
  | { type: 'server.stats.unsubscribe'; serverId: string }
  | { type: 'ping' };

// WebSocket Messages - Server to Client
export type ServerMessage =
  | { type: 'terminal.output'; terminalId: string; data: string }
  | { type: 'terminal.connected'; terminalId: string; bufferedOutput?: string; permission?: SharePermission }
  | { type: 'terminal.status'; terminalId: string; status: TerminalStatus }
  | { type: 'terminal.error'; terminalId: string; error: string }
  | { type: 'terminal.cwd'; terminalId: string; cwd: string }
  | { type: 'terminal.working'; terminalId: string; isWorking: boolean }
  | { type: 'terminal.created'; terminal: Terminal }
  | { type: 'terminal.updated'; terminal: Terminal }
  | { type: 'terminal.deleted'; terminalId: string }
  | { type: 'terminal.viewers'; terminalId: string; viewers: TerminalViewer[] }
  | { type: 'terminal.viewer.joined'; terminalId: string; viewer: TerminalViewer }
  | { type: 'terminal.viewer.left'; terminalId: string; odId: string }
  | { type: 'files.changed'; terminalId: string }
  | { type: 'notification'; notification: Notification }
  // Team events
  | { type: 'team.subscribed'; teamId: string }
  | { type: 'team.member.joined'; teamId: string; member: TeamMember }
  | { type: 'team.member.left'; teamId: string; memberId: string }
  | { type: 'team.member.role.changed'; teamId: string; memberId: string; role: TeamRole; customRole?: TeamCustomRole }
  // Team chat events
  | { type: 'chat.team.message'; teamId: string; message: TeamMessage }
  | { type: 'chat.team.messages'; teamId: string; messages: TeamMessage[] }
  | { type: 'chat.team.online'; teamId: string; members: OnlineMember[] }
  // Workspace events
  | { type: 'workspace.subscribed'; workspaceId: string }
  | { type: 'chat.workspace.message'; workspaceId: string; message: WorkspaceMessage }
  | { type: 'chat.workspace.messages'; workspaceId: string; messages: WorkspaceMessage[] }
  | { type: 'chat.workspace.online'; workspaceId: string; users: OnlineMember[] }
  // Team role events
  | { type: 'team.role.created'; teamId: string; role: TeamCustomRole }
  | { type: 'team.role.updated'; teamId: string; role: TeamCustomRole }
  | { type: 'team.role.deleted'; teamId: string; roleId: string }
  // Task events
  | { type: 'task.created'; teamId: string; task: Task }
  | { type: 'task.updated'; teamId: string; task: Task }
  | { type: 'task.deleted'; teamId: string; taskId: string }
  | { type: 'task.status.changed'; teamId: string; taskId: string; status: TaskStatus; changedById: string }
  | { type: 'task.assigned'; teamId: string; taskId: string; assignee: TaskAssignee }
  | { type: 'task.unassigned'; teamId: string; taskId: string; assigneeId: string }
  // Collaboration events
  | { type: 'terminal.cursor.positions'; terminalId: string; cursors: CursorPosition[] }
  | { type: 'terminal.cursor.moved'; terminalId: string; cursor: CursorPosition }
  | { type: 'terminal.cursor.left'; terminalId: string; odId: string }
  | { type: 'terminal.chat.message'; terminalId: string; message: CollaborativeMessage }
  | { type: 'terminal.chat.messages'; terminalId: string; messages: CollaborativeMessage[] }
  | { type: 'terminal.follow.started'; terminalId: string; followerId: string; targetId: string }
  | { type: 'terminal.follow.stopped'; terminalId: string; followerId: string }
  | { type: 'terminal.scroll.position'; terminalId: string; scrollTop: number; fromOdId: string }
  // Team terminal events
  | { type: 'team.terminal.added'; teamId: string; terminalShare: TeamTerminalShare }
  | { type: 'team.terminal.removed'; teamId: string; terminalId: string }
  | { type: 'team.terminal.permission.changed'; teamId: string; terminalId: string; permission: SharePermission }
  // Team workspace events
  | { type: 'team.workspace.added'; teamId: string; workspace: Workspace }
  | { type: 'team.workspace.removed'; teamId: string; workspaceId: string }
  | { type: 'team.workspace.layout.changed'; teamId: string; workspaceId: string; layout: WorkspaceLayout }
  // Team presence events
  | { type: 'team.presence.update'; teamId: string; presence: TeamPresence[] }
  | { type: 'team.presence.user.online'; teamId: string; presence: TeamPresence }
  | { type: 'team.presence.user.offline'; teamId: string; userId: string }
  // Team snippet events
  | { type: 'team.snippet.created'; teamId: string; snippet: TeamSnippet }
  | { type: 'team.snippet.updated'; teamId: string; snippet: TeamSnippet }
  | { type: 'team.snippet.deleted'; teamId: string; snippetId: string }
  // Team server events
  | { type: 'team.server.created'; teamId: string; server: TeamServer }
  | { type: 'team.server.updated'; teamId: string; server: TeamServer }
  | { type: 'team.server.deleted'; teamId: string; serverId: string }
  | { type: 'team.server.status.changed'; teamId: string; serverId: string; status: ServerStatus }
  // Task command events
  | { type: 'task.command.created'; teamId: string; taskId: string; command: TaskCommand }
  | { type: 'task.command.updated'; teamId: string; taskId: string; command: TaskCommand }
  | { type: 'task.command.deleted'; teamId: string; taskId: string; commandId: string }
  | { type: 'task.command.executed'; teamId: string; taskId: string; commandId: string; exitCode: number }
  // Terminal queue events
  | { type: 'queue.created'; terminalId: string; queue: TerminalTaskQueue }
  | { type: 'queue.updated'; terminalId: string; queue: TerminalTaskQueue }
  | { type: 'queue.deleted'; terminalId: string; queueId: string }
  | { type: 'queue.started'; terminalId: string; queueId: string }
  | { type: 'queue.completed'; terminalId: string; queueId: string; name: string }
  | { type: 'queue.failed'; terminalId: string; queueId: string; name: string; reason: string }
  | { type: 'queue.cancelled'; terminalId: string; queueId: string; name: string }
  | { type: 'queue.command.started'; terminalId: string; queueId: string; commandId: string }
  | { type: 'queue.command.completed'; terminalId: string; queueId: string; commandId: string; exitCode: number }
  // Server stats events
  | { type: 'server.stats.subscribed'; serverId: string }
  | { type: 'server.stats.unsubscribed'; serverId: string }
  | { type: 'server.stats'; serverId: string; stats: ServerStatsData }
  | { type: 'server.stats.connected'; serverId: string }
  | { type: 'server.stats.disconnected'; serverId: string }
  | { type: 'server.stats.error'; serverId: string; error: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };

// Server Stats model (for WebSocket)
export interface ServerStatsData {
  cpu: number[];
  cpuAvg: number;
  memory: {
    total: number;
    used: number;
    swapTotal: number;
    swapUsed: number;
  };
  disks: Array<{
    name: string;
    available: number;
    total: number;
  }>;
  network: Array<{
    interface: string;
    rxBytes: number;
    txBytes: number;
    rxPackets: number;
    txPackets: number;
    rxErrors: number;
    txErrors: number;
  }>;
  processes: Array<{
    pid: number;
    name: string;
    exe: string;
    memory: number;
    cpu: number;
  }>;
  os?: {
    name: string;
    kernel: string;
    version: string;
    arch: string;
  };
  timestamp: number;
}

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

// Teams API Request/Response types
export interface CreateTeamRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string | null;
  color?: string;
  icon?: string | null;
}

export interface InviteTeamMemberRequest {
  email: string;
  role?: TeamRole;
}

export interface UpdateTeamMemberRoleRequest {
  role?: TeamRole; // Legacy
  customRoleId?: string; // New: assign custom role
}

// Team Custom Role API Request types
export interface CreateTeamRoleRequest {
  name: string;
  description?: string;
  color?: string;
  permissions: TeamPermission[];
  position?: number;
}

export interface UpdateTeamRoleRequest {
  name?: string;
  description?: string | null;
  color?: string;
  permissions?: TeamPermission[];
  position?: number;
}

// Tasks API Request/Response types
export interface CreateTaskRequest {
  teamId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string; // ISO date string
  assigneeIds?: string[]; // TeamMember IDs
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  position?: number;
  dueDate?: string | null;
}

export interface AssignTaskRequest {
  teamMemberId: string;
}

export interface ReorderTasksRequest {
  taskIds: string[];
  status: TaskStatus;
}

export interface SetActiveTaskRequest {
  taskId: string | null;
}

// Team Terminal Share API Request/Response types
export interface ShareTerminalWithTeamRequest {
  terminalId: string;
  permission?: SharePermission;
}

export interface UpdateTeamTerminalPermissionRequest {
  permission: SharePermission;
}

// Team Snippet API Request/Response types
export interface CreateTeamSnippetRequest {
  name: string;
  command: string;
  description?: string;
  category?: string;
  tags?: string[];
}

export interface UpdateTeamSnippetRequest {
  name?: string;
  command?: string;
  description?: string | null;
  category?: string | null;
  tags?: string[];
}

// Team Env Variable API Request/Response types
export interface CreateTeamEnvVariableRequest {
  name: string;
  value: string;
  isSecret?: boolean;
}

export interface UpdateTeamEnvVariableRequest {
  value?: string;
  isSecret?: boolean;
}

// Team Server API Request/Response types
export interface CreateTeamServerRequest {
  name: string;
  host: string;
  port?: number;
  username?: string;
  authMethod?: ServerAuthMethod;
  description?: string;
  documentation?: string;
  tags?: string[];
}

export interface UpdateTeamServerRequest {
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  authMethod?: ServerAuthMethod;
  description?: string | null;
  documentation?: string | null;
  tags?: string[];
}

// Task Command API Request/Response types
export interface CreateTaskCommandRequest {
  command: string;
  description?: string;
  position?: number;
}

export interface UpdateTaskCommandRequest {
  command?: string;
  description?: string | null;
  position?: number;
  isCompleted?: boolean;
}

// Team History Query Params
export interface TeamHistoryQueryParams {
  search?: string;
  userId?: string;
  terminalId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// Terminal Queue API Request types
export interface CreateTerminalQueueRequest {
  name: string;
  commands: Array<{
    command: string;
    position?: number;
  }>;
}

export interface ReorderQueuesRequest {
  queueIds: string[];
}

// Team Notification Prefs Request
export interface UpdateTeamNotificationPrefsRequest {
  terminalErrors?: boolean;
  longCommands?: boolean;
  longCommandThreshold?: number;
  taskMentions?: boolean;
  serverStatus?: boolean;
}

// Workspace model
export interface WorkspaceSettings {
  theme?: string;
  defaultCols?: number;
  defaultRows?: number;
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

export interface Workspace {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  position: number;
  layout: WorkspaceLayout | null;
  settings: WorkspaceSettings | null;
  terminalCount?: number;
  terminals?: WorkspaceTerminalItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceTerminalItem {
  id: string;
  name: string;
  status: TerminalStatus;
  type: string;
  cols: number;
  rows: number;
  cwd: string | null;
  isFavorite: boolean;
  position: number;
  lastActiveAt: Date | null;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  isDefault?: boolean;
  position?: number;
  layout?: WorkspaceLayout | null;
  settings?: WorkspaceSettings | null;
}

// Constants
export const DEFAULT_COLS = 120;
export const DEFAULT_ROWS = 30;
export const MAX_OUTPUT_BUFFER_SIZE = 100 * 1024; // 100KB
export const WS_PING_INTERVAL = 30000; // 30 seconds
export const WS_PONG_TIMEOUT = 10000; // 10 seconds
export const RATE_LIMIT_MESSAGES_PER_MIN = 3000; // ~50 messages/sec for fast typing
