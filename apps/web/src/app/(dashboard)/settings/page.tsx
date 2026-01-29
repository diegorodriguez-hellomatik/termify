'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  User,
  Key,
  Bell,
  Palette,
  Keyboard,
  Download,
  Upload,
  Terminal,
  LayoutGrid,
  Code,
  FileJson,
  Check,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTheme, ViewMode } from '@/context/ThemeContext';
import { terminalThemes } from '@/lib/terminal-themes';
import { snippetsApi, profilesApi } from '@/lib/api';
import { ActivityLog } from '@/components/settings/ActivityLog';
import { EnvironmentVariablesManager } from '@/components/settings/EnvironmentVariablesManager';
import { cn } from '@/lib/utils';

const KEYBOARD_SHORTCUTS = [
  { key: 'Ctrl+N', action: 'Create new terminal' },
  { key: 'Ctrl+K', action: 'Open quick switcher' },
  { key: 'Ctrl+F', action: 'Focus search' },
  { key: 'Ctrl+,', action: 'Open settings' },
  { key: '?', action: 'Show keyboard shortcuts' },
  { key: 'Escape', action: 'Close modals' },
];

const VIEW_MODES: { value: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'compact', label: 'Compact', icon: Terminal },
  { value: 'list', label: 'List', icon: Code },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const { isDark, terminalTheme, setTerminalTheme, viewMode, setViewMode } = useTheme();
  const [name, setName] = useState(session?.user?.name || '');
  const [cols, setCols] = useState(120);
  const [rows, setRows] = useState(30);
  const [cwd, setCwd] = useState('~');
  const [exportData, setExportData] = useState('');
  const [importData, setImportData] = useState('');
  const [copied, setCopied] = useState(false);

  // Export configuration
  const handleExport = useCallback(async () => {
    if (!session?.accessToken) return;

    try {
      const [snippetsRes, profilesRes] = await Promise.all([
        snippetsApi.list(session.accessToken),
        profilesApi.list(session.accessToken),
      ]);

      const data = {
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: {
          terminalTheme,
          viewMode,
          defaultCols: cols,
          defaultRows: rows,
          defaultCwd: cwd,
        },
        snippets: snippetsRes.success ? snippetsRes.data?.snippets : [],
        profiles: profilesRes.success ? profilesRes.data?.profiles : [],
      };

      const json = JSON.stringify(data, null, 2);
      setExportData(json);

      // Also trigger download
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `termify-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export:', error);
    }
  }, [session?.accessToken, terminalTheme, viewMode, cols, rows, cwd]);

  // Import configuration
  const handleImport = useCallback(async () => {
    if (!session?.accessToken || !importData) return;

    try {
      const data = JSON.parse(importData);

      // Apply settings
      if (data.settings) {
        if (data.settings.terminalTheme) {
          setTerminalTheme(data.settings.terminalTheme);
        }
        if (data.settings.viewMode) {
          setViewMode(data.settings.viewMode);
        }
        if (data.settings.defaultCols) {
          setCols(data.settings.defaultCols);
        }
        if (data.settings.defaultRows) {
          setRows(data.settings.defaultRows);
        }
        if (data.settings.defaultCwd) {
          setCwd(data.settings.defaultCwd);
        }
      }

      // Import snippets
      if (data.snippets && Array.isArray(data.snippets)) {
        for (const snippet of data.snippets) {
          await snippetsApi.create(
            {
              name: snippet.name,
              command: snippet.command,
              description: snippet.description,
              category: snippet.category,
              tags: snippet.tags,
            },
            session.accessToken
          );
        }
      }

      // Import profiles
      if (data.profiles && Array.isArray(data.profiles)) {
        for (const profile of data.profiles) {
          await profilesApi.create(
            {
              name: profile.name,
              icon: profile.icon,
              color: profile.color,
              description: profile.description,
              cols: profile.cols,
              rows: profile.rows,
              cwd: profile.cwd,
              shell: profile.shell,
              env: profile.env,
              initCommands: profile.initCommands,
              isDefault: false, // Don't override default
            },
            session.accessToken
          );
        }
      }

      setImportData('');
      alert('Configuration imported successfully!');
    } catch (error) {
      console.error('Failed to import:', error);
      alert('Failed to import configuration. Please check the JSON format.');
    }
  }, [session?.accessToken, importData, setTerminalTheme, setViewMode]);

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <Card id="profile" className="scroll-mt-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Profile</CardTitle>
                <CardDescription>
                  Manage your personal information
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={session?.user?.email || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Terminal Theme */}
        <Card id="terminal-theme" className="scroll-mt-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Palette className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Terminal Theme</CardTitle>
                <CardDescription>
                  Choose your preferred terminal color scheme
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.keys(terminalThemes).map((themeName) => {
                const theme = terminalThemes[themeName];
                return (
                  <button
                    key={themeName}
                    onClick={() => setTerminalTheme(themeName)}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all text-left',
                      terminalTheme === themeName
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50'
                    )}
                    style={{ backgroundColor: theme.background }}
                  >
                    <div className="text-sm font-medium mb-2" style={{ color: theme.foreground }}>
                      {themeName}
                    </div>
                    <div className="flex gap-1">
                      {[theme.red, theme.green, theme.blue, theme.yellow, theme.cyan, theme.magenta].map(
                        (color, i) => (
                          <div
                            key={i}
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        )
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* View Mode */}
        <Card id="view-mode" className="scroll-mt-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <LayoutGrid className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Default View Mode</CardTitle>
                <CardDescription>
                  Choose how terminals are displayed on the dashboard
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {VIEW_MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.value}
                    onClick={() => setViewMode(mode.value)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all',
                      viewMode === mode.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <Icon size={18} />
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Terminal Defaults */}
        <Card id="terminal-defaults" className="scroll-mt-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Terminal className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Terminal Defaults</CardTitle>
                <CardDescription>
                  Default settings for new terminals
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Columns</label>
                <Input
                  type="number"
                  value={cols}
                  onChange={(e) => setCols(parseInt(e.target.value) || 120)}
                  min={40}
                  max={500}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rows</label>
                <Input
                  type="number"
                  value={rows}
                  onChange={(e) => setRows(parseInt(e.target.value) || 30)}
                  min={10}
                  max={200}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Working Directory</label>
                <Input
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  placeholder="~"
                />
              </div>
            </div>
            <Button>Save Defaults</Button>
          </CardContent>
        </Card>

        {/* Environment Variables */}
        <Card>
          <CardContent className="pt-6">
            <EnvironmentVariablesManager />
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card id="keyboard-shortcuts" className="scroll-mt-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Keyboard className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Keyboard Shortcuts</CardTitle>
                <CardDescription>
                  Quick reference for keyboard shortcuts
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {KEYBOARD_SHORTCUTS.map((shortcut) => (
                <div
                  key={shortcut.key}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <span className="text-sm">{shortcut.action}</span>
                  <kbd
                    className={cn(
                      'px-2 py-1 rounded text-xs font-mono',
                      isDark ? 'bg-white/10' : 'bg-black/5'
                    )}
                  >
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Import/Export */}
        <Card id="import-export" className="scroll-mt-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileJson className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Import / Export</CardTitle>
                <CardDescription>
                  Backup or restore your settings, snippets, and profiles
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Export */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Export Configuration</h4>
                  <p className="text-sm text-muted-foreground">
                    Download your settings, snippets, and profiles as JSON
                  </p>
                </div>
                <Button onClick={handleExport} variant="outline">
                  <Download size={16} className="mr-2" />
                  Export
                </Button>
              </div>
              {exportData && (
                <div className="relative">
                  <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-40">
                    {exportData}
                  </pre>
                  <button
                    onClick={handleCopyExport}
                    className="absolute top-2 right-2 p-1.5 bg-background rounded hover:bg-muted"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-border" />

            {/* Import */}
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Import Configuration</h4>
                <p className="text-sm text-muted-foreground">
                  Paste a previously exported JSON configuration
                </p>
              </div>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste JSON configuration here..."
                rows={4}
                className="w-full px-3 py-2 bg-muted rounded text-sm font-mono"
              />
              <Button onClick={handleImport} disabled={!importData} variant="outline">
                <Upload size={16} className="mr-2" />
                Import
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card>
          <CardContent className="pt-6">
            <ActivityLog />
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card id="notifications" className="scroll-mt-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>
                  Configure notification preferences for browser and desktop alerts
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Enable Browser Notifications */}
              <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Browser Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Allow Termify to send you desktop notifications
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if ('Notification' in window) {
                        Notification.requestPermission().then((permission) => {
                          if (permission === 'granted') {
                            new Notification('Notifications Enabled', {
                              body: 'You will now receive notifications from Termify',
                              icon: '/favicon.ico',
                            });
                          }
                        });
                      }
                    }}
                  >
                    Enable
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Terminal Events</h4>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">Task Completed</p>
                    <p className="text-sm text-muted-foreground">
                      Notify when a terminal finishes a long-running task (Claude Code, builds, etc.)
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">Terminal Started</p>
                    <p className="text-sm text-muted-foreground">
                      Notify when a terminal successfully starts
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">Terminal Crashed</p>
                    <p className="text-sm text-muted-foreground">
                      Notify when a terminal unexpectedly crashes or stops
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">Command Completed</p>
                    <p className="text-sm text-muted-foreground">
                      Notify when a command finishes execution (after idle for 3 seconds)
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Other Notifications</h4>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">Shared Terminal Activity</p>
                    <p className="text-sm text-muted-foreground">
                      Notify when someone joins or leaves a shared terminal
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">Usage Alerts</p>
                    <p className="text-sm text-muted-foreground">
                      Notify when approaching usage limits
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions for your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete All Terminals</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete all your terminals
                </p>
              </div>
              <Button variant="destructive" size="sm">
                Delete All
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all data
                </p>
              </div>
              <Button variant="destructive" size="sm">
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
