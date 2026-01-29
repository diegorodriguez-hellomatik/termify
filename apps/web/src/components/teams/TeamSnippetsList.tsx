'use client';

import { useState } from 'react';
import { Code2, Plus, Trash2, MoreVertical, Loader2, Copy, Check, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTeamSnippets } from '@/hooks/useTeamSnippets';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { TeamSnippet } from '@/lib/api';

interface TeamSnippetsListProps {
  teamId: string;
  canManage: boolean;
  onInsert?: (command: string) => void;
}

export function TeamSnippetsList({
  teamId,
  canManage,
  onInsert,
}: TeamSnippetsListProps) {
  const {
    snippets,
    loading,
    error,
    refetch,
    createSnippet,
    deleteSnippet,
    useSnippet,
  } = useTeamSnippets(teamId);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedSnippet, setSelectedSnippet] = useState<TeamSnippet | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSnippets = searchQuery
    ? snippets.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.command.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : snippets;

  const handleCopy = async (snippet: TeamSnippet) => {
    await navigator.clipboard.writeText(snippet.command);
    setCopiedId(snippet.id);
    setTimeout(() => setCopiedId(null), 2000);
    await useSnippet(snippet.id);
  };

  const handleDelete = async () => {
    if (!selectedSnippet) return;
    await deleteSnippet(selectedSnippet.id);
    setDeleteModalOpen(false);
    setSelectedSnippet(null);
  };

  const handleDeleteClick = (snippet: TeamSnippet) => {
    setMenuOpenId(null);
    setSelectedSnippet(snippet);
    setDeleteModalOpen(true);
  };

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
        <Button variant="outline" onClick={() => refetch()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (snippets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Code2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No team snippets</h3>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Create reusable command snippets for your team.
        </p>
        {canManage && (
          <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
            <Plus size={16} />
            Create Snippet
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Input
          placeholder="Search snippets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        {canManage && (
          <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
            <Plus size={16} />
            Create Snippet
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredSnippets.map((snippet) => (
          <Card key={snippet.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Code2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{snippet.name}</h4>
                    {snippet.category && (
                      <span className="text-xs text-muted-foreground">
                        {snippet.category}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleCopy(snippet)}
                  >
                    {copiedId === snippet.id ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  {onInsert && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onInsert(snippet.command)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  {canManage && (
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setMenuOpenId(menuOpenId === snippet.id ? null : snippet.id)
                        }
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                      {menuOpenId === snippet.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setMenuOpenId(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-40 bg-background border rounded-md shadow-lg z-50 py-1">
                            <button
                              className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-destructive"
                              onClick={() => handleDeleteClick(snippet)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <code className="block font-mono text-sm bg-muted px-3 py-2 rounded mt-3 truncate">
                {snippet.command}
              </code>

              {snippet.description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {snippet.description}
                </p>
              )}

              <div className="flex items-center justify-between mt-3">
                <div className="flex flex-wrap gap-1">
                  {snippet.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs bg-muted rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {snippet.usageCount} uses
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Snippet"
        itemName={selectedSnippet?.name || ''}
        itemType="snippet"
        description="This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setSelectedSnippet(null);
        }}
      />
    </div>
  );
}
