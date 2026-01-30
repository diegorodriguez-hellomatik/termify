'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { TerminalStatus } from '@termify/shared';
import { useTerminalSocket } from '@/hooks/useTerminalSocket';
import { useTheme } from '@/context/ThemeContext';
import { getXtermTheme, getTerminalTheme } from '@/lib/terminal-themes';
import { Play, Square, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TerminalThemeSelector } from '@/components/settings/TerminalThemeSelector';
import { cn } from '@/lib/utils';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  terminalId: string;
  token: string;
  shareToken?: string;
  readOnly?: boolean;
  initialStatus?: TerminalStatus;
  className?: string;
  onReady?: () => void;
  isActive?: boolean;
  onClose?: () => void;
  /** Hide the toolbar completely (for use in floating windows with custom header) */
  hideToolbar?: boolean;
  /** Callback to receive status updates */
  onStatusUpdate?: (status: TerminalStatus, isConnected: boolean) => void;
  /** Custom font size (overrides default 14) */
  fontSize?: number;
  /** Custom font family (overrides default) */
  fontFamily?: string;
  /** Theme override (if set, uses this instead of global theme) */
  themeOverride?: string;
}

const STATUS_COLORS: Record<TerminalStatus, string> = {
  [TerminalStatus.STOPPED]: 'bg-gray-500',
  [TerminalStatus.STARTING]: 'bg-yellow-500 animate-pulse',
  [TerminalStatus.RUNNING]: 'bg-green-500',
  [TerminalStatus.CRASHED]: 'bg-red-500',
};

const STATUS_LABELS: Record<TerminalStatus, string> = {
  [TerminalStatus.STOPPED]: 'Stopped',
  [TerminalStatus.STARTING]: 'Starting...',
  [TerminalStatus.RUNNING]: 'Running',
  [TerminalStatus.CRASHED]: 'Crashed',
};

export function Terminal({
  terminalId,
  token,
  shareToken,
  readOnly = false,
  initialStatus = TerminalStatus.STOPPED,
  className,
  onReady,
  isActive = true,
  onClose,
  hideToolbar = false,
  onStatusUpdate,
  fontSize = 14,
  fontFamily = 'JetBrains Mono, Fira Code, monospace',
  themeOverride,
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<TerminalStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Get theme from context, but allow override
  const { terminalTheme } = useTheme();
  const effectiveTheme = themeOverride || terminalTheme;
  const currentTheme = getTerminalTheme(effectiveTheme);

  // Callbacks that write directly to terminal
  const handleOutput = useCallback((data: string) => {
    if (terminalRef.current) {
      terminalRef.current.write(data);
    }
  }, []);

  const handleStatusChange = useCallback((newStatus: TerminalStatus) => {
    setStatus(newStatus);
    setError(null);
  }, []);

  const handleConnected = useCallback((bufferedOutput?: string) => {
    if (bufferedOutput && terminalRef.current) {
      terminalRef.current.write(bufferedOutput);
    }
  }, []);

  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
  }, []);

  const { isConnected, send, resize, start, stop, connect, disconnect } =
    useTerminalSocket({
      terminalId,
      token,
      shareToken,
      onOutput: handleOutput,
      onStatusChange: handleStatusChange,
      onConnected: handleConnected,
      onError: handleError,
    });

  // Notify parent of status updates
  useEffect(() => {
    onStatusUpdate?.(status, isConnected);
  }, [status, isConnected, onStatusUpdate]);

  // Track if we've initialized to prevent double-init in StrictMode
  const initializedRef = useRef(false);
  const hasAutoStartedRef = useRef(false);
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;

  // Initialize xterm - same pattern as working test page
  useEffect(() => {
    if (!containerRef.current) return;
    if (initializedRef.current) return; // Prevent double-init in StrictMode
    initializedRef.current = true;

    const xtermTheme = getXtermTheme(effectiveTheme);

    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: fontSize,
      fontFamily: fontFamily,
      theme: xtermTheme,
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    // Open terminal in container
    terminal.open(containerRef.current);
    fitAddon.fit();

    // Store refs
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Fit again after container has final dimensions
    setTimeout(() => fitAddon.fit(), 100);
    setTimeout(() => fitAddon.fit(), 500);

    // Show initial message
    terminal.writeln('\x1b[32mTerminal initialized.\x1b[0m');
    terminal.writeln('Connecting...');
    terminal.writeln('');

    setIsReady(true);

    // Handle user input - use ref to avoid stale closure
    // Don't send input if readOnly mode
    terminal.onData((data) => {
      if (!readOnlyRef.current) {
        send(data);
      }
    });

    // Connect to WebSocket - the hook will handle the case when token is not available
    connect();

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
      if (terminalRef.current) {
        resize(terminalRef.current.cols, terminalRef.current.rows);
      }
    };
    window.addEventListener('resize', handleResize);

    // Use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (terminalRef.current) {
        resize(terminalRef.current.cols, terminalRef.current.rows);
      }
    });
    resizeObserver.observe(containerRef.current);

    // Cleanup only runs on unmount, not on StrictMode double-invoke
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      // Don't disconnect here - let the hook handle it on unmount
    };
  }, []); // Empty deps - run once on mount

  // Separate cleanup for unmount
  useEffect(() => {
    return () => {
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
      if (fitAddonRef.current) {
        fitAddonRef.current = null;
      }
      disconnect();
      initializedRef.current = false;
    };
  }, [disconnect]);

  // Retry connection when token becomes available (if initial connect failed due to missing token)
  useEffect(() => {
    // If we have a token, are ready, but not connected and no active connection attempt
    if (token && isReady && !isConnected && error === 'No authentication token') {
      setError(null);
      if (terminalRef.current) {
        terminalRef.current.writeln('\x1b[32mToken received, reconnecting...\x1b[0m');
      }
      connect();
    }
  }, [token, isReady, isConnected, error, connect]);

  // Auto-start terminal when WebSocket connects
  useEffect(() => {
    if (isConnected && isReady && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      // Small delay to ensure connection is fully established
      setTimeout(() => {
        start();
      }, 200);
    }
  }, [isConnected, isReady, start]);

  // Track if onReady has been called
  const hasCalledOnReadyRef = useRef(false);

  // Call onReady once - when connected or after timeout
  const callOnReadyOnce = useCallback(() => {
    if (!hasCalledOnReadyRef.current) {
      hasCalledOnReadyRef.current = true;
      onReady?.();
    }
  }, [onReady]);

  // Clear terminal and notify parent when terminal is RUNNING
  useEffect(() => {
    if (status === TerminalStatus.RUNNING && fitAddonRef.current && terminalRef.current) {
      // Clear the "Connecting..." message when terminal is ready
      terminalRef.current.clear();

      setTimeout(() => {
        fitAddonRef.current?.fit();
        if (terminalRef.current) {
          resize(terminalRef.current.cols, terminalRef.current.rows);
        }
        callOnReadyOnce();
      }, 100);
    }
  }, [status, resize, callOnReadyOnce]);

  // Fallback: notify parent when WebSocket connects (even if not RUNNING yet)
  useEffect(() => {
    if (isConnected && isReady) {
      // Give it 2 seconds to reach RUNNING, then call onReady anyway
      const timeoutId = setTimeout(() => {
        callOnReadyOnce();
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [isConnected, isReady, callOnReadyOnce]);

  // Ultimate fallback: after 5 seconds, always show the terminal
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      callOnReadyOnce();
    }, 5000);
    return () => clearTimeout(timeoutId);
  }, [callOnReadyOnce]);

  // Update theme when effectiveTheme changes
  useEffect(() => {
    if (terminalRef.current) {
      const xtermTheme = getXtermTheme(effectiveTheme);
      terminalRef.current.options.theme = xtermTheme;
    }
  }, [effectiveTheme]);

  // Update font size when it changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.fontSize = fontSize;
      fitAddonRef.current?.fit();
    }
  }, [fontSize]);

  // Update font family when it changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.fontFamily = fontFamily;
      fitAddonRef.current?.fit();
    }
  }, [fontFamily]);

  // Refit when terminal becomes active (visible)
  useEffect(() => {
    if (isActive && fitAddonRef.current && terminalRef.current) {
      // Small delay to ensure the container is visible and has dimensions
      const timeoutId = setTimeout(() => {
        fitAddonRef.current?.fit();
        if (terminalRef.current) {
          resize(terminalRef.current.cols, terminalRef.current.rows);
        }
        // Focus the terminal when it becomes active
        terminalRef.current?.focus();
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [isActive, resize]);

  const handleStart = () => {
    terminalRef.current?.clear();
    terminalRef.current?.writeln('Launching terminal...');
    start();
  };

  const handleStop = () => {
    stop();
  };

  const handleReconnect = () => {
    disconnect();
    setTimeout(() => connect(), 500);
  };

  const handleFitTerminal = () => {
    fitAddonRef.current?.fit();
    if (terminalRef.current) {
      resize(terminalRef.current.cols, terminalRef.current.rows);
    }
  };

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Toolbar - can be hidden when using custom header */}
      {!hideToolbar && (
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', STATUS_COLORS[status])} />
              <span className="text-sm text-muted-foreground">
                {STATUS_LABELS[status]}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TerminalThemeSelector showLabel={false} />

            {status === TerminalStatus.STOPPED || status === TerminalStatus.CRASHED ? (
              <Button size="sm" variant="outline" onClick={handleStart}>
                <Play className="h-4 w-4 mr-1" />
                Start
              </Button>
            ) : status === TerminalStatus.RUNNING ? (
              <Button size="sm" variant="outline" onClick={handleStop}>
                <Square className="h-4 w-4 mr-1" />
                Stop
              </Button>
            ) : null}

            <Button size="sm" variant="ghost" onClick={handleReconnect}>
              <RefreshCw className="h-4 w-4" />
            </Button>

            {onClose && (
              <Button size="sm" variant="ghost" onClick={onClose} title="Remove from workspace">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Terminal container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{
          backgroundColor: currentTheme.colors.background,
          minHeight: 0,
        }}
      />
    </div>
  );
}
