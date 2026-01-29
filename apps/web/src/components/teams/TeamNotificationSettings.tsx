'use client';

import { Bell, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTeamNotificationPrefs } from '@/hooks/useTeamPresence';

interface TeamNotificationSettingsProps {
  teamId: string;
}

export function TeamNotificationSettings({ teamId }: TeamNotificationSettingsProps) {
  const { prefs, loading, error, updatePrefs } = useTeamNotificationPrefs(teamId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Terminal Notifications
          </CardTitle>
          <CardDescription>
            Configure notifications for terminal events in this team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Terminal Errors</label>
              <p className="text-sm text-muted-foreground">
                Get notified when a command fails with an error.
              </p>
            </div>
            <button
              onClick={() => updatePrefs({ terminalErrors: !prefs?.terminalErrors })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                prefs?.terminalErrors ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  prefs?.terminalErrors ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Long Running Commands</label>
              <p className="text-sm text-muted-foreground">
                Get notified when a command takes longer than expected.
              </p>
            </div>
            <button
              onClick={() => updatePrefs({ longCommands: !prefs?.longCommands })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                prefs?.longCommands ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  prefs?.longCommands ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {prefs?.longCommands && (
            <div className="ml-4 pl-4 border-l">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium whitespace-nowrap">
                  Threshold (seconds)
                </label>
                <Input
                  type="number"
                  min={10}
                  max={3600}
                  value={prefs?.longCommandThreshold ?? 300}
                  onChange={(e) =>
                    updatePrefs({ longCommandThreshold: parseInt(e.target.value, 10) })
                  }
                  className="w-24"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task Notifications</CardTitle>
          <CardDescription>
            Configure notifications for task-related events.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Task Mentions</label>
              <p className="text-sm text-muted-foreground">
                Get notified when you are mentioned in a task.
              </p>
            </div>
            <button
              onClick={() => updatePrefs({ taskMentions: !prefs?.taskMentions })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                prefs?.taskMentions ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  prefs?.taskMentions ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Server Notifications</CardTitle>
          <CardDescription>
            Configure notifications for server status changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Server Status Changes</label>
              <p className="text-sm text-muted-foreground">
                Get notified when a team server goes online or offline.
              </p>
            </div>
            <button
              onClick={() => updatePrefs({ serverStatus: !prefs?.serverStatus })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                prefs?.serverStatus ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  prefs?.serverStatus ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
