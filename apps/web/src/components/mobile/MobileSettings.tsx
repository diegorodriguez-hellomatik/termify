'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  User,
  Shield,
  Palette,
  LayoutGrid,
  Terminal,
  Keyboard,
  FileJson,
  Bell,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Lock,
  Mail,
  RotateCcw,
} from 'lucide-react';
import { MobileContentHeader } from './MobileContentHeader';
import { cn } from '@/lib/utils';
import { useTheme, ViewMode, FONT_OPTIONS, FONT_SIZE_OPTIONS, FontFamily, FontSize } from '@/context/ThemeContext';
import { terminalThemes } from '@/lib/terminal-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AvatarUpload } from '@/components/settings/AvatarUpload';
import { ChangePasswordForm } from '@/components/settings/ChangePasswordForm';
import { ChangeEmailForm } from '@/components/settings/ChangeEmailForm';
import { PushNotificationsSettings } from '@/components/settings/PushNotificationsSettings';

interface SettingsSection {
  id: string;
  label: string;
  icon: typeof User;
  description: string;
}

const SECTIONS: SettingsSection[] = [
  { id: 'profile', label: 'Profile', icon: User, description: 'Manage your personal information' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Password and email settings' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme and font settings' },
  { id: 'terminal', label: 'Terminal', icon: Terminal, description: 'Default terminal settings' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Push notification settings' },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, description: 'Keyboard shortcuts' },
  { id: 'data', label: 'Data', icon: FileJson, description: 'Import/Export settings' },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, description: 'Delete account' },
];

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
  { value: 'list', label: 'List', icon: FileJson },
];

interface MobileSettingsProps {
  onSignOut?: () => void;
}

export function MobileSettings({ onSignOut }: MobileSettingsProps) {
  const { data: session, update: updateSession } = useSession();
  const { isDark, terminalTheme, setTerminalTheme, viewMode, setViewMode, fontFamily, setFontFamily, fontSize, setFontSize } = useTheme();

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [name, setName] = useState(session?.user?.name || '');
  const [userImage, setUserImage] = useState(session?.user?.image || null);
  const [isSaving, setIsSaving] = useState(false);

  const handleAvatarChange = useCallback(async (newImageUrl: string | null) => {
    setUserImage(newImageUrl);
    await updateSession({ image: newImageUrl });
  }, [updateSession]);

  const toggleSection = (sectionId: string) => {
    setExpandedSection(prev => prev === sectionId ? null : sectionId);
  };

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'profile':
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">Avatar</label>
              <AvatarUpload
                currentImage={userImage}
                userName={session?.user?.name}
                token={session?.accessToken || null}
                onAvatarChange={handleAvatarChange}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">Email</label>
              <Input
                value={session?.user?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>
            <Button className="w-full" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium">Change Password</h4>
              </div>
              <ChangePasswordForm token={session?.accessToken || null} />
            </div>
            <div className="border-t border-border pt-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium">Change Email</h4>
              </div>
              <ChangeEmailForm
                currentEmail={session?.user?.email || ''}
                token={session?.accessToken || null}
              />
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            {/* Terminal Theme */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Terminal Theme</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(terminalThemes).slice(0, 6).map((themeName) => {
                  const theme = terminalThemes[themeName];
                  return (
                    <button
                      key={themeName}
                      onClick={() => setTerminalTheme(themeName)}
                      className={cn(
                        'p-3 rounded-lg border-2 transition-all text-left',
                        terminalTheme === themeName
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border'
                      )}
                      style={{ backgroundColor: theme.background }}
                    >
                      <div className="text-xs font-medium mb-1" style={{ color: theme.foreground }}>
                        {themeName}
                      </div>
                      <div className="flex gap-0.5">
                        {[theme.red, theme.green, theme.blue, theme.yellow].map((color, i) => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font Family */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Font Family</label>
              <div className="grid grid-cols-2 gap-2">
                {FONT_OPTIONS.map((font) => (
                  <button
                    key={font.value}
                    onClick={() => setFontFamily(font.value)}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all text-left',
                      fontFamily === font.value
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border'
                    )}
                  >
                    <div className="font-medium text-sm mb-0.5">{font.label}</div>
                    <div className="text-xs text-muted-foreground">{font.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Font Size</label>
              <div className="flex flex-wrap gap-2">
                {FONT_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size.value}
                    onClick={() => setFontSize(size.value)}
                    className={cn(
                      'px-4 py-2 rounded-lg border-2 transition-all min-h-[44px]',
                      fontSize === size.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border'
                    )}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>

            {/* View Mode */}
            <div className="space-y-3">
              <label className="text-sm font-medium">View Mode</label>
              <div className="flex gap-2">
                {VIEW_MODES.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.value}
                      onClick={() => setViewMode(mode.value)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-all min-h-[44px]',
                        viewMode === mode.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border'
                      )}
                    >
                      <Icon size={18} />
                      <span className="text-sm">{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reset */}
            <Button
              variant="outline"
              onClick={() => {
                setFontFamily('jetbrains');
                setFontSize('16');
              }}
              className="w-full gap-2"
            >
              <RotateCcw size={14} />
              Reset to Defaults
            </Button>
          </div>
        );

      case 'terminal':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-2">Columns</label>
                <Input type="number" defaultValue={120} min={40} max={500} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Rows</label>
                <Input type="number" defaultValue={30} min={10} max={200} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">Working Directory</label>
              <Input defaultValue="~" placeholder="~" />
            </div>
            <Button className="w-full">Save Defaults</Button>
          </div>
        );

      case 'notifications':
        return (
          <PushNotificationsSettings token={session?.accessToken || null} />
        );

      case 'shortcuts':
        return (
          <div className="space-y-2">
            {KEYBOARD_SHORTCUTS.map((shortcut) => (
              <div
                key={shortcut.key}
                className="flex items-center justify-between py-3 border-b border-border last:border-0"
              >
                <span className="text-sm">{shortcut.action}</span>
                <kbd className={cn(
                  'px-2 py-1 rounded text-xs font-mono',
                  isDark ? 'bg-white/10' : 'bg-black/5'
                )}>
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
        );

      case 'data':
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Export Configuration</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Download your settings, snippets, and profiles as JSON.
              </p>
              <Button variant="outline" className="w-full">
                Export Data
              </Button>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Import Configuration</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Restore from a previously exported configuration.
              </p>
              <Button variant="outline" className="w-full">
                Import Data
              </Button>
            </div>
          </div>
        );

      case 'danger':
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5">
              <h4 className="font-medium text-destructive mb-2">Delete All Terminals</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Permanently delete all your terminals. This cannot be undone.
              </p>
              <Button variant="destructive" size="sm" className="w-full">
                Delete All Terminals
              </Button>
            </div>
            <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5">
              <h4 className="font-medium text-destructive mb-2">Delete Account</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Permanently delete your account and all data. This cannot be undone.
              </p>
              <Button variant="destructive" size="sm" className="w-full">
                Delete Account
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <MobileContentHeader
        title="Settings"
        subtitle="Manage your account and preferences"
      />

      {/* Sections */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain">
        <div className="divide-y divide-border">
          {SECTIONS.map((section) => {
            const isExpanded = expandedSection === section.id;
            const Icon = section.icon;
            const isDanger = section.id === 'danger';

            return (
              <div key={section.id}>
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-4',
                    'active:bg-muted transition-colors touch-manipulation'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    isDanger ? 'bg-destructive/10' : 'bg-primary/10'
                  )}>
                    <Icon size={20} className={isDanger ? 'text-destructive' : 'text-primary'} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className={cn(
                      'font-semibold',
                      isDanger && 'text-destructive'
                    )}>
                      {section.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {section.description}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>

                {/* Section Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                    {renderSectionContent(section.id)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
