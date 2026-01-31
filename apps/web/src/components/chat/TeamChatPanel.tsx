'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, X, MessageCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TeamMessage, OnlineMember } from '@termify/shared';

interface TeamChatPanelProps {
  messages: TeamMessage[];
  onlineMembers: OnlineMember[];
  currentUserId: string;
  isLoading: boolean;
  isConnected: boolean;
  onSendMessage: (content: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function TeamChatPanel({
  messages,
  onlineMembers,
  currentUserId,
  isLoading,
  isConnected,
  onSendMessage,
  onClose,
  isOpen,
}: TeamChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !isConnected) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const formatTime = (dateInput: string | Date): string => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 md:inset-auto md:bottom-4 md:right-4 w-full md:w-80 h-full md:h-[28rem] bg-background border-0 md:border md:rounded-lg shadow-xl flex flex-col z-[50] animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Team Chat</span>
            {isConnected ? (
              <span className="w-2 h-2 rounded-full bg-green-500" title="Connected" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-red-500" title="Disconnected" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {onlineMembers.length}
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Online members bar */}
        {onlineMembers.length > 0 && (
          <div className="px-4 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-1 overflow-x-auto">
              {onlineMembers.slice(0, 5).map((member) => (
                <div
                  key={member.odId}
                  className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium flex-shrink-0"
                  title={member.name || member.email}
                >
                  {member.name?.charAt(0).toUpperCase() || member.email.charAt(0).toUpperCase()}
                </div>
              ))}
              {onlineMembers.length > 5 && (
                <span className="text-xs text-muted-foreground ml-1">
                  +{onlineMembers.length - 5}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => {
                const isOwn = message.userId === currentUserId;
                return (
                  <div
                    key={message.id}
                    className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium flex-shrink-0"
                    >
                      {message.user?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className={`flex flex-col ${isOwn ? 'items-end' : ''}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium">
                          {isOwn ? 'You' : message.user?.name || 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(message.createdAt)}
                        </span>
                      </div>
                      <div
                        className={`px-3 py-2 rounded-lg text-sm max-w-[200px] break-words ${
                          isOwn
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isConnected ? 'Type a message...' : 'Connecting...'}
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

interface TeamChatToggleButtonProps {
  unreadCount?: number;
  isOpen: boolean;
  onClick: () => void;
}

export function TeamChatToggleButton({
  unreadCount = 0,
  isOpen,
  onClick,
}: TeamChatToggleButtonProps) {
  return (
    <Button
      variant={isOpen ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      className="relative gap-2"
    >
      <MessageCircle className="h-4 w-4" />
      Chat
      {unreadCount > 0 && !isOpen && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );
}
