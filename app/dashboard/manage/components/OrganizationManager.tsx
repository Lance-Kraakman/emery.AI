'use client';

import { useState } from 'react';
import { createOrganizationAction, deleteOrganization } from '@/app/actions/organizations';

interface Organization {
  id: number;
  name: string;
  mission: string | null;
  sharedTools: string[] | null;
  createdAt: Date | null;
}

interface OrganizationManagerProps {
  organizations: Organization[];
}

export default function OrganizationManager({ organizations }: OrganizationManagerProps) {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="border rounded p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Organizations</h2>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
        >
          {isCreating ? 'Cancel' : 'Add Organization'}
        </button>
      </div>

      {isCreating && (
        <form action={createOrganizationAction} className="mb-4 p-3 border rounded bg-gray-50">
          <div className="space-y-2">
            <input
              name="name"
              placeholder="Organization name"
              required
              className="w-full p-2 border rounded"
            />
            <textarea
              name="mission"
              placeholder="Mission (optional)"
              className="w-full p-2 border rounded"
              rows={2}
            />
            <input
              name="sharedTools"
              placeholder="Shared tools (comma-separated)"
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="bg-green-500 text-white px-3 py-1 rounded text-sm">
              Create
            </button>
            <button 
              type="button" 
              onClick={() => setIsCreating(false)}
              className="bg-gray-500 text-white px-3 py-1 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {organizations.map((org) => (
          <div key={org.id} className="flex justify-between items-start p-2 border rounded">
            <div className="flex-1">
              <h3 className="font-medium">{org.name}</h3>
              {org.mission && <p className="text-sm text-gray-600">{org.mission}</p>}
              {org.sharedTools && org.sharedTools.length > 0 && (
                <p className="text-xs text-gray-500">Tools: {org.sharedTools.join(', ')}</p>
              )}
            </div>
            <button
              onClick={async () => {
                if (confirm('Delete this organization?')) {
                  await deleteOrganization(org.id);
                  window.location.reload();
                }
              }}
              className="bg-red-500 text-white px-2 py-1 rounded text-xs"
            >
              Delete
            </button>
          </div>
        ))}
        {organizations.length === 0 && (
          <p className="text-gray-500 text-center py-4">No organizations found</p>
        )}
      </div>
    </div>
  );
}