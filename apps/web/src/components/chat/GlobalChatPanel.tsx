'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, X, MessageCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useGlobalChat } from '@/contexts/GlobalChatContext';
import { useSession } from 'next-auth/react';

export function GlobalChatPanel() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id || '';

  const {
    teams,
    hasTeams,
    activeTeamId,
    setActiveTeamId,
    messages,
    sendMessage,
    onlineMembers,
    typingUsers,
    sendTyping,
    unreadCounts,
    markAsRead,
    isOpen,
    closeChat,
    isConnected,
    isLoading,
  } = useGlobalChat();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get current team data
  const activeTeam = teams.find((t) => t.id === activeTeamId);
  const activeMessages = activeTeamId ? messages.get(activeTeamId) || [] : [];
  const activeOnlineMembers = activeTeamId ? onlineMembers.get(activeTeamId) || [] : [];
  const activeTypingUsers = activeTeamId ? typingUsers.get(activeTeamId) || [] : [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Mark as read when switching tabs
  useEffect(() => {
    if (isOpen && activeTeamId) {
      markAsRead(activeTeamId);
    }
  }, [isOpen, activeTeamId, markAsRead]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !isConnected) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    // Send typing indicator when user types
    if (e.target.value.length > 0) {
      sendTyping();
    }
  };

  const handleTabClick = (teamId: string) => {
    setActiveTeamId(teamId);
  };

  const formatTime = (dateInput: string | Date): string => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen || !hasTeams || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 md:inset-auto md:bottom-4 md:right-4 w-full md:w-96 h-full md:h-[32rem] bg-background border-0 md:border md:rounded-lg shadow-xl flex flex-col z-[50] animate-in slide-in-from-bottom-4 duration-200">
      {/* Header with tabs */}
      <div className="flex flex-col border-b">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Team Chat</span>
            {isConnected ? (
              <span className="w-2 h-2 rounded-full bg-green-500" title="Connected" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-red-500" title="Disconnected" />
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={closeChat}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Team tabs - always show if there are teams */}
        {teams.length > 0 && (
          <div className="flex overflow-x-auto px-2 py-1.5 gap-1 border-t">
            {teams.map((team) => {
              const unread = unreadCounts.get(team.id) || 0;
              const isActive = team.id === activeTeamId;

              return (
                <button
                  key={team.id}
                  onClick={() => handleTabClick(team.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {/* Team icon/image or initial */}
                  {team.image ? (
                    <img
                      src={team.image}
                      alt={team.name}
                      className="w-4 h-4 rounded object-cover"
                    />
                  ) : (
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-semibold"
                      style={{
                        backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : (team.color || '#6366f1'),
                        color: isActive ? 'inherit' : 'white',
                      }}
                    >
                      {team.icon || team.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="max-w-[80px] truncate">{team.name}</span>
                  {/* Unread badge */}
                  {unread > 0 && !isActive && (
                    <span className="min-w-[18px] h-[18px] bg-destructive text-destructive-foreground rounded-full text-[10px] flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Online members bar */}
      {activeOnlineMembers.length > 0 && (
        <div className="px-4 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-1 overflow-x-auto">
            <Users className="h-3 w-3 text-muted-foreground mr-1 flex-shrink-0" />
            {activeOnlineMembers.slice(0, 5).map((member) => (
              <div
                key={member.odId}
                className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium flex-shrink-0 overflow-hidden"
                title={member.name || member.email}
              >
                {member.image ? (
                  <img
                    src={member.image}
                    alt={member.name || member.email}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  member.name?.charAt(0).toUpperCase() || member.email.charAt(0).toUpperCase()
                )}
              </div>
            ))}
            {activeOnlineMembers.length > 5 && (
              <span className="text-xs text-muted-foreground ml-1">
                +{activeOnlineMembers.length - 5}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
        {isLoading && activeMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : activeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No messages yet in {activeTeam?.name || 'this team'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Start the conversation!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeMessages.map((message) => {
              const isOwn = message.userId === currentUserId;
              const userImage = message.user?.image;
              const userName = message.user?.name;
              const userInitial = userName?.charAt(0).toUpperCase() || '?';

              return (
                <div
                  key={message.id}
                  className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium flex-shrink-0 overflow-hidden"
                  >
                    {userImage ? (
                      <img
                        src={userImage}
                        alt={userName || 'User'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      userInitial
                    )}
                  </div>
                  <div className={`flex flex-col ${isOwn ? 'items-end' : ''}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium">
                        {isOwn ? 'You' : userName || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm max-w-[220px] break-words',
                        isOwn
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      {message.content}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {activeTypingUsers.length > 0 && (
              <div className="flex gap-2 mt-2">
                {activeTypingUsers.slice(0, 3).map((user) => (
                  <div
                    key={user.odId}
                    className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium flex-shrink-0 overflow-hidden"
                    title={`${user.name || 'Someone'} is typing...`}
                  >
                    {user.image ? (
                      <img
                        src={user.image}
                        alt={user.name || 'User'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      user.name?.charAt(0).toUpperCase() || '?'
                    )}
                  </div>
                ))}
                <div className="flex items-center">
                  <span className="text-muted-foreground text-lg tracking-widest">...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder={isConnected ? `Message ${activeTeam?.name || 'team'}...` : 'Connecting...'}
            className="flex-1 h-9"
            disabled={!isConnected}
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9"
            disabled={!input.trim() || !isConnected}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
