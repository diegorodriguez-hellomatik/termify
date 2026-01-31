'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useSession } from 'next-auth/react';
import { teamsApi, Team } from '@/lib/api';
import type { TeamMessage, OnlineMember } from '@termify/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

// Typing indicator user info
interface TypingUser {
  odId: string;
  odUserId: string;
  name: string | null;
  image: string | null;
  timestamp: number;
}

// Typing timeout (remove after 3 seconds of no typing)
const TYPING_TIMEOUT = 3000;

interface GlobalChatContextType {
  // Teams
  teams: Team[];
  teamsLoading: boolean;
  hasTeams: boolean;
  refreshTeams: () => void;

  // Active team
  activeTeamId: string | null;
  setActiveTeamId: (id: string | null) => void;

  // Messages per team
  messages: Map<string, TeamMessage[]>;
  sendMessage: (content: string) => void;

  // Online members per team
  onlineMembers: Map<string, OnlineMember[]>;

  // Typing indicators per team
  typingUsers: Map<string, TypingUser[]>;
  sendTyping: () => void;

  // Unread counts
  unreadCounts: Map<string, number>;
  totalUnreadCount: number;
  markAsRead: (teamId: string) => void;

  // UI state
  isOpen: boolean;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;

  // Connection
  isConnected: boolean;
  isLoading: boolean;
}

const GlobalChatContext = createContext<GlobalChatContextType | null>(null);

// Default context for when provider is not available
const defaultContext: GlobalChatContextType = {
  teams: [],
  teamsLoading: true,
  hasTeams: false,
  refreshTeams: () => {},
  activeTeamId: null,
  setActiveTeamId: () => {},
  messages: new Map(),
  sendMessage: () => {},
  onlineMembers: new Map(),
  typingUsers: new Map(),
  sendTyping: () => {},
  unreadCounts: new Map(),
  totalUnreadCount: 0,
  markAsRead: () => {},
  isOpen: false,
  toggleChat: () => {},
  openChat: () => {},
  closeChat: () => {},
  isConnected: false,
  isLoading: true,
};

export function useGlobalChat() {
  const context = useContext(GlobalChatContext);
  // Return default context if provider is not available (e.g., SSR)
  return context || defaultContext;
}

interface GlobalChatProviderProps {
  children: React.ReactNode;
}

export function GlobalChatProvider({ children }: GlobalChatProviderProps) {
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;

  // Teams state
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);

  // Active team
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);

  // Messages per team (Map<teamId, messages[]>)
  const [messages, setMessages] = useState<Map<string, TeamMessage[]>>(new Map());

  // Online members per team
  const [onlineMembers, setOnlineMembers] = useState<Map<string, OnlineMember[]>>(new Map());

  // Unread counts per team
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());

  // Typing users per team
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser[]>>(new Map());

  // Refs for typing debounce
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  // UI state
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // WebSocket refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subscribedTeamsRef = useRef<Set<string>>(new Set());

  // Fetch teams function (can be called to refresh)
  const fetchTeams = useCallback(async () => {
    if (!accessToken) {
      setTeamsLoading(false);
      return;
    }

    try {
      const response = await teamsApi.list(accessToken);
      if (response.success && response.data?.teams) {
        const newTeams = response.data.teams;
        setTeams(newTeams);
        // Set first team as active if none selected or current is not in list
        if (newTeams.length > 0) {
          const currentStillExists = activeTeamId && newTeams.some(t => t.id === activeTeamId);
          if (!currentStillExists) {
            setActiveTeamId(newTeams[0].id);
          }
        } else {
          setActiveTeamId(null);
        }
      }
    } catch (error) {
      console.error('[GlobalChat] Failed to fetch teams:', error);
    } finally {
      setTeamsLoading(false);
    }
  }, [accessToken, activeTeamId]);

  // Fetch teams on mount
  useEffect(() => {
    fetchTeams();
  }, [accessToken]);

  // Listen for team changes (join/leave events)
  useEffect(() => {
    const handleTeamChange = () => {
      fetchTeams();
    };

    // Listen for custom events dispatched when user joins/leaves a team
    window.addEventListener('team-joined', handleTeamChange);
    window.addEventListener('team-left', handleTeamChange);
    window.addEventListener('team-created', handleTeamChange);
    window.addEventListener('team-deleted', handleTeamChange);

    return () => {
      window.removeEventListener('team-joined', handleTeamChange);
      window.removeEventListener('team-left', handleTeamChange);
      window.removeEventListener('team-created', handleTeamChange);
      window.removeEventListener('team-deleted', handleTeamChange);
    };
  }, [fetchTeams]);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'chat.team.message': {
          const teamId = data.teamId;
          const message = data.message as TeamMessage;

          setMessages((prev) => {
            const newMap = new Map(prev);
            const teamMessages = newMap.get(teamId) || [];
            newMap.set(teamId, [...teamMessages, message]);
            return newMap;
          });

          // Increment unread if chat is closed OR different team is active
          setUnreadCounts((prev) => {
            const newMap = new Map(prev);
            // Check if we should count as unread
            const isCurrentTeamActive = activeTeamId === teamId;
            const isChatVisible = isOpen && isCurrentTeamActive;

            if (!isChatVisible) {
              const currentCount = newMap.get(teamId) || 0;
              newMap.set(teamId, currentCount + 1);
            }
            return newMap;
          });
          break;
        }

        case 'chat.team.messages': {
          const teamId = data.teamId;
          const teamMessages = data.messages as TeamMessage[];

          setMessages((prev) => {
            const newMap = new Map(prev);
            newMap.set(teamId, teamMessages);
            return newMap;
          });

          // Mark loading complete for this team
          if (teamId === activeTeamId) {
            setIsLoading(false);
          }
          break;
        }

        case 'chat.team.online': {
          const teamId = data.teamId;
          const members = data.members as OnlineMember[];

          setOnlineMembers((prev) => {
            const newMap = new Map(prev);
            newMap.set(teamId, members);
            return newMap;
          });
          break;
        }

        case 'chat.team.typing': {
          const teamId = data.teamId;
          const user = data.user as { odId: string; odUserId: string; name: string | null; image: string | null };

          // Don't show typing for self
          if (user.odUserId === session?.user?.id) break;

          setTypingUsers((prev) => {
            const newMap = new Map(prev);
            const teamTyping = newMap.get(teamId) || [];

            // Update or add user
            const existingIndex = teamTyping.findIndex(u => u.odId === user.odId);
            const typingUser: TypingUser = {
              ...user,
              timestamp: Date.now(),
            };

            if (existingIndex >= 0) {
              teamTyping[existingIndex] = typingUser;
            } else {
              teamTyping.push(typingUser);
            }

            newMap.set(teamId, [...teamTyping]);
            return newMap;
          });
          break;
        }

        case 'pong':
          // Ignore pong messages
          break;

        default:
          // Ignore other message types
          break;
      }
    } catch (err) {
      console.error('[GlobalChat] Failed to parse message:', err);
    }
  }, [activeTeamId, isOpen, session?.user?.id]);

  // Cleanup stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        let changed = false;
        const newMap = new Map(prev);

        newMap.forEach((users, teamId) => {
          const filtered = users.filter(u => now - u.timestamp < TYPING_TIMEOUT);
          if (filtered.length !== users.length) {
            changed = true;
            if (filtered.length === 0) {
              newMap.delete(teamId);
            } else {
              newMap.set(teamId, filtered);
            }
          }
        });

        return changed ? newMap : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!accessToken || teams.length === 0) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    console.log('[GlobalChat] Connecting...');
    const ws = new WebSocket(`${WS_URL}?token=${accessToken}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[GlobalChat] Connected');
      setIsConnected(true);

      // Subscribe to all teams
      teams.forEach((team) => {
        if (!subscribedTeamsRef.current.has(team.id)) {
          ws.send(JSON.stringify({ type: 'team.subscribe', teamId: team.id }));
          ws.send(JSON.stringify({ type: 'chat.team.history', teamId: team.id, limit: 50 }));
          subscribedTeamsRef.current.add(team.id);
        }
      });

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = handleMessage;

    ws.onclose = (event) => {
      console.log('[GlobalChat] Disconnected:', event.code);
      setIsConnected(false);
      subscribedTeamsRef.current.clear();

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      // Reconnect unless intentional close
      if (event.code !== 1000 && event.code !== 1001) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[GlobalChat] Attempting reconnect...');
          connect();
        }, 5000);
      }
    };

    ws.onerror = (error) => {
      console.error('[GlobalChat] Error:', error);
    };
  }, [accessToken, teams, handleMessage]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Disconnected');
      wsRef.current = null;
    }
    setIsConnected(false);
    subscribedTeamsRef.current.clear();
  }, []);

  // Connect when we have teams and token
  useEffect(() => {
    if (accessToken && teams.length > 0) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [accessToken, teams.length, connect, disconnect]);

  // Send message to active team
  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !activeTeamId) {
      console.error('[GlobalChat] Cannot send message: not connected or no active team');
      return;
    }

    if (!content.trim()) return;

    wsRef.current.send(JSON.stringify({
      type: 'chat.team.send',
      teamId: activeTeamId,
      content: content.trim(),
    }));
  }, [activeTeamId]);

  // Mark messages as read for a team
  const markAsRead = useCallback((teamId: string) => {
    setUnreadCounts((prev) => {
      const newMap = new Map(prev);
      newMap.set(teamId, 0);
      return newMap;
    });
  }, []);

  // Calculate total unread count
  const totalUnreadCount = Array.from(unreadCounts.values()).reduce((a, b) => a + b, 0);

  // UI toggles
  const toggleChat = useCallback(() => {
    setIsOpen((prev) => {
      const newIsOpen = !prev;
      // If opening chat, mark active team as read
      if (newIsOpen && activeTeamId) {
        markAsRead(activeTeamId);
      }
      return newIsOpen;
    });
  }, [activeTeamId, markAsRead]);

  const openChat = useCallback(() => {
    setIsOpen(true);
    if (activeTeamId) {
      markAsRead(activeTeamId);
    }
  }, [activeTeamId, markAsRead]);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Handle active team change
  const handleSetActiveTeamId = useCallback((teamId: string | null) => {
    setActiveTeamId(teamId);
    if (teamId && isOpen) {
      markAsRead(teamId);
    }
  }, [isOpen, markAsRead]);

  // Send typing indicator
  const sendTyping = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !activeTeamId) {
      return;
    }

    const now = Date.now();
    // Debounce: only send every 2 seconds max
    if (now - lastTypingSentRef.current < 2000) {
      return;
    }

    lastTypingSentRef.current = now;
    wsRef.current.send(JSON.stringify({
      type: 'chat.team.typing',
      teamId: activeTeamId,
    }));
  }, [activeTeamId]);

  const value: GlobalChatContextType = {
    teams,
    teamsLoading,
    hasTeams: teams.length > 0,
    refreshTeams: fetchTeams,

    activeTeamId,
    setActiveTeamId: handleSetActiveTeamId,

    messages,
    sendMessage,

    onlineMembers,

    typingUsers,
    sendTyping,

    unreadCounts,
    totalUnreadCount,
    markAsRead,

    isOpen,
    toggleChat,
    openChat,
    closeChat,

    isConnected,
    isLoading,
  };

  return (
    <GlobalChatContext.Provider value={value}>
      {children}
    </GlobalChatContext.Provider>
  );
}
