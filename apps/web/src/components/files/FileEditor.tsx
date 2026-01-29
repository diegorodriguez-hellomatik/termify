'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  X,
  Save,
  FileCode,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { filesApi, FileContent } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface FileEditorProps {
  terminalId: string;
  filePath: string;
  fileName: string;
  onClose: () => void;
}

// Simple syntax highlighting based on extension
function getLanguage(extension: string | null): string {
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    md: 'markdown',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    css: 'css',
    scss: 'scss',
    html: 'html',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    sql: 'sql',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
  };
  return languageMap[extension || ''] || 'plaintext';
}

export function FileEditor({ terminalId, filePath, fileName, onClose }: FileEditorProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<FileContent | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasChanges = content !== originalContent;

  const loadFile = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);
    try {
      const response = await filesApi.read(terminalId, filePath, session.accessToken);
      if (response.success && response.data) {
        setFileInfo(response.data);
        if (response.data.content !== null) {
          setContent(response.data.content);
          setOriginalContent(response.data.content);
        } else if (response.data.isBinary) {
          setError('Binary files cannot be edited');
        } else if (response.data.isTruncated) {
          setError(response.data.message || 'File too large to edit');
        }
      } else {
        setError('Failed to load file');
      }
    } catch (err) {
      setError('Failed to load file');
    } finally {
      setLoading(false);
    }
  }, [terminalId, filePath, session?.accessToken]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  const handleSave = async () => {
    if (!session?.accessToken || !hasChanges) return;

    setSaving(true);
    setError(null);
    try {
      const response = await filesApi.write(terminalId, filePath, content, session.accessToken);
      if (response.success) {
        setOriginalContent(content);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);

        // Dispatch event to refresh file explorer
        window.dispatchEvent(new CustomEvent('terminal-files-changed', {
          detail: { terminalId }
        }));
      } else {
        setError('Failed to save file');
      }
    } catch (err) {
      setError('Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !saving) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, saving, handleSave]);

  const extension = fileInfo?.extension || filePath.split('.').pop() || null;
  const language = getLanguage(extension);

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{fileName}</span>
          {hasChanges && (
            <span className="text-xs text-muted-foreground">(modified)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}
          {hasChanges && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-7 px-3"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              Save
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* File info bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border text-xs text-muted-foreground bg-muted/20">
        <span>{filePath}</span>
        <div className="flex items-center gap-4">
          <span>{language}</span>
          {fileInfo && <span>{fileInfo.size} bytes</span>}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <div className="relative h-full">
            {/* Line numbers */}
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-muted/30 border-r border-border text-right pr-2 pt-3 text-xs text-muted-foreground font-mono select-none overflow-hidden">
              {content.split('\n').map((_, i) => (
                <div key={i} className="h-5 leading-5">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Editor */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={cn(
                'w-full h-full pl-14 pr-4 pt-3 pb-4',
                'bg-transparent text-sm font-mono',
                'focus:outline-none resize-none',
                'leading-5'
              )}
              spellCheck={false}
              style={{
                minHeight: '100%',
                tabSize: 2,
              }}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1 border-t border-border text-xs text-muted-foreground bg-muted/20">
        <span>
          {hasChanges ? 'Unsaved changes' : 'No changes'}
        </span>
        <span>
          Ln {textareaRef.current?.selectionStart ?
            content.substring(0, textareaRef.current.selectionStart).split('\n').length : 1},
          Col {textareaRef.current?.selectionStart ?
            (textareaRef.current.selectionStart - content.lastIndexOf('\n', textareaRef.current.selectionStart - 1)) : 1}
        </span>
      </div>
    </div>
  );
}
