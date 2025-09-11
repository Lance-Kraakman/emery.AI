'use client';

import { useEffect } from 'react';
import { useStore } from '@tanstack/react-store';
import { Search, Plus, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { TeamDTO } from '@/app/mappers/team-mapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { Badge } from '@/components/ui/badge';
import TeamDetailsView from './TeamDetailsView';
import TeamFormDialog from './TeamFormDialog';
import { teamsStore, teamsSelectors } from '@/stores/teams.store';
import { useEmeryOrganization } from '@/contexts/EmeryStoreProvider';
import { storeActions, teamsActions } from '@/stores/actions';

// AIDEV-NOTE: Teams dashboard migrated to TanStack Store for better state management and performance

interface TeamDashboardClientProps {
  initialTeams: TeamDTO[];
  agents: AgentDTO[];
}

export default function TeamDashboardClient({ initialTeams, agents }: TeamDashboardClientProps) {
  const currentOrganization = useEmeryOrganization();
  
  // Use TanStack Store with fine-grained subscriptions
  const teams = useStore(teamsStore, teamsSelectors.teams);
  const selectedTeam = useStore(teamsStore, teamsSelectors.selectedTeam);
  const searchQuery = useStore(teamsStore, teamsSelectors.searchQuery);
  const loading = useStore(teamsStore, teamsSelectors.loading);
  const error = useStore(teamsStore, teamsSelectors.error);
  const isPanelCollapsed = useStore(teamsStore, teamsSelectors.isPanelCollapsed);
  const isFormDialogOpen = useStore(teamsStore, teamsSelectors.isFormDialogOpen);
  const editingTeam = useStore(teamsStore, teamsSelectors.editingTeam);
  
  // Initialize store with initial data
  useEffect(() => {
    teamsActions.setTeams(initialTeams);
  }, [initialTeams]);

  const refreshTeams = async () => {
    if (currentOrganization?.id) {
      await storeActions.refreshTeams(currentOrganization.id);
    }
  };

  // Use store selector for filtered teams
  const filteredTeams = useStore(teamsStore, teamsSelectors.filteredTeams);

  return (
    <div className="flex h-full">
      {/* Left Pane: Team List */}
      <div
        className={`transition-all duration-300 ${
          isPanelCollapsed ? 'w-12' : 'w-1/4'
        } border-r flex flex-col`}
      >
        <div className="flex items-center p-2">
          {!isPanelCollapsed && <h2 className="text-lg font-semibold">Teams</h2>}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => teamsActions.togglePanelCollapsed()}
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
                placeholder="Search teams..."
                value={searchQuery}
                onChange={(e) => teamsActions.setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => storeActions.openTeamForm()}
              variant="default"
              size="sm"
            >
              <Plus size={16} />
              New
            </Button>
            
            <div className="flex-1 overflow-y-auto space-y-2">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-4">
              {error}
            </div>
          )}
          {loading ? (
            <Loading text="Loading teams..." />
          ) : filteredTeams.length === 0 ? (
            <EmptyState
              title="No teams found"
              description="Create your first team to get started"
              action={{
                label: "Create Team",
                onClick: () => storeActions.openTeamForm()
              }}
            />
          ) : (
            filteredTeams.map((team) => (
              <Card
                key={team.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedTeam?.id === team.id
                    ? 'ring-2 ring-primary bg-secondary'
                    : ''
                }`}
                onClick={() => {
                  teamsActions.setSelectedTeam(team);
                }}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <Users size={14} className="text-muted-foreground flex-shrink-0" />
                        <h3 className="font-medium text-sm text-foreground truncate">{team.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {team.purpose || 'No purpose defined'}
                      </p>
                    </div>
                    {team.agentIds && team.agentIds.length > 0 && (
                      <Badge variant="outline" className="text-xs h-5 ml-2 flex-shrink-0">
                        {team.agentIds.length}
                      </Badge>
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

      {/* Right Pane: Team Details or Editor */}
      <div className="flex-1 p-0">
        <Card className="h-full rounded-none border-none">
          <CardContent className="p-6 h-full">
            {selectedTeam ? (
              <TeamDetailsView
                team={selectedTeam}
                agents={agents}
                onEdit={() => {
                  storeActions.openTeamForm(selectedTeam);
                }}
                onUpdate={refreshTeams}
              />
            ) : (
              <EmptyState
                title="Select a team"
                description="Choose a team from the list to view details and manage members"
                className="text-left justify-start"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Form Dialog */}
      <TeamFormDialog
        isOpen={isFormDialogOpen}
        onClose={() => {
          storeActions.closeTeamForm();
        }}
        team={editingTeam}
        agents={agents}
        onUpdate={refreshTeams}
      />
    </div>
  );
}