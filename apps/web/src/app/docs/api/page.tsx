'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Terminal,
  Key,
  Code,
  Copy,
  Check,
  ChevronRight,
  Zap,
  Shield,
  Book,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = 'https://api.claudeterminal.com';

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  auth: boolean;
  requestBody?: object;
  responseBody?: object;
  example?: {
    curl: string;
    response: string;
  };
}

const endpoints: Record<string, Endpoint[]> = {
  'Authentication': [
    {
      method: 'POST',
      path: '/api/auth/register',
      description: 'Register a new user account',
      auth: false,
      requestBody: { email: 'user@example.com', password: 'securepassword', name: 'John Doe' },
      responseBody: { success: true, data: { user: { id: '...', email: '...' }, accessToken: '...', refreshToken: '...' } },
    },
    {
      method: 'POST',
      path: '/api/auth/login',
      description: 'Login with email and password',
      auth: false,
      requestBody: { email: 'user@example.com', password: 'securepassword' },
      responseBody: { success: true, data: { user: { id: '...', email: '...' }, accessToken: '...', refreshToken: '...' } },
    },
  ],
  'Terminals': [
    {
      method: 'GET',
      path: '/api/terminals',
      description: 'List all terminals for the authenticated user',
      auth: true,
      responseBody: { success: true, data: { terminals: [{ id: '...', name: 'Terminal 1', status: 'RUNNING' }], total: 1 } },
      example: {
        curl: `curl -X GET ${API_BASE}/api/terminals \\
  -H "Authorization: Bearer ct_live_xxx"`,
        response: `{
  "success": true,
  "data": {
    "terminals": [
      {
        "id": "clx123...",
        "name": "My Terminal",
        "status": "RUNNING",
        "cols": 120,
        "rows": 30,
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 1
  }
}`,
      },
    },
    {
      method: 'POST',
      path: '/api/terminals',
      description: 'Create a new terminal',
      auth: true,
      requestBody: { name: 'My Terminal', cols: 120, rows: 30, cwd: '/home/user' },
      responseBody: { success: true, data: { id: '...', name: 'My Terminal', status: 'STOPPED' } },
      example: {
        curl: `curl -X POST ${API_BASE}/api/terminals \\
  -H "Authorization: Bearer ct_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My Terminal", "cols": 120, "rows": 30}'`,
        response: `{
  "success": true,
  "data": {
    "id": "clx456...",
    "name": "My Terminal",
    "status": "STOPPED",
    "cols": 120,
    "rows": 30
  }
}`,
      },
    },
    {
      method: 'POST',
      path: '/api/terminals/:id/start',
      description: 'Start a terminal (spawn the shell process)',
      auth: true,
      responseBody: { success: true, data: { status: 'RUNNING', message: 'Terminal started' } },
    },
    {
      method: 'POST',
      path: '/api/terminals/:id/stop',
      description: 'Stop a terminal (kill the shell process)',
      auth: true,
      responseBody: { success: true, data: { status: 'STOPPED', message: 'Terminal stopped' } },
    },
    {
      method: 'POST',
      path: '/api/terminals/:id/write',
      description: 'Write input to a running terminal (fire and forget)',
      auth: true,
      requestBody: { input: 'ls -la\\n' },
      responseBody: { success: true, data: { message: 'Input sent to terminal' } },
    },
    {
      method: 'POST',
      path: '/api/terminals/:id/execute',
      description: 'Execute a command and return the output. Starts terminal if not running.',
      auth: true,
      requestBody: { command: 'ls -la', timeout: 30000, waitForPrompt: true },
      responseBody: { success: true, data: { command: 'ls -la', output: 'total 8\\n...', timedOut: false } },
      example: {
        curl: `curl -X POST ${API_BASE}/api/terminals/clx123/execute \\
  -H "Authorization: Bearer ct_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"command": "echo Hello World"}'`,
        response: `{
  "success": true,
  "data": {
    "command": "echo Hello World",
    "output": "echo Hello World\\nHello World\\n$ ",
    "timedOut": false
  }
}`,
      },
    },
    {
      method: 'GET',
      path: '/api/terminals/:id/output',
      description: 'Get the current output buffer of a terminal',
      auth: true,
      responseBody: { success: true, data: { output: '...', isRunning: true } },
    },
    {
      method: 'GET',
      path: '/api/terminals/:id',
      description: 'Get a specific terminal by ID',
      auth: true,
      responseBody: { success: true, data: { id: '...', name: 'Terminal', status: 'RUNNING' } },
    },
    {
      method: 'PATCH',
      path: '/api/terminals/:id',
      description: 'Update terminal properties',
      auth: true,
      requestBody: { name: 'Updated Name', cols: 150, rows: 40 },
      responseBody: { success: true, data: { id: '...', name: 'Updated Name' } },
    },
    {
      method: 'DELETE',
      path: '/api/terminals/:id',
      description: 'Delete a terminal',
      auth: true,
      responseBody: { success: true },
    },
  ],
  'Categories': [
    {
      method: 'GET',
      path: '/api/categories',
      description: 'List all categories',
      auth: true,
      responseBody: { success: true, data: { categories: [{ id: '...', name: 'Work', color: '#6366f1' }] } },
    },
    {
      method: 'POST',
      path: '/api/categories',
      description: 'Create a new category',
      auth: true,
      requestBody: { name: 'Work', color: '#6366f1', icon: 'folder' },
    },
    {
      method: 'PATCH',
      path: '/api/categories/:id',
      description: 'Update a category',
      auth: true,
      requestBody: { name: 'Updated', color: '#ef4444' },
    },
    {
      method: 'DELETE',
      path: '/api/categories/:id',
      description: 'Delete a category',
      auth: true,
    },
  ],
  'Snippets': [
    {
      method: 'GET',
      path: '/api/snippets',
      description: 'List all saved command snippets',
      auth: true,
    },
    {
      method: 'POST',
      path: '/api/snippets',
      description: 'Create a new snippet',
      auth: true,
      requestBody: { name: 'Git Status', command: 'git status', description: 'Check git status', tags: ['git'] },
    },
    {
      method: 'POST',
      path: '/api/snippets/:id/use',
      description: 'Increment usage count for a snippet',
      auth: true,
    },
  ],
  'API Keys': [
    {
      method: 'GET',
      path: '/api/apikeys',
      description: 'List all API keys (key values are masked)',
      auth: true,
    },
    {
      method: 'POST',
      path: '/api/apikeys',
      description: 'Create a new API key',
      auth: true,
      requestBody: { name: 'My API Key', permissions: ['read', 'write'], expiresIn: 30 },
      responseBody: { success: true, data: { apiKey: { id: '...', key: 'ct_live_xxx...', keyPrefix: 'ct_live_xxx' }, warning: 'Save this key now' } },
    },
    {
      method: 'DELETE',
      path: '/api/apikeys/:id',
      description: 'Revoke an API key',
      auth: true,
    },
  ],
};

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-500/10 text-green-600 border-green-500/30',
  POST: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  PATCH: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  DELETE: 'bg-red-500/10 text-red-600 border-red-500/30',
};

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState('Authentication');
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/api-keys" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-2">
              <Terminal className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">Termify API</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/api-keys">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
                <Key size={16} />
                Get API Key
              </button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 border-r border-border p-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto hidden lg:block">
          <nav className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Getting Started
              </h3>
              <ul className="space-y-1">
                <li>
                  <a href="#introduction" className="block px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
                    Introduction
                  </a>
                </li>
                <li>
                  <a href="#authentication" className="block px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
                    Authentication
                  </a>
                </li>
                <li>
                  <a href="#rate-limits" className="block px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors">
                    Rate Limits
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                API Reference
              </h3>
              <ul className="space-y-1">
                {Object.keys(endpoints).map((section) => (
                  <li key={section}>
                    <button
                      onClick={() => setActiveSection(section)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                        activeSection === section
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted'
                      )}
                    >
                      {section}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 max-w-4xl">
          {/* Introduction */}
          <section id="introduction" className="mb-12">
            <h1 className="text-4xl font-bold mb-4">Termify API</h1>
            <p className="text-lg text-muted-foreground mb-6">
              The Termify API allows you to programmatically create, manage, and interact with terminal sessions.
              Use this API to integrate terminal functionality into your applications, automate workflows, or build custom tools.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="p-4 rounded-xl border border-border bg-card">
                <Zap className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">Fast & Reliable</h3>
                <p className="text-sm text-muted-foreground">
                  Low-latency API with 99.9% uptime SLA
                </p>
              </div>
              <div className="p-4 rounded-xl border border-border bg-card">
                <Shield className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">Secure</h3>
                <p className="text-sm text-muted-foreground">
                  API key authentication with fine-grained permissions
                </p>
              </div>
              <div className="p-4 rounded-xl border border-border bg-card">
                <Book className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-1">Well Documented</h3>
                <p className="text-sm text-muted-foreground">
                  Comprehensive docs with examples
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/50 border border-border">
              <h3 className="font-semibold mb-2">Base URL</h3>
              <code className="text-sm font-mono text-primary">{API_BASE}</code>
            </div>
          </section>

          {/* Authentication */}
          <section id="authentication" className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Authentication</h2>
            <p className="text-muted-foreground mb-4">
              All API requests must include an API key in the Authorization header. You can create and manage API keys
              from your <Link href="/api-keys" className="text-primary hover:underline">API Keys dashboard</Link>.
            </p>

            <div className="p-4 rounded-xl bg-card border border-border mb-4">
              <h4 className="text-sm font-medium mb-2">Request Header</h4>
              <pre className="text-sm font-mono bg-muted p-3 rounded-lg overflow-x-auto">
                Authorization: Bearer ct_live_your_api_key_here
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/30">
              <h4 className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-2">
                ⚠️ Keep your API keys secure
              </h4>
              <p className="text-sm text-muted-foreground">
                Never share your API keys in publicly accessible areas such as GitHub, client-side code, or public forums.
              </p>
            </div>
          </section>

          {/* Rate Limits */}
          <section id="rate-limits" className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Rate Limits</h2>
            <p className="text-muted-foreground mb-4">
              API requests are rate limited to ensure fair usage and service stability.
            </p>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium">Plan</th>
                  <th className="text-left py-3 px-4 font-medium">Requests/minute</th>
                  <th className="text-left py-3 px-4 font-medium">Requests/day</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-3 px-4">Free</td>
                  <td className="py-3 px-4">60</td>
                  <td className="py-3 px-4">1,000</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-3 px-4">Pro</td>
                  <td className="py-3 px-4">300</td>
                  <td className="py-3 px-4">10,000</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Enterprise</td>
                  <td className="py-3 px-4">1,000</td>
                  <td className="py-3 px-4">Unlimited</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Endpoints */}
          <section>
            <h2 className="text-2xl font-bold mb-6">{activeSection}</h2>

            <div className="space-y-4">
              {endpoints[activeSection]?.map((endpoint, index) => {
                const endpointId = `${activeSection}-${index}`;
                const isExpanded = expandedEndpoint === endpointId;

                return (
                  <div
                    key={endpointId}
                    className="rounded-xl border border-border overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedEndpoint(isExpanded ? null : endpointId)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <span className={cn(
                        'px-2 py-1 rounded text-xs font-bold uppercase border',
                        METHOD_COLORS[endpoint.method]
                      )}>
                        {endpoint.method}
                      </span>
                      <code className="font-mono text-sm flex-1 text-left">{endpoint.path}</code>
                      {endpoint.auth && (
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                          Auth
                        </span>
                      )}
                      <ChevronRight className={cn(
                        'h-5 w-5 transition-transform',
                        isExpanded && 'rotate-90'
                      )} />
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border p-4 space-y-4 bg-muted/20">
                        <p className="text-muted-foreground">{endpoint.description}</p>

                        {endpoint.requestBody && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Request Body</h4>
                            <pre className="text-sm font-mono bg-card p-3 rounded-lg overflow-x-auto border">
                              {JSON.stringify(endpoint.requestBody, null, 2)}
                            </pre>
                          </div>
                        )}

                        {endpoint.responseBody && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Response</h4>
                            <pre className="text-sm font-mono bg-card p-3 rounded-lg overflow-x-auto border">
                              {JSON.stringify(endpoint.responseBody, null, 2)}
                            </pre>
                          </div>
                        )}

                        {endpoint.example && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Example</h4>
                            <div className="relative">
                              <pre className="text-sm font-mono bg-card p-3 rounded-lg overflow-x-auto border">
                                {endpoint.example.curl}
                              </pre>
                              <button
                                onClick={() => copyCode(endpoint.example!.curl, `curl-${endpointId}`)}
                                className="absolute top-2 right-2 p-1.5 rounded hover:bg-muted"
                              >
                                {copiedCode === `curl-${endpointId}` ? (
                                  <Check size={14} className="text-green-500" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                            </div>
                            <h4 className="text-sm font-medium mb-2 mt-4">Response</h4>
                            <pre className="text-sm font-mono bg-card p-3 rounded-lg overflow-x-auto border">
                              {endpoint.example.response}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
