'use client';

import { useState } from 'react';
import {
  Bell,
  BellOff,
  Check,
  AlertCircle,
  Loader2,
  Send,
  Terminal,
  Wifi,
  WifiOff,
  Users,
  Share2,
  CheckCircle2,
} from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { PushPreferences } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PushNotificationsSettingsProps {
  token: string | null;
}

interface ToggleProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

function Toggle({ label, description, icon, enabled, onChange, disabled }: ToggleProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg transition-colors',
        disabled ? 'opacity-50' : 'hover:bg-[--surface-secondary]'
      )}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[--surface-secondary] flex items-center justify-center text-[--text-secondary]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[--text-primary]">{label}</p>
        <p className="text-xs text-[--text-tertiary] mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[--accent-primary] focus:ring-offset-2 focus:ring-offset-[--surface-primary]',
          enabled ? 'bg-[--accent-primary]' : 'bg-[--surface-tertiary]',
          disabled && 'cursor-not-allowed'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            enabled ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

export function PushNotificationsSettings({ token }: PushNotificationsSettingsProps) {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    preferences,
    subscribe,
    unsubscribe,
    updatePreferences,
    sendTestNotification,
  } = usePushNotifications({ token });

  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const handleToggleSubscription = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handleSendTest = async () => {
    setTestStatus('sending');
    setTestMessage(null);

    const result = await sendTestNotification();

    if (result) {
      if (result.sent > 0) {
        setTestStatus('success');
        setTestMessage('Test notification sent!');
      } else {
        setTestStatus('error');
        setTestMessage('No active subscriptions found');
      }
    } else {
      setTestStatus('error');
      setTestMessage('Failed to send test notification');
    }

    // Reset status after 3 seconds
    setTimeout(() => {
      setTestStatus('idle');
      setTestMessage(null);
    }, 3000);
  };

  const handlePreferenceChange = async (key: keyof PushPreferences, value: boolean) => {
    if (!preferences) return;
    await updatePreferences({ [key]: value });
  };

  // Not supported state
  if (!isSupported) {
    return (
      <div className="bg-[--surface-primary] rounded-xl border border-[--border-primary] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[--surface-secondary] flex items-center justify-center">
            <BellOff className="w-5 h-5 text-[--text-secondary]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[--text-primary]">
              Push Notifications
            </h3>
            <p className="text-sm text-[--text-tertiary]">Not supported in this browser</p>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-[--text-primary]">
                Push notifications are not supported in your browser.
              </p>
              <p className="text-xs text-[--text-tertiary] mt-1">
                Try using Chrome, Firefox, Edge, or Safari on a supported device.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Permission denied state
  if (permission === 'denied') {
    return (
      <div className="bg-[--surface-primary] rounded-xl border border-[--border-primary] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
            <BellOff className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[--text-primary]">
              Push Notifications
            </h3>
            <p className="text-sm text-red-500">Permission blocked</p>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-[--text-primary]">
                Notification permission has been blocked.
              </p>
              <p className="text-xs text-[--text-tertiary] mt-1">
                To enable push notifications, click the lock icon in your browser&apos;s address
                bar and change the notification permission to &quot;Allow&quot;.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[--surface-primary] rounded-xl border border-[--border-primary] overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[--border-primary]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                isSubscribed ? 'bg-green-500/10' : 'bg-[--surface-secondary]'
              )}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-[--text-secondary] animate-spin" />
              ) : isSubscribed ? (
                <Bell className="w-5 h-5 text-green-500" />
              ) : (
                <BellOff className="w-5 h-5 text-[--text-secondary]" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-[--text-primary]">
                Push Notifications
              </h3>
              <p className="text-sm text-[--text-tertiary]">
                {isSubscribed
                  ? 'Receive alerts even when Termify is closed'
                  : 'Enable to receive alerts on your device'}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleSubscription}
            disabled={isLoading}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
              isSubscribed
                ? 'bg-[--surface-secondary] text-[--text-primary] hover:bg-[--surface-tertiary]'
                : 'bg-[--accent-primary] text-white hover:bg-[--accent-primary-hover]',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : isSubscribed ? (
              <>
                <Check className="w-4 h-4" />
                Enabled
              </>
            ) : (
              <>
                <Bell className="w-4 h-4" />
                Enable
              </>
            )}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          </div>
        )}

        {/* Test notification button */}
        {isSubscribed && (
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSendTest}
              disabled={testStatus === 'sending'}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2',
                'bg-[--surface-secondary] text-[--text-secondary] hover:bg-[--surface-tertiary]',
                testStatus === 'sending' && 'opacity-50 cursor-not-allowed'
              )}
            >
              {testStatus === 'sending' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Sending...
                </>
              ) : testStatus === 'success' ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  Sent!
                </>
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  Send Test Notification
                </>
              )}
            </button>
            {testMessage && (
              <span
                className={cn(
                  'text-xs',
                  testStatus === 'success' ? 'text-green-500' : 'text-red-500'
                )}
              >
                {testMessage}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Notification preferences */}
      {isSubscribed && preferences && (
        <div className="p-4">
          <p className="text-xs font-medium text-[--text-tertiary] uppercase tracking-wider mb-3 px-3">
            Notification Types
          </p>
          <div className="space-y-1">
            <Toggle
              label="Terminal Crashed"
              description="When a terminal process exits unexpectedly"
              icon={<Terminal className="w-4 h-4" />}
              enabled={preferences.terminalCrashed}
              onChange={(value) => handlePreferenceChange('terminalCrashed', value)}
            />
            <Toggle
              label="SSH Connection Failed"
              description="When an SSH connection cannot be established"
              icon={<WifiOff className="w-4 h-4" />}
              enabled={preferences.sshConnectionFailed}
              onChange={(value) => handlePreferenceChange('sshConnectionFailed', value)}
            />
            <Toggle
              label="Command Completed"
              description="When a long-running command finishes (Claude Code, builds)"
              icon={<CheckCircle2 className="w-4 h-4" />}
              enabled={preferences.commandCompleted}
              onChange={(value) => handlePreferenceChange('commandCompleted', value)}
            />
            <Toggle
              label="Viewer Activity"
              description="When someone joins or leaves your shared terminal"
              icon={<Users className="w-4 h-4" />}
              enabled={preferences.viewerActivity}
              onChange={(value) => handlePreferenceChange('viewerActivity', value)}
            />
            <Toggle
              label="Share Notifications"
              description="When a terminal is shared with you or permissions change"
              icon={<Share2 className="w-4 h-4" />}
              enabled={preferences.shareNotifications}
              onChange={(value) => handlePreferenceChange('shareNotifications', value)}
            />
          </div>
        </div>
      )}

      {/* Info for non-subscribed users */}
      {!isSubscribed && !isLoading && (
        <div className="p-4 bg-[--surface-secondary]">
          <p className="text-xs text-[--text-tertiary]">
            Push notifications let you receive alerts when:
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-[--text-secondary]">
            <li className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5" />
              A terminal crashes or a command completes
            </li>
            <li className="flex items-center gap-2">
              <WifiOff className="w-3.5 h-3.5" />
              An SSH connection fails
            </li>
            <li className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Someone joins your shared terminal
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
