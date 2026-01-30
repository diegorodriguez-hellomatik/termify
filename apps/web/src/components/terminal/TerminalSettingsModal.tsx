'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  theme?: string;
}

interface TerminalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  terminalName?: string;
  settings: TerminalSettings;
  onSave: (settings: TerminalSettings) => void;
}

const FONT_FAMILIES = [
  'JetBrains Mono',
  'Fira Code',
  'Source Code Pro',
  'Consolas',
  'Monaco',
  'Menlo',
  'monospace',
];

const THEMES = [
  { id: 'default', name: 'Default' },
  { id: 'dark', name: 'Dark' },
  { id: 'light', name: 'Light' },
  { id: 'dracula', name: 'Dracula' },
  { id: 'monokai', name: 'Monokai' },
  { id: 'nord', name: 'Nord' },
  { id: 'solarized-dark', name: 'Solarized Dark' },
  { id: 'solarized-light', name: 'Solarized Light' },
];

export function TerminalSettingsModal({
  isOpen,
  onClose,
  terminalName,
  settings,
  onSave,
}: TerminalSettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<TerminalSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-lg shadow-lg w-full max-w-md p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md hover:bg-muted"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-semibold mb-4">Terminal Settings</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Font Size</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="10"
                max="24"
                value={localSettings.fontSize}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, fontSize: parseInt(e.target.value) })
                }
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground w-8">
                {localSettings.fontSize}px
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Font Family</label>
            <select
              value={localSettings.fontFamily}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, fontFamily: e.target.value })
              }
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
            >
              {FONT_FAMILIES.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Theme</label>
            <select
              value={localSettings.theme}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, theme: e.target.value })
              }
              className="w-full px-3 py-2 border border-border rounded-md bg-background"
            >
              {THEMES.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}
