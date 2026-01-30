'use client';

import { useState } from 'react';
import { Plus, X, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PersonalTaskBoard } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface BoardTabsProps {
  boards: PersonalTaskBoard[];
  selectedBoardId: string | null; // null means "All"
  onSelectBoard: (boardId: string | null) => void;
  onCreateBoard: () => void;
  onEditBoard: (board: PersonalTaskBoard) => void;
  onDeleteBoard: (board: PersonalTaskBoard) => void;
}

export function BoardTabs({
  boards,
  selectedBoardId,
  onSelectBoard,
  onCreateBoard,
  onEditBoard,
  onDeleteBoard,
}: BoardTabsProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    board: PersonalTaskBoard;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, board: PersonalTaskBoard) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, board });
  };

  return (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
      {/* All Tasks Tab */}
      <button
        onClick={() => onSelectBoard(null)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
          selectedBoardId === null
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
        )}
      >
        All
      </button>

      {/* Board Tabs */}
      {boards.map((board) => (
        <button
          key={board.id}
          onClick={() => onSelectBoard(board.id)}
          onContextMenu={(e) => handleContextMenu(e, board)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap group',
            selectedBoardId === board.id
              ? 'text-white'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
          )}
          style={{
            backgroundColor:
              selectedBoardId === board.id ? board.color : undefined,
          }}
        >
          {board.icon && <span>{board.icon}</span>}
          {board.name}
          {board._count && (
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded-full',
                selectedBoardId === board.id
                  ? 'bg-white/20'
                  : 'bg-background'
              )}
            >
              {board._count.tasks}
            </span>
          )}
        </button>
      ))}

      {/* Add Board Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onCreateBoard}
        className="gap-1 text-muted-foreground"
      >
        <Plus size={14} />
        Add Board
      </Button>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 min-w-[140px] py-1 bg-popover border border-border rounded-lg shadow-lg"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => {
                onEditBoard(contextMenu.board);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              onClick={() => {
                onDeleteBoard(contextMenu.board);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
