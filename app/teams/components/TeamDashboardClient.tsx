'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Agent, Team } from '@/types/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { Badge } from '@/components/ui/badge';
import TeamFormDialog from './TeamFormDialog';
import TeamDetailsView from './TeamDetailsView';
import { getTeams } from '@/app/actions/teams';

// AIDEV-NOTE: Teams dashboard refactored to use consistent design system patterns

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
  const [error, setError] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const refreshTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedTeams = await getTeams();
      setTeams(fetchedTeams);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams');
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
                placeholder="Search teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => {
                setEditingTeam(null);
                setIsFormOpen(true);
              }}
              variant="success"
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
                onClick: () => {
                  setEditingTeam(null);
                  setIsFormOpen(true);
                }
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
                onClick={() => setSelectedTeam(team)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={16} className="text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">{team.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {team.purpose || 'No purpose defined'}
                  </p>
                  {team.agentIds && team.agentIds.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {team.agentIds.length} agent{team.agentIds.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))
          )}
            </div>
          </div>
        )}
      </div>

      {/* Right Pane: Team Details */}
      <div className="flex-1 p-0">
        <Card className="h-full rounded-none border-none">
          <CardContent className="p-6 h-full">
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
              <EmptyState
                title="Select a team"
                description="Choose a team from the list to view details and manage members"
                className="text-left justify-start"
              />
            )}
          </CardContent>
        </Card>
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