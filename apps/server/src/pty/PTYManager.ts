import * as pty from '@lydell/node-pty';
import { EventEmitter } from 'events';
import { TerminalStatus } from '@claude-terminal/shared';
import { OutputBuffer } from './OutputBuffer.js';

export interface PTYInstance {
  id: string;
  userId: string;
  process: pty.IPty;
  outputBuffer: OutputBuffer;
  status: TerminalStatus;
  cols: number;
  rows: number;
}

export interface PTYManagerOptions {
  maxInstances: number;
  shell: string;
}

/**
 * Manages PTY (pseudo-terminal) instances for Claude Code
 */
export class PTYManager extends EventEmitter {
  private instances: Map<string, PTYInstance> = new Map();
  private options: PTYManagerOptions;

  constructor(options: Partial<PTYManagerOptions> = {}) {
    super();
    this.options = {
      maxInstances: options.maxInstances || 10,
      shell: options.shell || process.env.SHELL || '/bin/zsh',
    };
  }

  /**
   * Create a new PTY instance for Claude Code
   */
  async create(
    terminalId: string,
    userId: string,
    options: {
      cols?: number;
      rows?: number;
      cwd?: string;
    } = {}
  ): Promise<PTYInstance> {
    // Check if already exists
    if (this.instances.has(terminalId)) {
      throw new Error(`Terminal ${terminalId} already exists`);
    }

    // Check max instances
    if (this.instances.size >= this.options.maxInstances) {
      throw new Error('Maximum number of terminal instances reached');
    }

    const cols = options.cols || 120;
    const rows = options.rows || 30;
    const cwd = options.cwd || process.env.HOME || '/';

    const shell = this.options.shell;

    console.log(`[PTY] Spawning shell: ${shell}`);
    console.log(`[PTY] Working directory: ${cwd}`);

    // Spawn a normal shell (bash/zsh)
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        HOME: process.env.HOME,
        SHELL: shell,
      },
    });

    const instance: PTYInstance = {
      id: terminalId,
      userId,
      process: ptyProcess,
      outputBuffer: new OutputBuffer(),
      status: TerminalStatus.RUNNING,
      cols,
      rows,
    };

    // Handle data output
    ptyProcess.onData((data: string) => {
      console.log(`[PTY ${terminalId}] Data:`, data.substring(0, 100));
      instance.outputBuffer.append(data);
      this.emit('data', terminalId, data);
    });

    // Handle process exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[PTY ${terminalId}] Exit: code=${exitCode}, signal=${signal}`);
      console.log(`[PTY ${terminalId}] Last output:`, instance.outputBuffer.getContents().slice(-500));
      instance.status = exitCode === 0 ? TerminalStatus.STOPPED : TerminalStatus.CRASHED;
      this.emit('exit', terminalId, exitCode, signal);
      this.instances.delete(terminalId);
    });

    this.instances.set(terminalId, instance);
    this.emit('created', terminalId);

    return instance;
  }

  /**
   * Get a PTY instance by terminal ID
   */
  get(terminalId: string): PTYInstance | undefined {
    return this.instances.get(terminalId);
  }

  /**
   * Check if a PTY instance exists
   */
  has(terminalId: string): boolean {
    return this.instances.has(terminalId);
  }

  /**
   * Write data to a PTY instance
   */
  write(terminalId: string, data: string): void {
    const instance = this.instances.get(terminalId);
    if (!instance) {
      throw new Error(`Terminal ${terminalId} not found`);
    }
    instance.process.write(data);
  }

  /**
   * Resize a PTY instance
   */
  resize(terminalId: string, cols: number, rows: number): void {
    const instance = this.instances.get(terminalId);
    if (!instance) {
      throw new Error(`Terminal ${terminalId} not found`);
    }
    instance.process.resize(cols, rows);
    instance.cols = cols;
    instance.rows = rows;
  }

  /**
   * Kill a PTY instance
   */
  kill(terminalId: string): void {
    const instance = this.instances.get(terminalId);
    if (!instance) {
      return; // Already gone
    }

    try {
      instance.process.kill();
    } catch (error) {
      // Process might already be dead
    }

    instance.status = TerminalStatus.STOPPED;
    this.instances.delete(terminalId);
    this.emit('killed', terminalId);
  }

  /**
   * Get buffered output for reconnection
   */
  getBufferedOutput(terminalId: string): string | undefined {
    const instance = this.instances.get(terminalId);
    return instance?.outputBuffer.getContents();
  }

  /**
   * Get all instances for a user
   */
  getByUser(userId: string): PTYInstance[] {
    return Array.from(this.instances.values()).filter(
      (instance) => instance.userId === userId
    );
  }

  /**
   * Kill all instances for a user
   */
  killByUser(userId: string): void {
    for (const instance of this.getByUser(userId)) {
      this.kill(instance.id);
    }
  }

  /**
   * Get instance count
   */
  get count(): number {
    return this.instances.size;
  }

  /**
   * Clean up all instances
   */
  shutdown(): void {
    for (const terminalId of this.instances.keys()) {
      this.kill(terminalId);
    }
  }
}

// Singleton instance
let ptyManager: PTYManager | null = null;

export function getPTYManager(options?: Partial<PTYManagerOptions>): PTYManager {
  if (!ptyManager) {
    ptyManager = new PTYManager(options);
  }
  return ptyManager;
}
