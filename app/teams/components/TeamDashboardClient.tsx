'use client';

import { useState, useEffect } from 'react';
import { Agent, Team } from '@/types/db';
import TeamFormDialog from './TeamFormDialog';
import TeamDetailsView from './TeamDetailsView';
import { getTeams } from '@/app/actions/teams';

interface TeamDashboardClientProps {
  initialTeams: Team[];
  agents: Agent[];
}

export default function TeamDashboardClient({ initialTeams, agents }: TeamDashboardClientProps) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const refreshTeams = async () => {
    setLoading(true);
    try {
      const fetchedTeams = await getTeams();
      setTeams(fetchedTeams);
    } catch (error) {
      console.error('Failed to refresh teams:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter teams based on search query
  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (team.purpose && team.purpose.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (team.description && team.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex space-x-6 h-[calc(100vh-10rem)]">
      {/* Left Pane: Team List */}
      <div className="w-1/3 flex flex-col space-y-2">
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-2 py-1 border rounded bg-transparent"
          />
          <button
            onClick={() => {
              setEditingTeam(null);
              setIsFormOpen(true);
            }}
            className="bg-primary text-primary-foreground px-4 py-1 rounded"
          >
            + New
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {loading ? (
            <p>Loading...</p>
          ) : (
            filteredTeams.map((team) => (
              <div
                key={team.id}
                onClick={() => setSelectedTeam(team)}
                className={`p-4 rounded-lg cursor-pointer border transition-all ${
                  selectedTeam?.id === team.id
                    ? 'bg-secondary border-primary'
                    : 'hover:bg-secondary'
                }`}
              >
                <h3 className="font-semibold text-foreground">{team.name}</h3>
                <p className="text-sm text-muted-foreground">{team.purpose || 'No purpose defined'}</p>
                {team.agentIds && team.agentIds.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {team.agentIds.length} agent{team.agentIds.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Pane: Team Details */}
      <div className="w-2/3 rounded-lg p-6 border">
        {selectedTeam ? (
          <TeamDetailsView
            team={selectedTeam}
            agents={agents}
            onEdit={() => {
              setEditingTeam(selectedTeam);
              setIsFormOpen(true);
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full rounded-lg">
            <p className="text-muted-foreground">Select a team to view details or create a new one.</p>
          </div>
        )}
      </div>

      <TeamFormDialog
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          refreshTeams();
        }}
        team={editingTeam}
        agents={agents}
      />
    </div>
  );
}