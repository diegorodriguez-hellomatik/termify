import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { createReadStream } from 'fs';
import { authMiddleware } from '../auth/middleware.js';
import { SSHManager } from '../ssh/SSHManager.js';

const router = Router();

// Apply auth middleware
router.use(authMiddleware);

interface ClaudeSession {
  id: string;
  projectPath: string;
  projectName: string;
  lastModified: Date;
  messageCount: number;
  firstMessage?: string;
  cwd?: string;
}

interface ClaudeProject {
  path: string;
  name: string;
  sessions: ClaudeSession[];
}

/**
 * Get Claude Code sessions directory
 */
function getClaudeSessionsDir(): string {
  return path.join(os.homedir(), '.claude', 'projects');
}

/**
 * Parse a session JSONL file to extract metadata
 */
async function parseSessionMetadata(sessionPath: string): Promise<Partial<ClaudeSession> | null> {
  try {
    const stats = await fs.stat(sessionPath);

    return new Promise((resolve) => {
      let messageCount = 0;
      let firstUserMessage: string | undefined;
      let cwd: string | undefined;
      let sessionId: string | undefined;

      const rl = readline.createInterface({
        input: createReadStream(sessionPath),
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        try {
          const data = JSON.parse(line);

          // Get session ID and cwd from first user message
          if (data.type === 'user' && !sessionId) {
            sessionId = data.sessionId;
            cwd = data.cwd;
            if (data.message?.content) {
              firstUserMessage = typeof data.message.content === 'string'
                ? data.message.content.slice(0, 200)
                : JSON.stringify(data.message.content).slice(0, 200);
            }
          }

          // Count messages
          if (data.type === 'user' || (data.message?.role === 'user')) {
            messageCount++;
          }
        } catch {
          // Skip invalid JSON lines
        }
      });

      rl.on('close', () => {
        resolve({
          messageCount,
          firstMessage: firstUserMessage,
          cwd,
          lastModified: stats.mtime,
        });
      });

      rl.on('error', () => {
        resolve(null);
      });

      // Timeout after 5 seconds to prevent hanging on large files
      setTimeout(() => {
        rl.close();
      }, 5000);
    });
  } catch {
    return null;
  }
}

/**
 * GET /api/claude-sessions
 * List all Claude Code projects and their sessions
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const sessionsDir = getClaudeSessionsDir();

    // Check if Claude sessions directory exists
    try {
      await fs.access(sessionsDir);
    } catch {
      res.json({
        success: true,
        data: {
          projects: [],
          message: 'No Claude Code sessions found. Make sure Claude Code is installed.',
        },
      });
      return;
    }

    const projectDirs = await fs.readdir(sessionsDir, { withFileTypes: true });
    const projects: ClaudeProject[] = [];

    for (const dir of projectDirs) {
      if (!dir.isDirectory() || dir.name.startsWith('.')) continue;

      const projectPath = path.join(sessionsDir, dir.name);
      const projectName = dir.name.replace(/-/g, '/').replace(/^\//, '');

      const projectFiles = await fs.readdir(projectPath, { withFileTypes: true });
      const sessions: ClaudeSession[] = [];

      for (const file of projectFiles) {
        if (!file.isFile() || !file.name.endsWith('.jsonl')) continue;

        const sessionId = file.name.replace('.jsonl', '');
        const sessionPath = path.join(projectPath, file.name);

        const metadata = await parseSessionMetadata(sessionPath);

        if (metadata) {
          sessions.push({
            id: sessionId,
            projectPath: dir.name,
            projectName,
            lastModified: metadata.lastModified || new Date(),
            messageCount: metadata.messageCount || 0,
            firstMessage: metadata.firstMessage,
            cwd: metadata.cwd,
          });
        }
      }

      // Sort sessions by last modified, most recent first
      sessions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

      if (sessions.length > 0) {
        projects.push({
          path: dir.name,
          name: projectName,
          sessions,
        });
      }
    }

    // Sort projects by most recent session
    projects.sort((a, b) => {
      const aLatest = a.sessions[0]?.lastModified.getTime() || 0;
      const bLatest = b.sessions[0]?.lastModified.getTime() || 0;
      return bLatest - aLatest;
    });

    res.json({
      success: true,
      data: {
        projects,
        totalProjects: projects.length,
        totalSessions: projects.reduce((sum, p) => sum + p.sessions.length, 0),
      },
    });
  } catch (error) {
    console.error('[API] Error listing Claude sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to list Claude sessions' });
  }
});

/**
 * GET /api/claude-sessions/:projectPath/:sessionId
 * Get details of a specific session
 */
router.get('/:projectPath/:sessionId', async (req: Request, res: Response) => {
  try {
    const projectPath = req.params.projectPath as string;
    const sessionId = req.params.sessionId as string;
    const sessionsDir = getClaudeSessionsDir();
    const sessionFile = path.join(sessionsDir, projectPath, `${sessionId}.jsonl`);

    try {
      await fs.access(sessionFile);
    } catch {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    const stats = await fs.stat(sessionFile);
    const messages: any[] = [];

    const rl = readline.createInterface({
      input: createReadStream(sessionFile),
      crlfDelay: Infinity
    });

    let cwd: string | undefined;

    for await (const line of rl) {
      try {
        const data = JSON.parse(line);

        // Get cwd from first user message
        if (data.type === 'user' && !cwd) {
          cwd = data.cwd;
        }

        // Only include user and assistant messages
        if (data.type === 'user' || data.message?.role === 'assistant') {
          messages.push({
            type: data.type || data.message?.role,
            content: data.message?.content,
            timestamp: data.timestamp,
          });
        }
      } catch {
        // Skip invalid JSON
      }
    }

    const projectName = projectPath.replace(/-/g, '/').replace(/^\//, '');

    res.json({
      success: true,
      data: {
        id: sessionId,
        projectPath,
        projectName,
        cwd,
        lastModified: stats.mtime,
        fileSize: stats.size,
        messageCount: messages.length,
        messages: messages.slice(0, 50), // Limit to first 50 messages for preview
      },
    });
  } catch (error) {
    console.error('[API] Error getting Claude session:', error);
    res.status(500).json({ success: false, error: 'Failed to get Claude session' });
  }
});

/**
 * GET /api/claude-sessions/current
 * Get the current/most recent active session
 */
router.get('/current', async (req: Request, res: Response) => {
  try {
    const sessionsDir = getClaudeSessionsDir();

    try {
      await fs.access(sessionsDir);
    } catch {
      res.json({
        success: true,
        data: null,
        message: 'No Claude Code sessions found',
      });
      return;
    }

    const projectDirs = await fs.readdir(sessionsDir, { withFileTypes: true });
    let mostRecent: { session: ClaudeSession; projectPath: string } | null = null;

    for (const dir of projectDirs) {
      if (!dir.isDirectory() || dir.name.startsWith('.')) continue;

      const projectPath = path.join(sessionsDir, dir.name);
      const projectFiles = await fs.readdir(projectPath, { withFileTypes: true });

      for (const file of projectFiles) {
        if (!file.isFile() || !file.name.endsWith('.jsonl')) continue;

        const sessionPath = path.join(projectPath, file.name);
        const stats = await fs.stat(sessionPath);

        if (!mostRecent || stats.mtime > mostRecent.session.lastModified) {
          mostRecent = {
            session: {
              id: file.name.replace('.jsonl', ''),
              projectPath: dir.name,
              projectName: dir.name.replace(/-/g, '/').replace(/^\//, ''),
              lastModified: stats.mtime,
              messageCount: 0,
            },
            projectPath: dir.name,
          };
        }
      }
    }

    if (mostRecent) {
      // Get additional metadata for the most recent session
      const sessionPath = path.join(sessionsDir, mostRecent.projectPath, `${mostRecent.session.id}.jsonl`);
      const metadata = await parseSessionMetadata(sessionPath);

      if (metadata) {
        mostRecent.session.messageCount = metadata.messageCount || 0;
        mostRecent.session.firstMessage = metadata.firstMessage;
        mostRecent.session.cwd = metadata.cwd;
      }
    }

    res.json({
      success: true,
      data: mostRecent?.session || null,
    });
  } catch (error) {
    console.error('[API] Error getting current Claude session:', error);
    res.status(500).json({ success: false, error: 'Failed to get current session' });
  }
});

/**
 * POST /api/claude-sessions/remote
 * List Claude Code sessions from a remote server via SSH
 */
router.post('/remote', async (req: Request, res: Response) => {
  try {
    const { host, port = 22, username, password, privateKey } = req.body;

    if (!host || !username) {
      res.status(400).json({ success: false, error: 'Host and username are required' });
      return;
    }

    if (!password && !privateKey) {
      res.status(400).json({ success: false, error: 'Password or private key is required' });
      return;
    }

    const sshManager = SSHManager.getInstance();

    // First, get the home directory on the remote server
    const homeResult = await sshManager.executeCommand(
      { host, port, username, password, privateKey },
      'echo $HOME'
    );

    if (!homeResult.success || !homeResult.output) {
      res.status(500).json({ success: false, error: homeResult.error || 'Failed to get home directory' });
      return;
    }

    const remoteHome = homeResult.output.trim();
    const remoteSessionsDir = `${remoteHome}/.claude/projects`;

    // Check if Claude sessions directory exists
    const checkDirResult = await sshManager.executeCommand(
      { host, port, username, password, privateKey },
      `test -d "${remoteSessionsDir}" && echo "exists" || echo "not_found"`
    );

    if (checkDirResult.output?.trim() !== 'exists') {
      res.json({
        success: true,
        data: {
          projects: [],
          totalProjects: 0,
          totalSessions: 0,
          message: 'No Claude Code sessions found on remote server.',
        },
      });
      return;
    }

    // List project directories and their session files
    const listCommand = `find "${remoteSessionsDir}" -name "*.jsonl" -type f -exec stat --format='%Y|%n' {} \\; 2>/dev/null || find "${remoteSessionsDir}" -name "*.jsonl" -type f -exec stat -f '%m|%N' {} \\; 2>/dev/null`;

    const listResult = await sshManager.executeCommand(
      { host, port, username, password, privateKey },
      listCommand,
      60000 // 60 second timeout for large directories
    );

    if (!listResult.success) {
      // Try alternative command for macOS
      const altCommand = `cd "${remoteSessionsDir}" && for dir in */; do if [ -d "$dir" ]; then for f in "$dir"*.jsonl; do if [ -f "$f" ]; then stat -f '%m|%N' "$f" 2>/dev/null; fi; done; fi; done`;
      const altResult = await sshManager.executeCommand(
        { host, port, username, password, privateKey },
        altCommand,
        60000
      );

      if (!altResult.success || !altResult.output) {
        res.json({
          success: true,
          data: {
            projects: [],
            totalProjects: 0,
            totalSessions: 0,
            message: 'No Claude Code sessions found or unable to read.',
          },
        });
        return;
      }

      listResult.output = altResult.output;
    }

    // Parse the file list
    const projectsMap = new Map<string, ClaudeProject>();
    const lines = listResult.output?.split('\n').filter(Boolean) || [];

    for (const line of lines) {
      const [timestamp, filePath] = line.split('|');
      if (!filePath || !filePath.endsWith('.jsonl')) continue;

      // Extract project path and session ID from file path
      const relativePath = filePath.replace(remoteSessionsDir + '/', '');
      const parts = relativePath.split('/');
      if (parts.length !== 2) continue;

      const [projectDir, sessionFile] = parts;
      const sessionId = sessionFile.replace('.jsonl', '');
      const projectName = projectDir.replace(/-/g, '/').replace(/^\//, '');

      const session: ClaudeSession = {
        id: sessionId,
        projectPath: projectDir,
        projectName,
        lastModified: new Date(parseInt(timestamp) * 1000),
        messageCount: 0, // We'll get this via a separate call if needed
        cwd: remoteHome,
      };

      if (!projectsMap.has(projectDir)) {
        projectsMap.set(projectDir, {
          path: projectDir,
          name: projectName,
          sessions: [],
        });
      }

      projectsMap.get(projectDir)!.sessions.push(session);
    }

    // Get first message preview for each session (limited to first 3 per project)
    for (const project of projectsMap.values()) {
      // Sort sessions by last modified, most recent first
      project.sessions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

      // Get preview for first 3 sessions
      for (const session of project.sessions.slice(0, 3)) {
        const sessionFile = `${remoteSessionsDir}/${session.projectPath}/${session.id}.jsonl`;
        const previewResult = await sshManager.executeCommand(
          { host, port, username, password, privateKey },
          `head -n 20 "${sessionFile}" 2>/dev/null | grep -o '"content":"[^"]*"' | head -1 | cut -d'"' -f4 | cut -c1-200`
        );

        if (previewResult.success && previewResult.output) {
          session.firstMessage = previewResult.output.trim() || 'No preview available';
        }

        // Get message count
        const countResult = await sshManager.executeCommand(
          { host, port, username, password, privateKey },
          `wc -l < "${sessionFile}" 2>/dev/null`
        );

        if (countResult.success && countResult.output) {
          session.messageCount = Math.ceil(parseInt(countResult.output.trim()) / 2) || 0;
        }
      }
    }

    const projects = Array.from(projectsMap.values());

    // Sort projects by most recent session
    projects.sort((a, b) => {
      const aLatest = a.sessions[0]?.lastModified.getTime() || 0;
      const bLatest = b.sessions[0]?.lastModified.getTime() || 0;
      return bLatest - aLatest;
    });

    res.json({
      success: true,
      data: {
        projects,
        totalProjects: projects.length,
        totalSessions: projects.reduce((sum, p) => sum + p.sessions.length, 0),
      },
    });
  } catch (error) {
    console.error('[API] Error listing remote Claude sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to list remote Claude sessions' });
  }
});

export default router;
