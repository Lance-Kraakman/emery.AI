'use client';

import { useState } from 'react';
import type { Agent } from '@/ddd/domain/agents/entities/agent';
import type { Team } from '@/ddd/domain/teams/entities/team';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
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
      const team = teams.find(t => t.id.value.toString() === selectedTeam);
      matchesTeam = team?.agentIds?.some(agentId => agentId.value === agent.id.value) || false;
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
            >
              <Plus size={16} className="mr-2" />
              New Agent
            </Button>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger>
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id.value} value={team.id.value.toString()}>
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
                <div className="text-center p-8">
                  <h3 className="text-xl font-semibold text-foreground mb-2">No agents found</h3>
                  <p className="text-md text-muted-foreground mb-4">
                    Create your first agent to get started
                  </p>
                  <Button
                    onClick={() => {
                      setEditingAgent(null);
                      setIsWizardOpen(true);
                    }}
                  >
                    <Plus size={16} className="mr-2" />
                    Create Agent
                  </Button>
                </div>
              ) : (
                filteredAgents.map((agent) => (
                  <Card
                    key={agent.id.value}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedAgent?.id === agent.id
                        ? 'ring-2 ring-primary bg-secondary'
                        : ''
                    }`}
                    onClick={() => {
                      setSelectedAgent(agent);
                      // If in edit mode, update the editing agent as well
                      if (isWizardOpen) {
                        setEditingAgent(agent);
                      }
                    }}
                  >
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-foreground">{agent.name}</h3>
                      <p className="text-sm text-muted-foreground">{agent.role || 'No role specified'}</p>
                      {agent.status && (
                        <span className={`inline-block px-2 py-1 text-xs rounded-full mt-2 ${
                          agent.status.value === 'active' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-muted/50 text-muted-foreground'
                        }`}>
                          {agent.status.value}
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
              <div className="text-center p-8 h-full flex flex-col items-center justify-center">
                <h3 className="text-2xl font-bold text-foreground mb-2">Select an agent</h3>
                <p className="text-lg text-muted-foreground">
                  Choose an agent from the list to view details and manage capabilities
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
