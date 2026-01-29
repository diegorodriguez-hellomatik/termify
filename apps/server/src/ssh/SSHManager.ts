import { Client, ClientChannel, ConnectConfig } from 'ssh2';
import { EventEmitter } from 'events';

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

export interface SSHSession {
  id: string;
  client: Client;
  channel: ClientChannel | null;
  config: SSHConfig;
  cols: number;
  rows: number;
}

export class SSHManager extends EventEmitter {
  private sessions: Map<string, SSHSession> = new Map();
  private static instance: SSHManager;

  private constructor() {
    super();
  }

  static getInstance(): SSHManager {
    if (!SSHManager.instance) {
      SSHManager.instance = new SSHManager();
    }
    return SSHManager.instance;
  }

  /**
   * Test SSH connection without creating a session
   */
  async testConnection(config: SSHConfig): Promise<{ success: boolean; error?: string; serverInfo?: string }> {
    return new Promise((resolve) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        client.end();
        resolve({ success: false, error: 'Connection timeout (10s)' });
      }, 10000);

      client.on('ready', () => {
        clearTimeout(timeout);
        const serverInfo = `Connected to ${config.host}:${config.port}`;
        client.end();
        resolve({ success: true, serverInfo });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ success: false, error: err.message });
      });

      const connectConfig: ConnectConfig = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: 10000,
      };

      if (config.password) {
        connectConfig.password = config.password;
      } else if (config.privateKey) {
        connectConfig.privateKey = config.privateKey;
      }

      try {
        client.connect(connectConfig);
      } catch (err) {
        clearTimeout(timeout);
        resolve({ success: false, error: err instanceof Error ? err.message : 'Connection failed' });
      }
    });
  }

  /**
   * Create a new SSH session
   */
  async createSession(
    sessionId: string,
    config: SSHConfig,
    cols: number = 80,
    rows: number = 24
  ): Promise<SSHSession> {
    return new Promise((resolve, reject) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        client.end();
        reject(new Error('Connection timeout'));
      }, 15000);

      client.on('ready', () => {
        clearTimeout(timeout);

        client.shell({ cols, rows, term: 'xterm-256color' }, (err, channel) => {
          if (err) {
            client.end();
            reject(err);
            return;
          }

          const session: SSHSession = {
            id: sessionId,
            client,
            channel,
            config,
            cols,
            rows,
          };

          this.sessions.set(sessionId, session);

          // Forward data from SSH to our event system
          channel.on('data', (data: Buffer) => {
            this.emit('data', sessionId, data.toString());
          });

          channel.stderr.on('data', (data: Buffer) => {
            this.emit('data', sessionId, data.toString());
          });

          channel.on('close', () => {
            this.emit('close', sessionId);
            this.destroySession(sessionId);
          });

          channel.on('error', (err: Error) => {
            this.emit('error', sessionId, err);
          });

          resolve(session);
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      client.on('close', () => {
        this.emit('close', sessionId);
        this.sessions.delete(sessionId);
      });

      const connectConfig: ConnectConfig = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: 15000,
      };

      if (config.password) {
        connectConfig.password = config.password;
      } else if (config.privateKey) {
        connectConfig.privateKey = config.privateKey;
      }

      try {
        client.connect(connectConfig);
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * Write data to SSH session
   */
  write(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.channel) {
      return false;
    }
    return session.channel.write(data);
  }

  /**
   * Resize SSH terminal
   */
  resize(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.channel) {
      return false;
    }
    session.cols = cols;
    session.rows = rows;
    session.channel.setWindow(rows, cols, 0, 0);
    return true;
  }

  /**
   * Destroy SSH session
   */
  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.channel) {
        session.channel.close();
      }
      session.client.end();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SSHSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Check if session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): SSHSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Destroy all sessions
   */
  destroyAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.destroySession(sessionId);
    }
  }
}
