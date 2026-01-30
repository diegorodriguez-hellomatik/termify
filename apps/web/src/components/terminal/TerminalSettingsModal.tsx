'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { TERMINAL_THEMES, THEME_IDS, getTerminalTheme } from '@/lib/terminal-themes';
import { cn } from '@/lib/utils';

export interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  theme?: string; // If set, overrides global theme for this terminal
}

const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24];

const FONT_FAMILIES = [
  { value: 'JetBrains Mono, monospace', label: 'JetBrains Mono' },
  { value: 'Fira Code, monospace', label: 'Fira Code' },
  { value: 'Source Code Pro, monospace', label: 'Source Code Pro' },
  { value: 'Cascadia Code, monospace', label: 'Cascadia Code' },
  { value: 'SF Mono, monospace', label: 'SF Mono' },
  { value: 'Monaco, monospace', label: 'Monaco' },
  { value: 'Consolas, monospace', label: 'Consolas' },
  { value: 'Ubuntu Mono, monospace', label: 'Ubuntu Mono' },
  { value: 'monospace', label: 'System Monospace' },
];

interface TerminalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  terminalName: string;
  settings: TerminalSettings;
  onSave: (settings: TerminalSettings) => void;
}

export function TerminalSettingsModal({
  isOpen,
  onClose,
  terminalName,
  settings,
  onSave,
}: TerminalSettingsModalProps) {
  const { terminalTheme: globalTheme } = useTheme();
  const [localSettings, setLocalSettings] = useState<TerminalSettings>(settings);

  // Sync with props when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const currentThemeId = localSettings.theme || globalTheme;
  const currentTheme = getTerminalTheme(currentThemeId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - Compact */}
      <div className="relative bg-background border border-border rounded-lg shadow-xl w-full max-w-sm z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Terminal Settings</h2>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{terminalName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Content - Compact */}
        <div className="p-4 space-y-4">
          {/* Font Size */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium whitespace-nowrap">Font Size</label>
            <select
              value={localSettings.fontSize}
              onChange={(e) => setLocalSettings({ ...localSettings, fontSize: parseInt(e.target.value) })}
              className="flex-1 max-w-[120px] px-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>{size}px</option>
              ))}
            </select>
          </div>

          {/* Font Family */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium whitespace-nowrap">Font</label>
            <select
              value={localSettings.fontFamily}
              onChange={(e) => setLocalSettings({ ...localSettings, fontFamily: e.target.value })}
              className="flex-1 max-w-[180px] px-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {FONT_FAMILIES.map((font) => (
                <option key={font.value} value={font.value}>{font.label}</option>
              ))}
            </select>
          </div>

          {/* Theme */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium whitespace-nowrap">Theme</label>
            <select
              value={localSettings.theme || ''}
              onChange={(e) => setLocalSettings({ ...localSettings, theme: e.target.value || undefined })}
              className="flex-1 max-w-[180px] px-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Use Global Theme</option>
              {THEME_IDS.map((themeId) => {
                const theme = TERMINAL_THEMES[themeId];
                return (
                  <option key={themeId} value={themeId}>
                    {theme.name} ({theme.isDark ? 'Dark' : 'Light'})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Preview - Compact */}
          <div
            className="rounded-md border border-border p-2 overflow-hidden"
            style={{
              backgroundColor: currentTheme.colors.background,
              fontFamily: localSettings.fontFamily,
              fontSize: Math.min(localSettings.fontSize, 14), // Cap preview size
            }}
          >
            <div style={{ color: currentTheme.colors.foreground }}>
              <span style={{ color: currentTheme.colors.green }}>user</span>
              <span style={{ color: currentTheme.colors.foreground }}>:</span>
              <span style={{ color: currentTheme.colors.blue }}>~</span>
              <span style={{ color: currentTheme.colors.foreground }}>$ </span>
              <span style={{ color: currentTheme.colors.yellow }}>echo</span>
              <span style={{ color: currentTheme.colors.foreground }}> "Hello"</span>
            </div>
          </div>
        </div>

        {/* Footer - Compact */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
