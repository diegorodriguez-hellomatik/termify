import { EventEmitter } from 'events';
import { prisma } from '../lib/prisma.js';
import { getPTYManager } from '../pty/PTYManager.js';
import { getWebSocketServer } from '../websocket/WebSocketServer.js';
import { NotificationService } from './NotificationService.js';

interface ActiveQueue {
  queueId: string;
  currentCommandId: string | null;
  output: string;
  commandStartTime: number;
  promptDetected: boolean;
}

// Prompt patterns to detect command completion
const PROMPT_PATTERNS = [
  /\$\s*$/, // bash: user@host:~$
  />\s*$/, // Windows: C:\>
  /❯\s*$/, // zsh con oh-my-zsh
  /%\s*$/, // zsh default
  /#\s*$/, // root prompt
  /➜\s*$/, // oh-my-zsh arrow
  /λ\s*$/, // lambda prompts
  /⟩\s*$/, // angle bracket prompts
  /\]\s*$/, // custom prompts ending with ]
];

// Patterns that indicate command is still running
const RUNNING_PATTERNS = [
  /^Compiling /m,
  /^Building /m,
  /^Downloading /m,
  /^Installing /m,
  /^\d+%/m, // Progress percentage
  /\.\.\./m, // Ellipsis indicating loading
];

export class TerminalQueueService extends EventEmitter {
  private activeQueues: Map<string, ActiveQueue> = new Map();
  private idleTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.setupPTYListeners();
  }

  /**
   * Set up listeners for PTY output to detect command completion
   */
  private setupPTYListeners(): void {
    const ptyManager = getPTYManager();

    ptyManager.on('data', (terminalId: string, data: string) => {
      const activeQueue = this.activeQueues.get(terminalId);
      if (!activeQueue || !activeQueue.currentCommandId) return;

      // Accumulate output
      activeQueue.output += data;

      // Reset idle timeout on each data chunk
      this.resetIdleTimeout(terminalId);

      // Check if prompt is detected (command finished)
      const hasPrompt = PROMPT_PATTERNS.some((p) => p.test(data));
      const stillRunning = RUNNING_PATTERNS.some((p) => p.test(data));

      if (hasPrompt && !stillRunning) {
        activeQueue.promptDetected = true;
        // Wait a bit for any trailing output, then mark as complete
        this.scheduleCommandComplete(terminalId, 0); // Success by default when prompt detected
      }
    });

    // Handle PTY exit (terminal closed while queue running)
    ptyManager.on('exit', async (terminalId: string, exitCode: number) => {
      const activeQueue = this.activeQueues.get(terminalId);
      if (!activeQueue) return;

      // Terminal closed - fail the current command and queue
      await this.failCurrentCommand(terminalId, exitCode || 1, 'Terminal closed unexpectedly');
      await this.failQueue(activeQueue.queueId, 'Terminal closed unexpectedly');
    });
  }

  /**
   * Reset idle timeout - if no output for too long, assume command finished
   */
  private resetIdleTimeout(terminalId: string): void {
    const existingTimeout = this.idleTimeouts.get(terminalId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Wait 2 seconds of idle before considering command complete
    const timeout = setTimeout(() => {
      const activeQueue = this.activeQueues.get(terminalId);
      if (activeQueue?.promptDetected) {
        this.completeCurrentCommand(terminalId, 0);
      }
    }, 2000);

    this.idleTimeouts.set(terminalId, timeout);
  }

  /**
   * Schedule command completion after a short delay
   */
  private scheduleCommandComplete(terminalId: string, exitCode: number): void {
    setTimeout(() => {
      this.completeCurrentCommand(terminalId, exitCode);
    }, 300); // Wait 300ms for any trailing output
  }

  /**
   * Start executing a queue
   */
  async startQueue(terminalId: string, queueId: string): Promise<void> {
    const ptyManager = getPTYManager();

    // Check if terminal is running
    if (!ptyManager.has(terminalId)) {
      throw new Error('Terminal is not running. Start the terminal first.');
    }

    // Check if another queue is already running on this terminal
    if (this.activeQueues.has(terminalId)) {
      throw new Error('Another queue is already running on this terminal');
    }

    // Update queue status to RUNNING
    const queue = await prisma.terminalTaskQueue.update({
      where: { id: queueId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
      include: {
        commands: {
          orderBy: { position: 'asc' },
        },
        terminal: true,
      },
    });

    // Initialize active queue tracking
    this.activeQueues.set(terminalId, {
      queueId,
      currentCommandId: null,
      output: '',
      commandStartTime: 0,
      promptDetected: false,
    });

    // Broadcast queue started
    this.broadcastQueueUpdate(terminalId, queue.terminal.teamId || queue.userId, {
      type: 'queue.started',
      terminalId,
      queueId,
    });

    // Execute first command
    await this.executeNextCommand(terminalId);
  }

  /**
   * Execute the next pending command in the queue
   */
  async executeNextCommand(terminalId: string): Promise<void> {
    const activeQueue = this.activeQueues.get(terminalId);
    if (!activeQueue) return;

    const ptyManager = getPTYManager();

    // Get the next pending command
    const queue = await prisma.terminalTaskQueue.findUnique({
      where: { id: activeQueue.queueId },
      include: {
        commands: {
          where: { status: 'PENDING' },
          orderBy: { position: 'asc' },
          take: 1,
        },
        terminal: true,
      },
    });

    if (!queue) {
      this.activeQueues.delete(terminalId);
      return;
    }

    // No more pending commands - queue completed
    if (queue.commands.length === 0) {
      await this.completeQueue(activeQueue.queueId);
      return;
    }

    const command = queue.commands[0];

    // Update command status to RUNNING
    await prisma.terminalQueueCommand.update({
      where: { id: command.id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // Reset active queue state for this command
    activeQueue.currentCommandId = command.id;
    activeQueue.output = '';
    activeQueue.commandStartTime = Date.now();
    activeQueue.promptDetected = false;

    // Broadcast command started
    this.broadcastQueueUpdate(terminalId, queue.terminal.teamId || queue.userId, {
      type: 'queue.command.started',
      terminalId,
      queueId: activeQueue.queueId,
      commandId: command.id,
    });

    // Execute the command
    const commandWithNewline = command.command.endsWith('\n')
      ? command.command
      : command.command + '\n';
    ptyManager.write(terminalId, commandWithNewline);
  }

  /**
   * Complete the current command and move to next
   */
  private async completeCurrentCommand(terminalId: string, exitCode: number): Promise<void> {
    const activeQueue = this.activeQueues.get(terminalId);
    if (!activeQueue || !activeQueue.currentCommandId) return;

    // Clear idle timeout
    const timeout = this.idleTimeouts.get(terminalId);
    if (timeout) {
      clearTimeout(timeout);
      this.idleTimeouts.delete(terminalId);
    }

    const commandId = activeQueue.currentCommandId;
    const output = activeQueue.output;

    // Update command in database
    await prisma.terminalQueueCommand.update({
      where: { id: commandId },
      data: {
        status: exitCode === 0 ? 'COMPLETED' : 'FAILED',
        completedAt: new Date(),
        exitCode,
        output: output.substring(0, 50000), // Limit output size
      },
    });

    const queue = await prisma.terminalTaskQueue.findUnique({
      where: { id: activeQueue.queueId },
      include: { terminal: true },
    });

    if (!queue) return;

    // Broadcast command completed
    this.broadcastQueueUpdate(terminalId, queue.terminal.teamId || queue.userId, {
      type: 'queue.command.completed',
      terminalId,
      queueId: activeQueue.queueId,
      commandId,
      exitCode,
    });

    // If command failed, fail the queue (unless we want to continue)
    if (exitCode !== 0) {
      await this.failQueue(activeQueue.queueId, `Command failed with exit code ${exitCode}`);
      return;
    }

    // Reset for next command
    activeQueue.currentCommandId = null;
    activeQueue.output = '';
    activeQueue.promptDetected = false;

    // Execute next command
    await this.executeNextCommand(terminalId);
  }

  /**
   * Fail the current command
   */
  private async failCurrentCommand(terminalId: string, exitCode: number, reason: string): Promise<void> {
    const activeQueue = this.activeQueues.get(terminalId);
    if (!activeQueue || !activeQueue.currentCommandId) return;

    await prisma.terminalQueueCommand.update({
      where: { id: activeQueue.currentCommandId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        exitCode,
        output: activeQueue.output + `\n[Error: ${reason}]`,
      },
    });
  }

  /**
   * Complete the queue successfully
   */
  private async completeQueue(queueId: string): Promise<void> {
    const queue = await prisma.terminalTaskQueue.update({
      where: { id: queueId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      include: {
        terminal: true,
        commands: {
          orderBy: { position: 'asc' },
        },
      },
    });

    // Clean up active queue tracking
    this.activeQueues.delete(queue.terminalId);
    const timeout = this.idleTimeouts.get(queue.terminalId);
    if (timeout) {
      clearTimeout(timeout);
      this.idleTimeouts.delete(queue.terminalId);
    }

    // Update linked PersonalTask to in_review status
    const linkedTask = await this.updateLinkedTaskStatus(queueId, 'in_review');

    // Broadcast queue completed
    const wsServer = getWebSocketServer();
    this.broadcastQueueUpdate(queue.terminalId, queue.terminal.teamId || queue.userId, {
      type: 'queue.completed',
      terminalId: queue.terminalId,
      queueId,
      name: queue.name,
      taskId: linkedTask?.id,
    });

    // Broadcast task updated if there was a linked task
    if (linkedTask && wsServer) {
      wsServer.broadcastToUser(queue.userId, {
        type: 'personal-task.updated',
        task: linkedTask,
        previousStatus: 'in_progress',
      });
    }

    // Send notification
    const notificationService = NotificationService.getInstance();
    await notificationService.create({
      userId: queue.userId,
      type: 'COMMAND_COMPLETED',
      title: 'Queue completed',
      message: `Task queue "${queue.name}" completed successfully`,
      metadata: {
        terminalId: queue.terminalId,
        queueId,
        terminalName: queue.terminal.name,
      },
    });
  }

  /**
   * Fail the queue
   */
  private async failQueue(queueId: string, reason: string): Promise<void> {
    const queue = await prisma.terminalTaskQueue.update({
      where: { id: queueId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
      },
      include: {
        terminal: true,
        commands: true,
      },
    });

    // Mark remaining pending commands as skipped
    await prisma.terminalQueueCommand.updateMany({
      where: {
        queueId,
        status: 'PENDING',
      },
      data: {
        status: 'SKIPPED',
      },
    });

    // Clean up
    this.activeQueues.delete(queue.terminalId);
    const timeout = this.idleTimeouts.get(queue.terminalId);
    if (timeout) {
      clearTimeout(timeout);
      this.idleTimeouts.delete(queue.terminalId);
    }

    // Update linked PersonalTask back to todo (failed execution)
    const linkedTask = await this.updateLinkedTaskStatus(queueId, 'todo');

    // Broadcast queue failed
    const wsServer = getWebSocketServer();
    this.broadcastQueueUpdate(queue.terminalId, queue.terminal.teamId || queue.userId, {
      type: 'queue.failed',
      terminalId: queue.terminalId,
      queueId,
      name: queue.name,
      reason,
      taskId: linkedTask?.id,
    });

    // Broadcast task updated if there was a linked task
    if (linkedTask && wsServer) {
      wsServer.broadcastToUser(queue.userId, {
        type: 'personal-task.updated',
        task: linkedTask,
        previousStatus: 'in_progress',
      });
    }

    // Send notification
    const notificationService = NotificationService.getInstance();
    await notificationService.create({
      userId: queue.userId,
      type: 'COMMAND_COMPLETED', // Reusing existing type
      title: 'Queue failed',
      message: `Task queue "${queue.name}" failed: ${reason}`,
      metadata: {
        terminalId: queue.terminalId,
        queueId,
        terminalName: queue.terminal.name,
        error: reason,
      },
    });
  }

  /**
   * Cancel a running queue
   */
  async cancelQueue(terminalId: string, queueId: string): Promise<void> {
    const activeQueue = this.activeQueues.get(terminalId);
    if (!activeQueue || activeQueue.queueId !== queueId) {
      throw new Error('Queue is not running');
    }

    // Update current running command to cancelled
    if (activeQueue.currentCommandId) {
      await prisma.terminalQueueCommand.update({
        where: { id: activeQueue.currentCommandId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          output: activeQueue.output + '\n[Cancelled by user]',
        },
      });
    }

    // Update remaining pending commands to skipped
    await prisma.terminalQueueCommand.updateMany({
      where: {
        queueId,
        status: 'PENDING',
      },
      data: {
        status: 'SKIPPED',
      },
    });

    // Update queue status
    const queue = await prisma.terminalTaskQueue.update({
      where: { id: queueId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
      include: {
        terminal: true,
      },
    });

    // Clean up
    this.activeQueues.delete(terminalId);
    const timeout = this.idleTimeouts.get(terminalId);
    if (timeout) {
      clearTimeout(timeout);
      this.idleTimeouts.delete(terminalId);
    }

    // Update linked PersonalTask back to todo (cancelled execution)
    const linkedTask = await this.updateLinkedTaskStatus(queueId, 'todo');

    // Broadcast cancellation
    const wsServer = getWebSocketServer();
    this.broadcastQueueUpdate(terminalId, queue.terminal.teamId || queue.userId, {
      type: 'queue.cancelled',
      terminalId,
      queueId,
      name: queue.name,
      taskId: linkedTask?.id,
    });

    // Broadcast task updated if there was a linked task
    if (linkedTask && wsServer) {
      wsServer.broadcastToUser(queue.userId, {
        type: 'personal-task.updated',
        task: linkedTask,
        previousStatus: 'in_progress',
      });
    }
  }

  /**
   * Update linked PersonalTask status when queue completes/fails/cancels
   */
  private async updateLinkedTaskStatus(queueId: string, newStatus: string): Promise<any | null> {
    try {
      // Find the PersonalTask linked to this queue
      const linkedTask = await prisma.personalTask.findFirst({
        where: { terminalQueueId: queueId },
      });

      if (!linkedTask) {
        return null;
      }

      // Update the task status
      const updatedTask = await prisma.personalTask.update({
        where: { id: linkedTask.id },
        data: { status: newStatus },
      });

      return updatedTask;
    } catch (error) {
      console.error('[TerminalQueueService] Error updating linked task status:', error);
      return null;
    }
  }

  /**
   * Broadcast queue updates via WebSocket
   */
  private broadcastQueueUpdate(terminalId: string, teamOrUserId: string, message: any): void {
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcastToTeam(teamOrUserId, message);
    }
  }

  /**
   * Check if a terminal has an active queue
   */
  hasActiveQueue(terminalId: string): boolean {
    return this.activeQueues.has(terminalId);
  }

  /**
   * Get active queue for a terminal
   */
  getActiveQueue(terminalId: string): ActiveQueue | undefined {
    return this.activeQueues.get(terminalId);
  }
}

// Singleton instance
let terminalQueueService: TerminalQueueService | null = null;

export function getTerminalQueueService(): TerminalQueueService {
  if (!terminalQueueService) {
    terminalQueueService = new TerminalQueueService();
  }
  return terminalQueueService;
}
