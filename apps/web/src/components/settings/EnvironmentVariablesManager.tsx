'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Eye, EyeOff, Save, X, Variable } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface EnvVariable {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
}

const STORAGE_KEY = 'termify-env-vars';

export function EnvironmentVariablesManager() {
  const [variables, setVariables] = useState<EnvVariable[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newIsSecret, setNewIsSecret] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setVariables(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load env vars:', e);
      }
    }
  }, []);

  // Save to localStorage
  const saveVariables = (newVars: EnvVariable[]) => {
    setVariables(newVars);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newVars));
  };

  const handleAdd = () => {
    if (!newKey.trim()) return;

    const newVar: EnvVariable = {
      id: Date.now().toString(),
      key: newKey.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
      value: newValue,
      isSecret: newIsSecret,
    };

    saveVariables([...variables, newVar]);
    setNewKey('');
    setNewValue('');
    setNewIsSecret(false);
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    saveVariables(variables.filter((v) => v.id !== id));
  };

  const handleEdit = (id: string, newValue: string) => {
    saveVariables(
      variables.map((v) => (v.id === id ? { ...v, value: newValue } : v))
    );
    setEditingId(null);
    setEditValue('');
  };

  const toggleShowSecret = (id: string) => {
    setShowSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const startEditing = (variable: EnvVariable) => {
    setEditingId(variable.id);
    setEditValue(variable.value);
  };

  // Export as shell format
  const exportAsShell = () => {
    const content = variables
      .map((v) => `export ${v.key}="${v.value.replace(/"/g, '\\"')}"`)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'environment-variables.sh';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Variable className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Environment Variables</h3>
            <p className="text-sm text-muted-foreground">
              Define environment variables for your terminals
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {variables.length > 0 && (
            <Button variant="ghost" size="sm" onClick={exportAsShell}>
              Export
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
          >
            <Plus size={14} className="mr-1" />
            Add Variable
          </Button>
        </div>
      </div>

      {/* Add new variable form */}
      {isAdding && (
        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Variable Name</label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="MY_VARIABLE"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Value</label>
              <Input
                type={newIsSecret ? 'password' : 'text'}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="value"
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newIsSecret}
                onChange={(e) => setNewIsSecret(e.target.checked)}
                className="rounded"
              />
              Mark as secret (hidden by default)
            </label>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={!newKey.trim()}>
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Variables list */}
      <div className="space-y-2">
        {variables.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Variable size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No environment variables defined</p>
            <p className="text-xs mt-1">
              Add variables that will be available in all terminals
            </p>
          </div>
        ) : (
          variables.map((variable) => (
            <div
              key={variable.id}
              className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-primary">
                    {variable.key}
                  </span>
                  {variable.isSecret && (
                    <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-600 rounded">
                      secret
                    </span>
                  )}
                </div>
                {editingId === variable.id ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="font-mono text-sm h-8"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(variable.id, editValue)}
                    >
                      <Save size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ) : (
                  <p
                    className="font-mono text-sm text-muted-foreground truncate cursor-pointer hover:text-foreground"
                    onClick={() => startEditing(variable)}
                  >
                    {variable.isSecret && !showSecrets[variable.id]
                      ? '••••••••'
                      : variable.value || '(empty)'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {variable.isSecret && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleShowSecret(variable.id)}
                    title={showSecrets[variable.id] ? 'Hide value' : 'Show value'}
                  >
                    {showSecrets[variable.id] ? (
                      <EyeOff size={14} />
                    ) : (
                      <Eye size={14} />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(variable.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info note */}
      {variables.length > 0 && (
        <p className="text-xs text-muted-foreground">
          These variables will be available in new terminals. Existing terminals need to be restarted.
        </p>
      )}
    </div>
  );
}
