'use client';

import { useState } from 'react';
import { Users, Eye, EyeOff, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CursorPosition, ActiveCollaborators, getCursorColor } from './RemoteCursors';
import { TerminalChat, ChatToggleButton, CollaborativeMessage } from './TerminalChat';

interface CollaborationToolbarProps {
  terminalId: string;
  teamId?: string;
  currentUserId: string;
  cursors: CursorPosition[];
  messages: CollaborativeMessage[];
  isFollowing: string | null;
  followedBy: string[];
  onSendMessage: (content: string) => void;
  onStartFollow: (userId: string) => void;
  onStopFollow: () => void;
  onInvite?: () => void;
}

export function CollaborationToolbar({
  terminalId,
  teamId,
  currentUserId,
  cursors,
  messages,
  isFollowing,
  followedBy,
  onSendMessage,
  onStartFollow,
  onStopFollow,
  onInvite,
}: CollaborationToolbarProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCollaborators, setShowCollaborators] = useState(false);

  // Get unique collaborators
  const collaborators = Array.from(
    new Map(
      cursors
        .filter((c) => c.userId !== currentUserId)
        .map((c) => [c.userId, c])
    ).values()
  );

  const handleSendMessage = (content: string) => {
    onSendMessage(content);
  };

  const toggleFollow = (userId: string) => {
    if (isFollowing === userId) {
      onStopFollow();
    } else {
      onStartFollow(userId);
    }
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-background/80 backdrop-blur-sm border-b">
      {/* Collaborators */}
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => setShowCollaborators(!showCollaborators)}
        >
          <Users className="h-4 w-4" />
          <span className="text-xs">{collaborators.length}</span>
          {followedBy.length > 0 && (
            <span className="px-1 py-0.5 text-xs bg-muted rounded">
              {followedBy.length} following you
            </span>
          )}
        </Button>

        {showCollaborators && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowCollaborators(false)}
            />
            <div className="absolute left-0 top-full mt-1 w-72 bg-background border rounded-md shadow-lg z-50 p-3">
              <h4 className="font-medium text-sm mb-3">Collaborators</h4>
              {collaborators.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No one else is viewing this terminal.
                </p>
              ) : (
                <div className="space-y-2">
                  {collaborators.map((collaborator) => (
                    <div
                      key={collaborator.userId}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white"
                          style={{ backgroundColor: getCursorColor(collaborator.userId) }}
                        >
                          {collaborator.userName?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <span className="text-sm">{collaborator.userName}</span>
                      </div>
                      <Button
                        variant={isFollowing === collaborator.userId ? 'default' : 'ghost'}
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggleFollow(collaborator.userId)}
                        title={isFollowing === collaborator.userId ? 'Stop following' : 'Follow their cursor'}
                      >
                        {isFollowing === collaborator.userId ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Active collaborators indicator */}
      <ActiveCollaborators cursors={cursors} currentUserId={currentUserId} />

      <div className="flex-1" />

      {/* Following indicator */}
      {isFollowing && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onStopFollow}
          className="gap-2"
        >
          <Eye className="h-4 w-4" />
          Following {cursors.find((c) => c.userId === isFollowing)?.userName}
          <span className="text-xs">(click to stop)</span>
        </Button>
      )}

      {/* Invite button */}
      {teamId && onInvite && (
        <Button variant="ghost" size="sm" onClick={onInvite} className="gap-2" title="Invite team members">
          <UserPlus className="h-4 w-4" />
          Invite
        </Button>
      )}

      {/* Chat toggle */}
      <ChatToggleButton
        unreadCount={unreadCount}
        isOpen={chatOpen}
        onClick={() => {
          setChatOpen(!chatOpen);
          if (!chatOpen) setUnreadCount(0);
        }}
      />

      {/* Chat panel */}
      <TerminalChat
        messages={messages}
        currentUserId={currentUserId}
        onSendMessage={handleSendMessage}
        onClose={() => setChatOpen(false)}
        isOpen={chatOpen}
      />
    </div>
  );
}
