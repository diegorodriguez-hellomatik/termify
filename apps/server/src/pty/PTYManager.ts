import * as pty from '@lydell/node-pty';
import { EventEmitter } from 'events';
import { TerminalStatus } from '@termify/shared';
import { OutputBuffer } from './OutputBuffer.js';

export interface PTYInstance {
  id: string;
  userId: string;
  process: pty.IPty;
  outputBuffer: OutputBuffer;
  status: TerminalStatus;
  cols: number;
  rows: number;
  cwd: string;
  isWorking: boolean;
  lastInputTime: number;
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
      cwd,
      isWorking: false,
      lastInputTime: 0,
    };

    // Handle data output
    ptyProcess.onData((data: string) => {
      console.log(`[PTY ${terminalId}] Data:`, data.substring(0, 100));
      instance.outputBuffer.append(data);
      this.emit('data', terminalId, data);

      // Detect CWD changes via OSC 7 sequences (sent by zsh/bash)
      // Format: \x1b]7;file://hostname/path\x07 or \x1b]7;file://hostname/path\x1b\\
      const osc7Match = data.match(/\x1b\]7;file:\/\/[^\/]*([^\x07\x1b]+)[\x07\x1b]/);
      if (osc7Match) {
        const newCwd = decodeURIComponent(osc7Match[1]);
        if (newCwd !== instance.cwd) {
          console.log(`[PTY ${terminalId}] CWD changed: ${instance.cwd} -> ${newCwd}`);
          instance.cwd = newCwd;
          this.emit('cwd', terminalId, newCwd);
        }
      }

      // Detect shell prompt patterns to mark terminal as not working
      // Only check if currently working and some time has passed since last input
      if (instance.isWorking && Date.now() - instance.lastInputTime > 100) {
        const promptPatterns = [
          /\$\s*$/, // bash/zsh prompt
          />\s*$/, // some shells
          /❯\s*$/, // fancy prompts (starship, etc.)
          /#\s*$/, // root prompt
          /\]\s*$/, // custom prompts ending with ]
          /%\s*$/, // zsh default prompt
        ];

        const hasPrompt = promptPatterns.some((p) => p.test(data));
        if (hasPrompt) {
          instance.isWorking = false;
          this.emit('working', terminalId, false);
        }
      }
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

    // If input contains newline/carriage return, a command was executed
    if (data.includes('\r') || data.includes('\n')) {
      instance.lastInputTime = Date.now();
      if (!instance.isWorking) {
        instance.isWorking = true;
        this.emit('working', terminalId, true);
      }
    }

    // Emit input event for command tracking
    this.emit('input', terminalId, data);
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
   * Check if a terminal is currently working (executing a command)
   */
  isWorking(terminalId: string): boolean {
    const instance = this.instances.get(terminalId);
    return instance?.isWorking ?? false;
  }

  /**
   * Manually set the working state of a terminal
   */
  setWorking(terminalId: string, working: boolean): void {
    const instance = this.instances.get(terminalId);
    if (instance && instance.isWorking !== working) {
      instance.isWorking = working;
      this.emit('working', terminalId, working);
    }
  }

  /**
   * Execute a command and capture output
   * Returns the output after the command completes (detected by shell prompt or timeout)
   */
  async execute(
    terminalId: string,
    command: string,
    options: {
      timeout?: number; // Max time to wait for output (ms)
      waitForPrompt?: boolean; // Wait for shell prompt to appear
    } = {}
  ): Promise<{ output: string; timedOut: boolean }> {
    const instance = this.instances.get(terminalId);
    if (!instance) {
      throw new Error(`Terminal ${terminalId} not found`);
    }

    const timeout = options.timeout || 30000; // Default 30 seconds
    const waitForPrompt = options.waitForPrompt !== false;

    return new Promise((resolve) => {
      let output = '';
      let timeoutId: NodeJS.Timeout;
      let resolved = false;
      let idleTimeout: NodeJS.Timeout | null = null;

      // Capture output
      const onData = (tid: string, data: string) => {
        if (tid !== terminalId || resolved) return;
        output += data;

        // Reset idle timeout on each data chunk
        if (idleTimeout) clearTimeout(idleTimeout);

        // If we see common shell prompts, command likely finished
        // Wait a bit more for any trailing output, then resolve
        if (waitForPrompt) {
          const promptPatterns = [
            /\$\s*$/, // bash/zsh prompt
            />\s*$/, // some shells
            /❯\s*$/, // fancy prompts
            /#\s*$/, // root prompt
            /\]\s*$/, // custom prompts ending with ]
          ];

          const hasPrompt = promptPatterns.some((p) => p.test(data));
          if (hasPrompt) {
            // Wait 100ms for any trailing output, then resolve
            idleTimeout = setTimeout(() => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                this.removeListener('data', onData);
                resolve({ output, timedOut: false });
              }
            }, 100);
          }
        }
      };

      this.on('data', onData);

      // Set overall timeout
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (idleTimeout) clearTimeout(idleTimeout);
          this.removeListener('data', onData);
          resolve({ output, timedOut: true });
        }
      }, timeout);

      // Write the command with newline to execute it
      const commandWithNewline = command.endsWith('\n') ? command : command + '\n';
      instance.process.write(commandWithNewline);
    });
  }

  /**
   * Write input without waiting for output (fire and forget)
   */
  writeInput(terminalId: string, input: string): void {
    const instance = this.instances.get(terminalId);
    if (!instance) {
      throw new Error(`Terminal ${terminalId} not found`);
    }
    instance.process.write(input);
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
