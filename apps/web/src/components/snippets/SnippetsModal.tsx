'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Search,
  Star,
  StarOff,
  Copy,
  Trash2,
  Edit2,
  Tag,
  FolderOpen,
  Play,
  ChevronDown,
} from 'lucide-react';
import { snippetsApi, Snippet } from '@/lib/api';
import { cn } from '@/lib/utils';

interface SnippetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onUseSnippet?: (command: string) => void;
}

export function SnippetsModal({ isOpen, onClose, token, onUseSnippet }: SnippetsModalProps) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCommand, setFormCommand] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formTags, setFormTags] = useState('');

  const loadSnippets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await snippetsApi.list(token, {
        category: selectedCategory || undefined,
        search: search || undefined,
      });
      if (response.success && response.data) {
        setSnippets(response.data.snippets);
        setCategories(response.data.categories);
      }
    } catch (error) {
      console.error('Failed to load snippets:', error);
    } finally {
      setLoading(false);
    }
  }, [token, selectedCategory, search]);

  useEffect(() => {
    if (isOpen) {
      loadSnippets();
    }
  }, [isOpen, loadSnippets]);

  const handleCreate = async () => {
    try {
      const response = await snippetsApi.create(
        {
          name: formName,
          command: formCommand,
          description: formDescription || undefined,
          category: formCategory || undefined,
          tags: formTags ? formTags.split(',').map((t) => t.trim()) : [],
        },
        token
      );
      if (response.success) {
        loadSnippets();
        resetForm();
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Failed to create snippet:', error);
    }
  };

  const handleUpdate = async () => {
    if (!editingSnippet) return;
    try {
      const response = await snippetsApi.update(
        editingSnippet.id,
        {
          name: formName,
          command: formCommand,
          description: formDescription || null,
          category: formCategory || null,
          tags: formTags ? formTags.split(',').map((t) => t.trim()) : [],
        },
        token
      );
      if (response.success) {
        loadSnippets();
        resetForm();
        setEditingSnippet(null);
      }
    } catch (error) {
      console.error('Failed to update snippet:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this snippet?')) return;
    try {
      const response = await snippetsApi.delete(id, token);
      if (response.success) {
        loadSnippets();
      }
    } catch (error) {
      console.error('Failed to delete snippet:', error);
    }
  };

  const handleToggleFavorite = async (snippet: Snippet) => {
    try {
      const response = await snippetsApi.update(
        snippet.id,
        { isFavorite: !snippet.isFavorite },
        token
      );
      if (response.success) {
        loadSnippets();
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleUseSnippet = async (snippet: Snippet) => {
    try {
      await snippetsApi.use(snippet.id, token);
      onUseSnippet?.(snippet.command);
      onClose();
    } catch (error) {
      console.error('Failed to use snippet:', error);
    }
  };

  const handleCopy = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const startEditing = (snippet: Snippet) => {
    setEditingSnippet(snippet);
    setFormName(snippet.name);
    setFormCommand(snippet.command);
    setFormDescription(snippet.description || '');
    setFormCategory(snippet.category || '');
    setFormTags(snippet.tags.join(', '));
    setIsCreating(false);
  };

  const startCreating = () => {
    resetForm();
    setIsCreating(true);
    setEditingSnippet(null);
  };

  const resetForm = () => {
    setFormName('');
    setFormCommand('');
    setFormDescription('');
    setFormCategory('');
    setFormTags('');
  };

  if (!isOpen || typeof window === 'undefined') return null;

  const isEditing = editingSnippet || isCreating;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      {/* Modal */}
      <div className="relative bg-card rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Command Snippets</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-48 border-r border-border p-3 flex flex-col gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded text-sm text-left',
                selectedCategory === null ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
            >
              <FolderOpen size={16} />
              All Snippets
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded text-sm text-left truncate',
                  selectedCategory === cat ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                <Tag size={16} />
                {cat}
              </button>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search and actions */}
            <div className="flex items-center gap-3 p-3 border-b border-border">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search snippets..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-muted rounded text-sm"
                />
              </div>
              <button
                onClick={startCreating}
                className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
              >
                <Plus size={16} />
                New Snippet
              </button>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-auto p-3">
              {isEditing ? (
                /* Edit/Create form */
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Snippet name"
                      className="w-full px-3 py-2 bg-muted rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Command</label>
                    <textarea
                      value={formCommand}
                      onChange={(e) => setFormCommand(e.target.value)}
                      placeholder="Enter command..."
                      rows={4}
                      className="w-full px-3 py-2 bg-muted rounded text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description (optional)</label>
                    <input
                      type="text"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="What does this snippet do?"
                      className="w-full px-3 py-2 bg-muted rounded text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Category (optional)</label>
                      <input
                        type="text"
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        placeholder="e.g., git, docker, npm"
                        className="w-full px-3 py-2 bg-muted rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
                      <input
                        type="text"
                        value={formTags}
                        onChange={(e) => setFormTags(e.target.value)}
                        placeholder="e.g., utility, backup"
                        className="w-full px-3 py-2 bg-muted rounded text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        setEditingSnippet(null);
                        resetForm();
                      }}
                      className="px-4 py-2 text-sm hover:bg-muted rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={editingSnippet ? handleUpdate : handleCreate}
                      disabled={!formName || !formCommand}
                      className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                    >
                      {editingSnippet ? 'Update' : 'Create'}
                    </button>
                  </div>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  Loading snippets...
                </div>
              ) : snippets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <p>No snippets found</p>
                  <button
                    onClick={startCreating}
                    className="mt-2 text-primary text-sm hover:underline"
                  >
                    Create your first snippet
                  </button>
                </div>
              ) : (
                /* Snippets list */
                <div className="space-y-2">
                  {snippets.map((snippet) => (
                    <div
                      key={snippet.id}
                      className="group p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">{snippet.name}</h3>
                            {snippet.isFavorite && (
                              <Star size={14} className="text-yellow-500 fill-yellow-500" />
                            )}
                            {snippet.category && (
                              <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
                                {snippet.category}
                              </span>
                            )}
                          </div>
                          {snippet.description && (
                            <p className="text-sm text-muted-foreground mt-0.5">{snippet.description}</p>
                          )}
                          <pre className="mt-2 p-2 bg-background rounded text-sm font-mono overflow-x-auto">
                            {snippet.command}
                          </pre>
                          {snippet.tags.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {snippet.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Used {snippet.usageCount} times
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleUseSnippet(snippet)}
                            className="p-1.5 hover:bg-background rounded"
                            title="Use snippet"
                          >
                            <Play size={16} className="text-primary" />
                          </button>
                          <button
                            onClick={() => handleCopy(snippet.command)}
                            className="p-1.5 hover:bg-background rounded"
                            title="Copy command"
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            onClick={() => handleToggleFavorite(snippet)}
                            className="p-1.5 hover:bg-background rounded"
                            title={snippet.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            {snippet.isFavorite ? (
                              <StarOff size={16} className="text-yellow-500" />
                            ) : (
                              <Star size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => startEditing(snippet)}
                            className="p-1.5 hover:bg-background rounded"
                            title="Edit snippet"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(snippet.id)}
                            className="p-1.5 hover:bg-background rounded text-destructive"
                            title="Delete snippet"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
