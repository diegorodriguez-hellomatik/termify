'use client';

import { createPortal } from 'react-dom';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGlobalChat } from '@/contexts/GlobalChatContext';

export function GlobalChatBubble() {
  const { isOpen, toggleChat, totalUnreadCount, hasTeams, teamsLoading } = useGlobalChat();

  // Don't show bubble when chat is open, during loading, or if user has no teams
  if (isOpen || teamsLoading || !hasTeams || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <button
      onClick={toggleChat}
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
      {totalUnreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full text-xs font-bold flex items-center justify-center">
          {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
        </span>
      )}
    </button>,
    document.body
  );
}
