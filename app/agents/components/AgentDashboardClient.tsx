'use client';

import { useState, useEffect } from 'react';
import { Agent, Team } from '@/types/db';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import AgentFormDialog from './AgentFormDialog';
import AgentConfigurationWizard from './AgentConfigurationWizard';
import AgentDetailsView from './AgentDetailsView';
import { getAgents } from '@/app/actions/agents';

// AIDEV-NOTE: Agent dashboard refactored to use consistent design system patterns and improved UX

interface AgentDashboardClientProps {
  initialAgents: Agent[];
  teams: Team[];
}

export default function AgentDashboardClient({ initialAgents, teams }: AgentDashboardClientProps) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const refreshAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedAgents = await getAgents({
        teamId: selectedTeam,
        searchQuery: searchQuery,
      });
      setAgents(fetchedAgents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agent.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Check if agent belongs to selected team (teams have agentIds array)
    let matchesTeam = selectedTeam === 'all';
    if (selectedTeam !== 'all') {
      const team = teams.find(t => t.id.toString() === selectedTeam);
      matchesTeam = team?.agentIds?.includes(agent.id.toString()) || false;
    }
    
    return matchesSearch && matchesTeam;
  });

  return (
    <div className="flex h-full">
      {/* Left Pane: Agent List */}
      <div
        className={`transition-all duration-300 ${
          isPanelCollapsed ? 'w-12' : 'w-1/4'
        } border-r flex flex-col`}
      >
        <div className="flex items-center p-2">
          {!isPanelCollapsed && <h2 className="text-lg font-semibold">Agents</h2>}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
            className="ml-auto"
          >
            {isPanelCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
        {!isPanelCollapsed && (
          <div className="p-2 flex flex-col gap-4 flex-grow">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => {
                setEditingAgent(null);
                setIsWizardOpen(true);
              }}
              variant="success"
              size="sm"
            >
              <Plus size={16} />
              New
            </Button>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger>
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id.toString()}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1 overflow-y-auto space-y-2">
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-4">
                  {error}
                </div>
              )}
              {loading ? (
                <Loading text="Loading agents..." />
              ) : filteredAgents.length === 0 ? (
                <EmptyState
                  title="No agents found"
                  description="Create your first agent to get started"
                  action={{
                    label: "Create Agent",
                    onClick: () => {
                      setEditingAgent(null);
                      setIsWizardOpen(true);
                    }
                  }}
                />
              ) : (
                filteredAgents.map((agent) => (
                  <Card
                    key={agent.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedAgent?.id === agent.id
                        ? 'ring-2 ring-primary bg-secondary'
                        : ''
                    }`}
                    onClick={() => setSelectedAgent(agent)}
                  >
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-foreground">{agent.name}</h3>
                      <p className="text-sm text-muted-foreground">{agent.role || 'No role specified'}</p>
                      {agent.status && (
                        <span className={`inline-block px-2 py-1 text-xs rounded-full mt-2 ${
                          agent.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {agent.status}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Pane: Agent Details or Editor */}
      <div className="flex-1 p-0">
        <Card className="h-full rounded-none border-none">
          <CardContent className="p-6 h-full">
            {isWizardOpen ? (
              <AgentConfigurationWizard
                agent={editingAgent}
                onClose={() => {
                  setIsWizardOpen(false);
                  setEditingAgent(null);
                }}
                onSuccess={() => {
                  refreshAgents();
                  setIsWizardOpen(false);
                  setEditingAgent(null);
                }}
              />
            ) : selectedAgent ? (
              <AgentDetailsView
                agent={selectedAgent}
                onEdit={() => {
                  setEditingAgent(selectedAgent);
                  setIsWizardOpen(true);
                }}
              />
            ) : (
              <EmptyState
                title="Select an agent"
                description="Choose an agent from the list to view details and manage capabilities"
                className="text-left justify-start"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
