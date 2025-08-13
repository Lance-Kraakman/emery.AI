'use client';

import { useState, useEffect } from 'react';
import { Team } from '@/types/db';
import { getTeamMembers, addTeamMember, removeTeamMember } from '@/app/actions/teams';

interface TeamMembersPanelProps {
  team: Team;
}

interface TeamMembership {
  id: number;
  teamId: number;
  userId: string;
  createdAt: Date | null;
}

export default function TeamMembersPanel({ team }: TeamMembersPanelProps) {
  const [members, setMembers] = useState<TeamMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMembers();
  }, [team.id]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const teamMembers = await getTeamMembers(team.id);
      setMembers(teamMembers);
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

      {members.length > 0 ? (
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex justify-between items-center p-3 border rounded">
              <div>
                <p className="font-medium text-foreground">User ID: {member.userId}</p>
                <p className="text-sm text-muted-foreground">
                  Joined: {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'Unknown'}
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await removeTeamMember(member.id);
                    loadMembers();
                  } catch (error) {
                    console.error('Failed to remove member:', error);
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
          <p>No members in this team yet.</p>
          <p className="text-sm">Add members to collaborate on team goals.</p>
        </div>
      )}
    </div>
  );
}