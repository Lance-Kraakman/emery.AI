'use client';

import { useState, useEffect } from 'react';
import { Agent, Team } from '@/types/db';
import AgentFormDialog from './AgentFormDialog';
import AgentDetailsView from './AgentDetailsView';
import { getAgents } from '@/app/actions/agents';

interface AgentDashboardClientProps {
  initialAgents: Agent[];
  teams: Team[];
}

export default function AgentDashboardClient({ initialAgents, teams }: AgentDashboardClientProps) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const refreshAgents = async () => {
    setLoading(true);
    const fetchedAgents = await getAgents({
      teamId: selectedTeam,
      searchQuery: searchQuery,
    });
    setAgents(fetchedAgents);
    setLoading(false);
  };

  const filteredAgents = agents;

  return (
    <div className="flex space-x-6 h-[calc(100vh-10rem)]">
      {/* Left Pane: Agent List */}
      <div className="w-1/3 flex flex-col space-y-2">
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-2 py-1 border rounded bg-transparent"
          />
          <button
            onClick={() => {
              setEditingAgent(null);
              setIsFormOpen(true);
            }}
            className="bg-primary text-primary-foreground px-4 py-1 rounded"
          >
            + New
          </button>
        </div>
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="w-full px-2 py-1 border rounded bg-transparent"
        >
          <option value="">All Teams</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id.toString()}>
              {team.name}
            </option>
          ))}
        </select>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {loading ? (
            <p>Loading...</p>
          ) : (
            filteredAgents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={`p-4 rounded-lg cursor-pointer border transition-all ${
                  selectedAgent?.id === agent.id
                    ? 'bg-secondary border-primary'
                    : 'hover:bg-secondary'
                }`}
              >
                <h3 className="font-semibold text-foreground">{agent.name}</h3>
                <p className="text-sm text-muted-foreground">{agent.role}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Pane: Agent Details */}
      <div className="w-2/3 rounded-lg p-6 border">
        {selectedAgent ? (
          <AgentDetailsView
            agent={selectedAgent}
            onEdit={() => {
              setEditingAgent(selectedAgent);
              setIsFormOpen(true);
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full rounded-lg">
            <p className="text-muted-foreground">Select an agent to view details or create a new one.</p>
          </div>
        )}
      </div>

      <AgentFormDialog
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          refreshAgents();
        }}
        agent={editingAgent}
      />
    </div>
  );
}
