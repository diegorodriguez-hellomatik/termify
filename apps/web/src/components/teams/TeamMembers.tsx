'use client';

import { useState } from 'react';
import {
  UserPlus,
  MoreVertical,
  Crown,
  Shield,
  User,
  UserMinus,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TeamMember, TeamRole } from '@/lib/api';

interface TeamMembersProps {
  members: TeamMember[];
  currentUserRole: TeamRole;
  onInvite?: () => void;
  onUpdateRole?: (memberId: string, role: 'ADMIN' | 'MEMBER') => Promise<any>;
  onRemove?: (memberId: string) => Promise<boolean>;
}

const ROLE_ICONS: Record<TeamRole, React.FC<{ className?: string }>> = {
  OWNER: Crown,
  ADMIN: Shield,
  MEMBER: User,
};

const ROLE_LABELS: Record<TeamRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
};

const ROLE_COLORS: Record<TeamRole, string> = {
  OWNER: 'text-yellow-500',
  ADMIN: 'text-blue-500',
  MEMBER: 'text-muted-foreground',
};

function MemberItem({
  member,
  currentUserRole,
  onUpdateRole,
  onRemove,
}: {
  member: TeamMember;
  currentUserRole: TeamRole;
  onUpdateRole?: (memberId: string, role: 'ADMIN' | 'MEMBER') => Promise<any>;
  onRemove?: (memberId: string) => Promise<boolean>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const RoleIcon = ROLE_ICONS[member.role];

  const canManage =
    currentUserRole === 'OWNER' ||
    (currentUserRole === 'ADMIN' && member.role === 'MEMBER');

  const handleRoleChange = async (newRole: 'ADMIN' | 'MEMBER') => {
    if (!onUpdateRole) return;
    setLoading(true);
    try {
      await onUpdateRole(member.id, newRole);
    } finally {
      setLoading(false);
      setMenuOpen(false);
    }
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    setLoading(true);
    try {
      await onRemove(member.id);
    } finally {
      setLoading(false);
      setMenuOpen(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-muted/50 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
          {member.image ? (
            <img
              src={member.image}
              alt={member.name || member.email}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            (member.name || member.email).charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <p className="text-sm font-medium">{member.name || member.email}</p>
          {member.name && (
            <p className="text-xs text-muted-foreground">{member.email}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={cn('flex items-center gap-1 text-xs', ROLE_COLORS[member.role])}>
          <RoleIcon className="h-3.5 w-3.5" />
          <span>{ROLE_LABELS[member.role]}</span>
        </div>
        {canManage && member.role !== 'OWNER' && (
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMenuOpen(!menuOpen)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreVertical className="h-4 w-4" />
              )}
            </Button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-popover border rounded-md shadow-lg z-20">
                  {currentUserRole === 'OWNER' && (
                    <>
                      {member.role === 'MEMBER' && onUpdateRole && (
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                          onClick={() => handleRoleChange('ADMIN')}
                        >
                          <Shield className="h-4 w-4" />
                          Make Admin
                        </button>
                      )}
                      {member.role === 'ADMIN' && onUpdateRole && (
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                          onClick={() => handleRoleChange('MEMBER')}
                        >
                          <User className="h-4 w-4" />
                          Make Member
                        </button>
                      )}
                    </>
                  )}
                  {onRemove && (
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left text-destructive"
                      onClick={handleRemove}
                    >
                      <UserMinus className="h-4 w-4" />
                      Remove
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TeamMembers({
  members,
  currentUserRole,
  onInvite,
  onUpdateRole,
  onRemove,
}: TeamMembersProps) {
  // Sort members: OWNER first, then ADMIN, then MEMBER
  const sortedMembers = [...members].sort((a, b) => {
    const order: Record<TeamRole, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };
    return order[a.role] - order[b.role];
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {members.length} {members.length === 1 ? 'Member' : 'Members'}
        </h3>
        {onInvite && (
          <Button size="sm" variant="outline" onClick={onInvite}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite
          </Button>
        )}
      </div>
      <div className="space-y-1">
        {sortedMembers.map((member) => (
          <MemberItem
            key={member.id}
            member={member}
            currentUserRole={currentUserRole}
            onUpdateRole={onUpdateRole}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}
