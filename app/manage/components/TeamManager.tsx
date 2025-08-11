'use client';

import { useState } from 'react';
import { createTeamAction, deleteTeam } from '@/app/actions/teams';
import { Team } from '@/types/db';

interface Organization {
  id: number;
  name: string;
}

interface TeamManagerProps {
  teams: Team[];
  organizations: Organization[];
}

export default function TeamManager({ teams, organizations }: TeamManagerProps) {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="border rounded p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Teams</h2>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
        >
          {isCreating ? 'Cancel' : 'Add Team'}
        </button>
      </div>

      {isCreating && (
        <form action={createTeamAction} className="mb-4 p-3 border rounded bg-gray-50">
          <div className="space-y-2">
            <select name="organizationId" required className="w-full p-2 border rounded">
              <option value="">Select organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <input
              name="name"
              placeholder="Team name"
              required
              className="w-full p-2 border rounded"
            />
            <input
              name="purpose"
              placeholder="Purpose (optional)"
              className="w-full p-2 border rounded"
            />
            <textarea
              name="description"
              placeholder="Description (optional)"
              className="w-full p-2 border rounded"
              rows={2}
            />
            <input
              name="responsibilities"
              placeholder="Responsibilities (comma-separated)"
              className="w-full p-2 border rounded"
            />
            <input
              name="goals"
              placeholder="Goals (comma-separated)"
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
        {teams.map((team) => {
          const org = organizations.find(o => o.id === team.organizationId);
          return (
            <div key={team.id} className="flex justify-between items-start p-2 border rounded">
              <div className="flex-1">
                <h3 className="font-medium">{team.name}</h3>
                <p className="text-xs text-gray-500">Org: {org?.name}</p>
                {team.purpose && <p className="text-sm text-gray-600">{team.purpose}</p>}
                {team.responsibilities && team.responsibilities.length > 0 && (
                  <p className="text-xs text-gray-500">Responsibilities: {team.responsibilities.join(', ')}</p>
                )}
              </div>
              <button
                onClick={async () => {
                  if (confirm('Delete this team?')) {
                    await deleteTeam(team.id);
                    window.location.reload();
                  }
                }}
                className="bg-red-500 text-white px-2 py-1 rounded text-xs"
              >
                Delete
              </button>
            </div>
          );
        })}
        {teams.length === 0 && (
          <p className="text-gray-500 text-center py-4">No teams found</p>
        )}
      </div>
    </div>
  );
}