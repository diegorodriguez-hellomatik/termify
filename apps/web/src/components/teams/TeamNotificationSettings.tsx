'use client';

import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useTeamNotificationPrefs } from '@/hooks/useTeamPresence';

interface TeamNotificationSettingsProps {
  teamId: string;
}

export function TeamNotificationSettings({ teamId }: TeamNotificationSettingsProps) {
  const { prefs, loading, error, updatePrefs } = useTeamNotificationPrefs(teamId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Terminal Errors */}
      <div className="flex items-center justify-between py-2">
        <div className="space-y-0.5">
          <label className="text-sm font-medium">Terminal Errors</label>
          <p className="text-xs text-muted-foreground">
            Notify when a command fails with an error.
          </p>
        </div>
        <Toggle
          checked={prefs?.terminalErrors ?? true}
          onChange={() => updatePrefs({ terminalErrors: !prefs?.terminalErrors })}
        />
      </div>

      {/* Long Running Commands */}
      <div className="flex items-center justify-between py-2">
        <div className="space-y-0.5">
          <label className="text-sm font-medium">Long Running Commands</label>
          <p className="text-xs text-muted-foreground">
            Notify when a command exceeds threshold.
          </p>
        </div>
        <Toggle
          checked={prefs?.longCommands ?? true}
          onChange={() => updatePrefs({ longCommands: !prefs?.longCommands })}
        />
      </div>

      {prefs?.longCommands && (
        <div className="flex items-center gap-3 pl-4 border-l ml-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">
            Threshold
          </label>
          <Input
            type="number"
            min={10}
            max={3600}
            value={prefs?.longCommandThreshold ?? 300}
            onChange={(e) =>
              updatePrefs({ longCommandThreshold: parseInt(e.target.value, 10) })
            }
            className="w-20 h-8"
          />
          <span className="text-xs text-muted-foreground">seconds</span>
        </div>
      )}

      {/* Task Mentions */}
      <div className="flex items-center justify-between py-2">
        <div className="space-y-0.5">
          <label className="text-sm font-medium">Task Mentions</label>
          <p className="text-xs text-muted-foreground">
            Notify when mentioned in a task.
          </p>
        </div>
        <Toggle
          checked={prefs?.taskMentions ?? true}
          onChange={() => updatePrefs({ taskMentions: !prefs?.taskMentions })}
        />
      </div>

      {/* Server Status */}
      <div className="flex items-center justify-between py-2">
        <div className="space-y-0.5">
          <label className="text-sm font-medium">Server Status</label>
          <p className="text-xs text-muted-foreground">
            Notify when servers go online/offline.
          </p>
        </div>
        <Toggle
          checked={prefs?.serverStatus ?? true}
          onChange={() => updatePrefs({ serverStatus: !prefs?.serverStatus })}
        />
      </div>
    </div>
  );
}

// Simple Toggle Component
interface ToggleProps {
  checked: boolean;
  onChange: () => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
