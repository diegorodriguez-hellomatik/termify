'use client';

import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamChatBubbleProps {
  isOpen: boolean;
  onClick: () => void;
  unreadCount?: number;
  onlineCount?: number;
}

export function TeamChatBubble({
  isOpen,
  onClick,
  unreadCount = 0,
  onlineCount = 0,
}: TeamChatBubbleProps) {
  // Don't show bubble when chat is open
  if (isOpen) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-6 right-6 z-[40]',
        'w-14 h-14 rounded-full',
        'bg-primary text-primary-foreground',
        'shadow-lg hover:shadow-xl',
        'flex items-center justify-center',
        'transition-all duration-200 hover:scale-105',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
      )}
      title="Team Chat"
    >
      <MessageCircle className="h-6 w-6" />

      {/* Unread badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full text-xs font-bold flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}

      {/* Online indicator */}
      {onlineCount > 0 && unreadCount === 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
          {onlineCount}
        </span>
      )}
    </button>
  );
}
