'use client';

import { useState, useEffect } from 'react';
import type { TeamDTO } from '@/app/mappers/team-mapper';
import { getTeamMembers, addTeamMember, removeTeamMember } from '@/app/actions/teams';

interface TeamMembersPanelProps {
  team: TeamDTO;
}

interface TeamAgentsData {
  teamId: any; // TeamId Value Object
  agentIds: any[]; // AgentId[] Value Objects  
}

export default function TeamMembersPanel({ team }: TeamMembersPanelProps) {
  const [teamAgents, setTeamAgents] = useState<TeamAgentsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMembers();
  }, [team.id]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const teamMembers = await getTeamMembers(team.id);
      setTeamAgents(teamMembers);
    } catch (error) {
      console.error('Failed to load team members:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading team members...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-foreground">Team Members</h3>
        <button className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm">
          Add Member
        </button>
      </div>

      {teamAgents?.agentIds && teamAgents.agentIds.length > 0 ? (
        <div className="space-y-2">
          {teamAgents.agentIds.map((agentId, index) => (
            <div key={agentId || index} className="flex justify-between items-center p-3 border rounded">
              <div>
                <p className="font-medium text-foreground">Agent ID: {agentId}</p>
                <p className="text-sm text-muted-foreground">
                  Type: Team Agent
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await removeTeamMember(team.id, agentId);
                    loadMembers();
                  } catch (error) {
                    console.error('Failed to remove agent:', error);
                  }
                }}
                className="text-destructive hover:text-destructive/80 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>No agents in this team yet.</p>
          <p className="text-sm">Add agents to collaborate on team goals.</p>
        </div>
      )}
    </div>
  );
}