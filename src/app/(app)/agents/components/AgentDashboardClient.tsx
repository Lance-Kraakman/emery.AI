'use client';

import React, { useEffect } from 'react';
import { useStore } from '@tanstack/react-store';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { TeamDTO } from '@/app/mappers/team-mapper';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { NewAgentDetailsView } from './NewAgentDetailsView';
import AgentCreateView from './AgentCreateView';
import { agentsStore, agentsSelectors } from '@/stores/agents.store';
import { storeActions, agentsActions } from '@/stores/actions';

// AIDEV-NOTE: Agent dashboard migrated to TanStack Store for better state management and performance
interface AgentDashboardClientProps {
  initialAgents: AgentDTO[];
  teams: TeamDTO[];
}

export default function AgentDashboardClient({ initialAgents, teams }: AgentDashboardClientProps) {
  // Use TanStack Store with fine-grained subscriptions
  const agents = useStore(agentsStore, agentsSelectors.agents);
  const selectedAgent = useStore(agentsStore, agentsSelectors.selectedAgent);
  const searchQuery = useStore(agentsStore, agentsSelectors.searchQuery);
  const selectedTeam = useStore(agentsStore, agentsSelectors.selectedTeam);
  const loading = useStore(agentsStore, agentsSelectors.loading);
  const error = useStore(agentsStore, agentsSelectors.error);
  const isPanelCollapsed = useStore(agentsStore, agentsSelectors.isPanelCollapsed);
  const isCreateMode = useStore(agentsStore, agentsSelectors.isCreateMode);
  
  // Initialize store with initial data
  useEffect(() => {
    agentsActions.setAgents(initialAgents);
  }, [initialAgents]);

  const refreshAgents = async () => {
    await storeActions.refreshAgents();
  };

  const handleCreateAgent = () => {
    storeActions.openAgentCreateForm();
  };

  const handleCancelCreate = () => {
    storeActions.closeAgentCreateForm();
  };

  // Use store selector for filtered agents
  const filteredAgents = useStore(agentsStore, (state) => 
    agentsSelectors.filteredAgents(teams)(state)
  );

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
            onClick={() => agentsActions.togglePanelCollapsed()}
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
                onChange={(e) => agentsActions.setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              onClick={handleCreateAgent}
            >
              <Plus size={16} className="mr-2" />
              New Agent
            </Button>
            <Select value={selectedTeam} onValueChange={(value) => agentsActions.setSelectedTeam(value)}>
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
                <div className="text-center p-8">
                  <h3 className="text-xl font-semibold text-foreground mb-2">No agents found</h3>
                  <p className="text-md text-muted-foreground mb-4">
                    Create your first agent to get started
                  </p>
                  <Button
                    onClick={handleCreateAgent}
                  >
                    <Plus size={16} className="mr-2" />
                    Create Agent
                  </Button>
                </div>
              ) : (
                filteredAgents.map((agent) => (
                  <Card
                    key={agent.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedAgent?.id === agent.id
                        ? 'ring-2 ring-primary bg-secondary'
                        : ''
                    }`}
                    onClick={() => {
                      agentsActions.setSelectedAgent(agent);
                      agentsActions.setCreateMode(false);
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm text-foreground truncate">{agent.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {agent.role || 'No role specified'}
                          </p>
                        </div>
                        {agent.status && (
                          <span className={`inline-block px-1.5 py-0.5 text-xs rounded-full ml-2 flex-shrink-0 ${
                            agent.status === 'active' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-muted/50 text-muted-foreground'
                          }`}>
                            {agent.status}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Pane: Agent Details, Create Form, or Selection Prompt */}
      <div className="flex-1 p-0">
        <Card className="h-full rounded-none border-none">
          <CardContent className="p-6 h-full">
            {isCreateMode ? (
              <AgentCreateView
                onCancel={handleCancelCreate}
                onCreated={refreshAgents}
              />
            ) : selectedAgent ? (
              <NewAgentDetailsView
                agent={selectedAgent}
                onBack={() => agentsActions.setSelectedAgent(null)}
                onUpdate={refreshAgents}
              />
            ) : (
              <div className="text-center p-8 h-full flex flex-col items-center justify-center">
                <h3 className="text-2xl font-bold text-foreground mb-2">Select an agent</h3>
                <p className="text-lg text-muted-foreground mb-4">
                  Choose an agent from the list to view details and manage capabilities
                </p>
                <Button
                  onClick={handleCreateAgent}
                  className="mt-2"
                >
                  <Plus size={16} className="mr-2" />
                  Create New Agent
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
