'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, X, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface CollaborativeMessage {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface TerminalChatProps {
  messages: CollaborativeMessage[];
  currentUserId: string;
  onSendMessage: (content: string) => void;
  onClose?: () => void;
  isOpen: boolean;
}

export function TerminalChat({
  messages,
  currentUserId,
  onSendMessage,
  onClose,
  isOpen,
}: TerminalChatProps) {
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
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-0 right-0 w-80 h-96 bg-background border rounded-lg shadow-xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Team Chat</span>
          <span className="text-xs text-muted-foreground">
            ({messages.length})
          </span>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
        {messages.length === 0 ? (
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
                        {isOwn ? 'You' : message.user?.name}
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
            placeholder="Type a message..."
            className="flex-1 h-9"
          />
          <Button type="submit" size="icon" className="h-9 w-9" disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

interface ChatToggleButtonProps {
  unreadCount: number;
  isOpen: boolean;
  onClick: () => void;
}

export function ChatToggleButton({
  unreadCount,
  isOpen,
  onClick,
}: ChatToggleButtonProps) {
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
