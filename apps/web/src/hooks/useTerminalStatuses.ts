import { useMemo } from 'react';
import { TerminalStatus } from '@termify/shared';

interface TerminalData {
  id: string;
  name: string;
  status: TerminalStatus;
  lastActiveAt: string | null;
  createdAt: string;
  categoryId: string | null;
  isFavorite?: boolean;
  category?: { id: string; name: string; color: string } | null;
}

interface StatusSummary {
  running: number;
  crashed: number;
  stopped: number;
  starting: number;
  total: number;
}

interface UseTerminalStatusesReturn {
  summary: StatusSummary;
  filterByStatus: (
    terminals: TerminalData[],
    status: TerminalStatus | null
  ) => TerminalData[];
}

export function useTerminalStatuses(
  terminals: TerminalData[]
): UseTerminalStatusesReturn {
  const summary = useMemo(() => {
    const counts: StatusSummary = {
      running: 0,
      crashed: 0,
      stopped: 0,
      starting: 0,
      total: terminals.length,
    };

    for (const terminal of terminals) {
      switch (terminal.status) {
        case TerminalStatus.RUNNING:
          counts.running++;
          break;
        case TerminalStatus.CRASHED:
          counts.crashed++;
          break;
        case TerminalStatus.STOPPED:
          counts.stopped++;
          break;
        case TerminalStatus.STARTING:
          counts.starting++;
          break;
      }
    }

    return counts;
  }, [terminals]);

  const filterByStatus = (
    terminals: TerminalData[],
    status: TerminalStatus | null
  ): TerminalData[] => {
    if (status === null) {
      return terminals;
    }
    return terminals.filter((t) => t.status === status);
  };

  return { summary, filterByStatus };
}
