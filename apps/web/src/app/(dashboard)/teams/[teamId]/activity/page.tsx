'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { History, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTeams } from '@/hooks/useTeams';
import { Team } from '@/lib/api';
import { TeamHistoryPage } from '@/components/teams/TeamHistoryPage';
import { TeamAuditLogs } from '@/components/teams/TeamAuditLogs';

export default function TeamActivityPage() {
  const params = useParams();
  const teamId = params?.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  const { getTeam } = useTeams();

  const loadTeam = useCallback(async () => {
    if (!teamId) return;
    const teamData = await getTeam(teamId);
    if (teamData) setTeam(teamData);
  }, [teamId, getTeam]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const canEdit = team?.role === 'OWNER' || team?.role === 'ADMIN';

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex gap-2">
          <Button
            variant={!showAuditLogs ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowAuditLogs(false)}
          >
            <History className="h-4 w-4 mr-2" />
            Command History
          </Button>
          <Button
            variant={showAuditLogs ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowAuditLogs(true)}
          >
            <Activity className="h-4 w-4 mr-2" />
            Audit Logs
          </Button>
        </div>
      )}
      {showAuditLogs && canEdit ? (
        <TeamAuditLogs teamId={teamId} />
      ) : (
        <TeamHistoryPage teamId={teamId} />
      )}
    </div>
  );
}
