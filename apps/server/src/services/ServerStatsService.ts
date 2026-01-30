import { Client, ConnectConfig } from 'ssh2';
import { EventEmitter } from 'events';
import * as si from 'systeminformation';
import * as os from 'os';
import { prisma } from '../lib/prisma.js';

export interface ServerStats {
  cpu: number[];           // Usage per core (0-100)
  cpuAvg: number;          // Average CPU usage
  memory: {
    total: number;         // Bytes
    used: number;
    swapTotal: number;
    swapUsed: number;
  };
  disks: Array<{
    name: string;
    available: number;     // Bytes
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

interface SSHCollector {
  type: 'ssh';
  conn: Client;
  stream: any;
  serverId: string;
  userId: string;
}

interface LocalCollector {
  type: 'local';
  interval: NodeJS.Timeout;
  serverId: string;
  userId: string;
}

type StatsCollector = SSHCollector | LocalCollector;

class ServerStatsService extends EventEmitter {
  private collectors: Map<string, StatsCollector> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();

  // Path to stats-agent binary on remote servers
  private agentPath = '~/.termify/stats-agent';
  private agentInterval = 5; // seconds

  /**
   * Check if the host is localhost
   */
  private isLocalhost(host: string): boolean {
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  }

  /**
   * Start collecting stats for a server
   */
  async startCollecting(serverId: string, userId: string): Promise<void> {
    // Already collecting
    if (this.collectors.has(serverId)) {
      return;
    }

    try {
      const server = await prisma.server.findFirst({
        where: { id: serverId, userId },
      });

      if (!server) {
        throw new Error('Server not found');
      }

      // Use local collection for localhost, SSH for remote servers
      if (this.isLocalhost(server.host)) {
        await this.startLocalCollecting(serverId, userId);
      } else {
        await this.startSSHCollecting(serverId, userId, server);
      }

    } catch (error: any) {
      console.error(`[ServerStats] Failed to start collecting for ${serverId}:`, error.message);
      this.emit('error', { serverId, error: error.message });
      this.scheduleReconnect(serverId, userId);
    }
  }

  /**
   * Start collecting stats locally (for localhost)
   */
  private async startLocalCollecting(serverId: string, userId: string): Promise<void> {
    console.log(`[ServerStats] Starting local collection for ${serverId}`);

    // Emit connected immediately
    this.emit('connected', { serverId });

    // Collect stats immediately
    const stats = await this.collectLocalStats();
    this.emit('stats', { serverId, userId, stats });

    // Set up interval for continuous collection
    const interval = setInterval(async () => {
      try {
        const stats = await this.collectLocalStats();
        this.emit('stats', { serverId, userId, stats });
      } catch (error: any) {
        console.error(`[ServerStats] Local collection error:`, error.message);
      }
    }, this.agentInterval * 1000);

    this.collectors.set(serverId, {
      type: 'local',
      interval,
      serverId,
      userId,
    });

    console.log(`[ServerStats] Started local collecting for ${serverId}`);
  }

  /**
   * Collect stats from the local machine using systeminformation
   */
  private async collectLocalStats(): Promise<ServerStats> {
    const [cpu, mem, disks, network, osInfo] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.osInfo(),
    ]);

    return {
      cpu: cpu.cpus.map(c => Math.round(c.load * 100) / 100),
      cpuAvg: Math.round(cpu.currentLoad * 100) / 100,
      memory: {
        total: mem.total,
        used: mem.used,
        swapTotal: mem.swaptotal,
        swapUsed: mem.swapused,
      },
      disks: disks
        .filter(d => d.size > 0)
        .map(d => ({
          name: d.fs,
          available: d.available,
          total: d.size,
        })),
      network: network
        .filter(n => n.rx_bytes > 0 || n.tx_bytes > 0)
        .map(n => ({
          interface: n.iface,
          rxBytes: n.rx_bytes,
          txBytes: n.tx_bytes,
          rxPackets: n.rx_sec !== null ? Math.round(n.rx_sec) : 0,
          txPackets: n.tx_sec !== null ? Math.round(n.tx_sec) : 0,
          rxErrors: n.rx_errors,
          txErrors: n.tx_errors,
        })),
      processes: [],
      os: {
        name: osInfo.distro || os.type(),
        kernel: osInfo.kernel,
        version: osInfo.release,
        arch: osInfo.arch,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Start collecting stats via SSH (for remote servers)
   */
  private async startSSHCollecting(serverId: string, userId: string, server: any): Promise<void> {
    const sshConfig: ConnectConfig = {
      host: server.host,
      port: server.port,
      username: server.username || undefined,
      readyTimeout: 10000,
    };

    // Add auth method
    if (server.authMethod === 'PASSWORD' && server.password) {
      sshConfig.password = server.password;
    } else if (server.authMethod === 'KEY' && server.privateKey) {
      sshConfig.privateKey = server.privateKey;
    } else if (server.authMethod === 'AGENT') {
      sshConfig.agent = process.env.SSH_AUTH_SOCK;
    }

    const conn = new Client();

    await new Promise<void>((resolve, reject) => {
      conn.on('ready', resolve);
      conn.on('error', reject);
      conn.connect(sshConfig);
    });

    // Execute the stats-agent daemon
    conn.exec(
      `${this.agentPath} daemon ${this.agentInterval}`,
      (err, stream) => {
        if (err) {
          console.error(`[ServerStats] Failed to start agent on ${serverId}:`, err.message);
          this.emit('error', { serverId, error: `Failed to start stats-agent: ${err.message}. Make sure ~/.termify/stats-agent exists on the server.` });
          conn.end();
          return;
        }

        let buffer = '';

        stream.on('data', (data: Buffer) => {
          buffer += data.toString();

          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const stats = this.parseStats(line);
                this.emit('stats', { serverId, userId, stats });
              } catch (e) {
                // Could be OS info or other non-JSON output, try parsing legacy format
                const legacyStats = this.parseLegacyFormat(line);
                if (legacyStats) {
                  this.emit('stats', { serverId, userId, stats: legacyStats });
                }
              }
            }
          }
        });

        stream.stderr.on('data', (data: Buffer) => {
          const errMsg = data.toString().trim();
          console.error(`[ServerStats] stderr from ${serverId}:`, errMsg);
          // Check for common errors
          if (errMsg.includes('not found') || errMsg.includes('No such file')) {
            this.emit('error', { serverId, error: 'stats-agent not found. Please install it at ~/.termify/stats-agent' });
          }
        });

        stream.on('close', () => {
          console.log(`[ServerStats] Stream closed for ${serverId}`);
          this.collectors.delete(serverId);
          this.emit('disconnected', { serverId });

          // Schedule reconnect
          this.scheduleReconnect(serverId, userId);
        });

        this.collectors.set(serverId, { type: 'ssh', conn, stream, serverId, userId });
        console.log(`[ServerStats] Started SSH collecting for ${serverId}`);
        this.emit('connected', { serverId });
      }
    );

    conn.on('error', (err) => {
      console.error(`[ServerStats] Connection error for ${serverId}:`, err.message);
      this.emit('error', { serverId, error: err.message });
    });

    conn.on('close', () => {
      this.collectors.delete(serverId);
    });
  }

  /**
   * Stop collecting stats for a server
   */
  stopCollecting(serverId: string): void {
    const collector = this.collectors.get(serverId);
    if (collector) {
      if (collector.type === 'ssh') {
        collector.stream?.close();
        collector.conn?.end();
      } else if (collector.type === 'local') {
        clearInterval(collector.interval);
      }
      this.collectors.delete(serverId);
    }

    // Clear any pending reconnect
    const timeout = this.reconnectTimeouts.get(serverId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(serverId);
    }

    console.log(`[ServerStats] Stopped collecting for ${serverId}`);
  }

  /**
   * Check if collecting for a server
   */
  isCollecting(serverId: string): boolean {
    return this.collectors.has(serverId);
  }

  /**
   * Get all active collectors
   */
  getActiveCollectors(): string[] {
    return Array.from(this.collectors.keys());
  }

  /**
   * Schedule a reconnect attempt
   */
  private scheduleReconnect(serverId: string, userId: string): void {
    // Clear existing timeout
    const existing = this.reconnectTimeouts.get(serverId);
    if (existing) {
      clearTimeout(existing);
    }

    // Reconnect after 30 seconds
    const timeout = setTimeout(() => {
      this.reconnectTimeouts.delete(serverId);
      this.startCollecting(serverId, userId);
    }, 30000);

    this.reconnectTimeouts.set(serverId, timeout);
  }

  /**
   * Parse JSON stats from the Rust agent
   */
  private parseStats(line: string): ServerStats {
    const data = JSON.parse(line);

    return {
      cpu: data.cpu || [],
      cpuAvg: data.cpu?.length
        ? data.cpu.reduce((a: number, b: number) => a + b, 0) / data.cpu.length
        : 0,
      memory: {
        total: data.memory?.total || 0,
        used: data.memory?.used || 0,
        swapTotal: data.memory?.swap_total || 0,
        swapUsed: data.memory?.swap_used || 0,
      },
      disks: (data.disks || []).map((d: any) => ({
        name: d.name,
        available: d.available,
        total: d.total,
      })),
      network: (data.network || []).map((n: any) => ({
        interface: n.interface,
        rxBytes: n.rx_bytes,
        txBytes: n.tx_bytes,
        rxPackets: n.rx_packets,
        txPackets: n.tx_packets,
        rxErrors: n.rx_errors,
        txErrors: n.tx_errors,
      })),
      processes: (data.processes || []).map((p: any) => ({
        pid: p.pid,
        name: p.name,
        exe: p.exe,
        memory: p.memory,
        cpu: p.cpu,
      })),
      os: data.os,
      timestamp: Date.now(),
    };
  }

  /**
   * Parse the legacy text format from current Rust program
   * Format: "TYPE * field: value, ... | "
   */
  private parseLegacyFormat(line: string): Partial<ServerStats> | null {
    const stats: Partial<ServerStats> = { timestamp: Date.now() };

    // Split by " | " to get each metric block
    const blocks = line.split(' | ').filter(b => b.trim());

    for (const block of blocks) {
      const trimmed = block.trim();

      // CPU * Usage * Core 0: 5.00, Core 1: 3.00, ...
      if (trimmed.startsWith('CPU')) {
        const match = trimmed.match(/CPU \* Usage \* (.+)/);
        if (match) {
          const cores = match[1].split(', ').map(c => {
            const val = c.match(/Core \d+: ([\d.]+)/);
            return val ? parseFloat(val[1]) : 0;
          });
          stats.cpu = cores;
          stats.cpuAvg = cores.length ? cores.reduce((a, b) => a + b, 0) / cores.length : 0;
        }
      }

      // RAM * Usage * MemTotal: 16384MB, MemUsed: 8192MB, ...
      if (trimmed.startsWith('RAM')) {
        const total = trimmed.match(/MemTotal: (\d+)MB/);
        const used = trimmed.match(/MemUsed: (\d+)MB/);
        const swapTotal = trimmed.match(/SwapTotal: (\d+)MB/);
        const swapUsed = trimmed.match(/SwapUsed: (\d+)MB/);

        stats.memory = {
          total: total ? parseInt(total[1]) * 1024 * 1024 : 0,
          used: used ? parseInt(used[1]) * 1024 * 1024 : 0,
          swapTotal: swapTotal ? parseInt(swapTotal[1]) * 1024 * 1024 : 0,
          swapUsed: swapUsed ? parseInt(swapUsed[1]) * 1024 * 1024 : 0,
        };
      }

      // DISK * "sda1" * Capacity: 100GB/500GB
      if (trimmed.startsWith('DISK')) {
        if (!stats.disks) stats.disks = [];
        const match = trimmed.match(/DISK \* "?([^"*]+)"? \* Capacity: (\d+)GB\/(\d+)GB/);
        if (match) {
          stats.disks.push({
            name: match[1].trim(),
            available: parseInt(match[2]) * 1024 * 1024 * 1024,
            total: parseInt(match[3]) * 1024 * 1024 * 1024,
          });
        }
      }

      // NET * eth0 * Rcv: 1000B, Tx: 500B, ...
      if (trimmed.startsWith('NET')) {
        if (!stats.network) stats.network = [];
        const match = trimmed.match(/NET \* ([^ ]+) \* Rcv: (\d+)B, Tx: (\d+)B, Pkt Rcv: (\d+), Pkt Tx: (\d+), Err Rcv: (\d+), Err Tx: (\d+)/);
        if (match) {
          stats.network.push({
            interface: match[1],
            rxBytes: parseInt(match[2]),
            txBytes: parseInt(match[3]),
            rxPackets: parseInt(match[4]),
            txPackets: parseInt(match[5]),
            rxErrors: parseInt(match[6]),
            txErrors: parseInt(match[7]),
          });
        }
      }

      // PROCESS * PID: 123, Name: "app", ...
      if (trimmed.startsWith('PROCESS')) {
        if (!stats.processes) stats.processes = [];
        const match = trimmed.match(/PROCESS \* PID: (\d+), Name: "([^"]+)", Exe: "([^"]+)", Memory "(\d+)", CPU_Usage "([^"]+)"/);
        if (match) {
          stats.processes.push({
            pid: parseInt(match[1]),
            name: match[2],
            exe: match[3],
            memory: parseInt(match[4]),
            cpu: parseFloat(match[5]),
          });
        }
      }
    }

    // Only return if we got at least some data
    if (stats.cpu || stats.memory || stats.disks?.length) {
      return stats as ServerStats;
    }

    return null;
  }
}

// Singleton instance
export const serverStatsService = new ServerStatsService();
