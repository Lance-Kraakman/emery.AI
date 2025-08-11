'use client';

import { useState } from 'react';
import { Agent, Team } from '@/types/db';
import TeamMembersPanel from './TeamMembersPanel';
import TeamActivityPanel from './TeamActivityPanel';

interface TeamDetailsViewProps {
  team: Team;
  agents: Agent[];
  onEdit: () => void;
}

export default function TeamDetailsView({ team, agents, onEdit }: TeamDetailsViewProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Get agents that belong to this team
  const teamAgents = agents.filter(agent => 
    team.agentIds && team.agentIds.includes(agent.id.toString())
  );

  return (
    <div className="text-foreground">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">{team.name}</h2>
        <button
          onClick={onEdit}
          className="bg-secondary text-secondary-foreground px-3 py-1 rounded text-sm hover:bg-muted"
        >
          Edit
        </button>
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`${
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className={`${
              activeTab === 'agents'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Agents ({teamAgents.length})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`${
              activeTab === 'members'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Members
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`${
              activeTab === 'activity'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Activity
          </button>
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-foreground">Purpose</h3>
              <p className="text-muted-foreground">{team.purpose || 'No purpose defined'}</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">Description</h3>
              <p className="text-muted-foreground">{team.description || 'No description provided'}</p>
            </div>
            {team.responsibilities && team.responsibilities.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-foreground">Responsibilities</h3>
                <ul className="text-muted-foreground list-disc list-inside space-y-1">
                  {team.responsibilities.map((responsibility, index) => (
                    <li key={index}>{responsibility}</li>
                  ))}
                </ul>
              </div>
            )}
            {team.goals && team.goals.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-foreground">Goals</h3>
                <ul className="text-muted-foreground list-disc list-inside space-y-1">
                  {team.goals.map((goal, index) => (
                    <li key={index}>{goal}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {activeTab === 'agents' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Team Agents</h3>
            {teamAgents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamAgents.map((agent) => (
                  <div key={agent.id} className="border rounded-lg p-4">
                    <h4 className="font-medium text-foreground">{agent.name}</h4>
                    <p className="text-sm text-muted-foreground">{agent.role}</p>
                    <p className="text-xs text-muted-foreground mt-1">{agent.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No agents assigned to this team.</p>
            )}
          </div>
        )}
        {activeTab === 'members' && (
          <TeamMembersPanel team={team} />
        )}
        {activeTab === 'activity' && (
          <TeamActivityPanel team={team} />
        )}
      </div>
    </div>
  );
}