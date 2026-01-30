'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { workspacesApi } from '@/lib/api';

// Import the workspace content from parent - we'll refactor to share
import WorkspacePage from '../page';

export default function WorkspaceByIdPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { switchWorkspace, workspaces, loadingWorkspaces, currentWorkspaceId, refreshWorkspaces } = useWorkspace();
  const [isReady, setIsReady] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const workspaceId = params?.id as string;

  useEffect(() => {
    const accessToken = session?.accessToken;
    if (loadingWorkspaces || !accessToken) return;

    const loadWorkspace = async () => {
      // Check if workspace exists in personal workspaces
      const workspace = workspaces.find(w => w.id === workspaceId);

      if (workspace) {
        // Switch to this workspace if not already
        if (currentWorkspaceId !== workspaceId) {
          await switchWorkspace(workspaceId);
        }
        setIsReady(true);
      } else {
        // Workspace not in personal list - try to fetch it directly
        // This handles team workspaces
        try {
          const response = await workspacesApi.get(workspaceId, accessToken);
          if (response.success && response.data) {
            // Workspace exists (could be a team workspace), refresh workspaces and switch
            await refreshWorkspaces();
            await switchWorkspace(workspaceId);
            setIsReady(true);
          } else {
            setNotFound(true);
          }
        } catch {
          setNotFound(true);
        }
      }
    };

    loadWorkspace();
  }, [workspaceId, workspaces, loadingWorkspaces, switchWorkspace, currentWorkspaceId, session?.accessToken, refreshWorkspaces]);

  useEffect(() => {
    if (notFound) {
      router.replace('/workspace');
    }
  }, [notFound, router]);

  if (!isReady || loadingWorkspaces) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Render the workspace page - it will detect the URL and show workspace view
  return <WorkspacePage />;
}
