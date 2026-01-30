'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTeams } from '@/hooks/useTeams';
import { Team } from '@/lib/api';
import { TeamMembers } from '@/components/teams/TeamMembers';
import { InviteMemberModal } from '@/components/teams/InviteMemberModal';

export default function TeamMembersPage() {
  const params = useParams();
  const teamId = params?.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const { getTeam, inviteMember, updateMemberRole, removeMember } = useTeams();

  const loadTeam = useCallback(async () => {
    if (!teamId) return;
    const teamData = await getTeam(teamId);
    if (teamData) setTeam(teamData);
  }, [teamId, getTeam]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const canEdit = team?.role === 'OWNER' || team?.role === 'ADMIN';
  const canInvite = team?.role === 'OWNER' || team?.role === 'ADMIN';

  const handleInviteMember = async (email: string, role?: 'ADMIN' | 'MEMBER') => {
    if (!teamId) return null;
    const result = await inviteMember(teamId, { email, role });
    if (result) loadTeam();
    return result;
  };

  const handleUpdateMemberRole = async (memberId: string, role: 'ADMIN' | 'MEMBER') => {
    if (!teamId) return null;
    const result = await updateMemberRole(teamId, memberId, role);
    if (result) loadTeam();
    return result;
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!teamId) return false;
    const success = await removeMember(teamId, memberId);
    if (success) loadTeam();
    return success;
  };

  if (!team) return null;

  return (
    <>
      <TeamMembers
        members={team.members || []}
        currentUserRole={team.role}
        onInvite={canInvite ? () => setInviteModalOpen(true) : undefined}
        onUpdateRole={canEdit ? handleUpdateMemberRole : undefined}
        onRemove={canEdit ? handleRemoveMember : undefined}
      />

      <InviteMemberModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        onInvite={handleInviteMember}
      />
    </>
  );
}
