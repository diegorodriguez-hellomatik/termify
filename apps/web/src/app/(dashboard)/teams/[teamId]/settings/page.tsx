'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Trash2, Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { useTeams } from '@/hooks/useTeams';
import { Team } from '@/lib/api';
import { TeamNotificationSettings } from '@/components/teams/TeamNotificationSettings';
import { TeamRolesManager } from '@/components/teams/TeamRolesManager';
import { cn } from '@/lib/utils';

const TEAM_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

export default function TeamSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params?.teamId as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { getTeam, updateTeam, deleteTeam, uploadTeamImage } = useTeams();

  const loadTeam = useCallback(async () => {
    if (!teamId) return;
    const teamData = await getTeam(teamId);
    if (teamData) {
      setTeam(teamData);
      setName(teamData.name);
      setDescription(teamData.description || '');
      setColor(teamData.color || '#6366f1');
    }
  }, [teamId, getTeam]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const canEdit = team?.role === 'OWNER' || team?.role === 'ADMIN';
  const canDelete = team?.role === 'OWNER';

  const handleSave = async () => {
    if (!name.trim() || !teamId) return;
    setSaving(true);
    try {
      await updateTeam(teamId, {
        name: name.trim(),
        description: description.trim() || null,
        color,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!teamId) return;
    setDeleting(true);
    try {
      const success = await deleteTeam(teamId);
      if (success) {
        router.push('/teams');
      }
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !teamId) return;

    setUploadingImage(true);
    try {
      await uploadTeamImage(teamId, file);
      loadTeam();
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = async () => {
    if (!teamId) return;
    setSaving(true);
    try {
      await updateTeam(teamId, { image: null });
      loadTeam();
    } finally {
      setSaving(false);
    }
  };

  if (!team || !canEdit) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">You don't have permission to access settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Settings */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="text-sm font-medium">Team Settings</h3>

          {/* Team Avatar */}
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Team Avatar
            </label>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-2xl font-semibold overflow-hidden relative group"
                style={{ backgroundColor: team.image ? undefined : color }}
              >
                {team.image ? (
                  <>
                    <img src={team.image} alt={team.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={saving}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X className="h-6 w-6 text-white" />
                    </button>
                  </>
                ) : (
                  team.icon || team.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingImage}
                    asChild
                  >
                    <span>
                      {uploadingImage ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4 mr-2" />
                      )}
                      Upload Image
                    </span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or WebP. Max 5MB.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Team Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this team for?"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    'w-8 h-8 rounded-full transition-all',
                    color === c && 'ring-2 ring-offset-2 ring-offset-background ring-primary'
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  disabled={saving}
                />
              ))}
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-medium mb-4">Notification Preferences</h3>
          <TeamNotificationSettings teamId={teamId} />
        </CardContent>
      </Card>

      {/* Custom Roles */}
      <Card>
        <CardContent className="p-4">
          <TeamRolesManager teamId={teamId} canManage={canEdit} />
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {canDelete && (
        <Card className="border-destructive/50">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-destructive mb-2">Danger Zone</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Deleting a team will remove all tasks and member associations.
              This action cannot be undone.
            </p>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Team
            </Button>
          </CardContent>
        </Card>
      )}

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Team"
        itemName={team.name}
        itemType="team"
        description="This will remove all tasks and member associations."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
