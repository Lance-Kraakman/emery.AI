'use client'

// AIDEV-NOTE: Client component for workspace list and creation forms - needs interactivity

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { createWorkspaceAction } from '@/app/actions/workspaces';
import { useUserId } from './UserIdProvider';

interface Workspace {
  id: number;
  name: string;
  userId: string;
}

interface WorkspaceListProps {
  workspaces: Workspace[];
  selectedWorkspace: number | null;
  onSelectWorkspace: (id: number) => void;
  onWorkspaceCreate?: () => void;
}

export default function WorkspaceList({ 
  workspaces, 
  selectedWorkspace, 
  onSelectWorkspace,
  onWorkspaceCreate
}: WorkspaceListProps) {
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { userId } = useUserId();

  async function handleCreateWorkspace(formData: FormData) {
    startTransition(async () => {
      try {
        await createWorkspaceAction(formData);
        setShowNewWorkspace(false);
        onWorkspaceCreate?.();
      } catch (error) {
        console.error('Error creating workspace:', error);
        alert('Failed to create workspace');
      }
    });
  }

  return (
    <div className="w-64 bg-white border-r min-h-screen p-4">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700">Workspaces</h2>
          <button
            onClick={() => setShowNewWorkspace(true)}
            className="p-1 text-gray-400 hover:text-gray-600"
            disabled={isPending}
          >
            <Plus size={16} />
          </button>
        </div>
        
        {showNewWorkspace && (
          <form action={handleCreateWorkspace} className="mb-3 space-y-2">
            <input type="hidden" name="userId" value={userId || ''} />
            <input
              type="text"
              name="name"
              placeholder="Workspace name"
              required
              className="w-full px-3 py-2 border rounded-md text-sm"
              disabled={isPending}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded disabled:opacity-50"
              >
                {isPending ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewWorkspace(false)}
                disabled={isPending}
                className="px-3 py-1 border text-sm rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        
        <div className="space-y-1">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => onSelectWorkspace(workspace.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                selectedWorkspace === workspace.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {workspace.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}