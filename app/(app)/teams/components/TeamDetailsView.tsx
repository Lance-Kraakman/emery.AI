'use client';

import { useState } from 'react';
import { Edit, Users, Target, CheckCircle, ChevronDown, ChevronRight, UserCheck, Activity, Save, X, Loader2 } from 'lucide-react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { TeamDTO } from '@/app/mappers/team-mapper';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { updateTeam } from '@/app/actions/teams';
import TeamMembersPanel from './TeamMembersPanel';
import TeamActivityPanel from './TeamActivityPanel';

// AIDEV-NOTE: Team details view with inline editing functionality

interface TeamDetailsViewProps {
  team: TeamDTO;
  agents: AgentDTO[];
  onEdit: () => void;
  onUpdate?: () => void;
}

interface EditFormData {
  name: string;
  purpose: string;
  description: string;
  responsibilities: string;
  goals: string;
  agentIds: string[];
}

export default function TeamDetailsView({ team, agents, onEdit, onUpdate }: TeamDetailsViewProps) {
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    name: team.name || '',
    purpose: team.purpose || '',
    description: team.description || '',
    responsibilities: team.responsibilities?.join(', ') || '',
    goals: team.goals?.join(', ') || '',
    agentIds: team.agentIds || []
  });

  // Get agents that belong to this team (based on current data or edit data)
  const currentAgentIds = isEditMode ? editFormData.agentIds : (team.agentIds || []);
  const teamAgents = agents.filter(agent => 
    currentAgentIds.some(agentId => agentId === agent.id.toString())
  );

  const handleEdit = () => {
    setIsEditMode(true);
    setEditFormData({
      name: team.name || '',
      purpose: team.purpose || '',
      description: team.description || '',
      responsibilities: team.responsibilities?.join(', ') || '',
      goals: team.goals?.join(', ') || '',
      agentIds: team.agentIds || []
    });
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditFormData({
      name: team.name || '',
      purpose: team.purpose || '',
      description: team.description || '',
      responsibilities: team.responsibilities?.join(', ') || '',
      goals: team.goals?.join(', ') || '',
      agentIds: team.agentIds || []
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const result = await updateTeam(team.id, {
        name: editFormData.name.trim(),
        purpose: editFormData.purpose.trim(),
        description: editFormData.description.trim(),
        responsibilities: editFormData.responsibilities
          .split(',')
          .map(r => r.trim())
          .filter(r => r.length > 0),
        goals: editFormData.goals
          .split(',')
          .map(g => g.trim())
          .filter(g => g.length > 0),
        agentIds: editFormData.agentIds
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update team');
      }
      
      setIsEditMode(false);
      onUpdate?.();
      
    } catch (error) {
      console.error('Error updating team:', error);
      // Simple alert for now - could be replaced with a toast system later
      alert(error instanceof Error ? error.message : 'An error occurred while updating the team');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof EditFormData, value: string) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAgentToggle = (agentId: string, checked: boolean) => {
    setEditFormData(prev => ({
      ...prev,
      agentIds: checked 
        ? [...prev.agentIds, agentId]
        : prev.agentIds.filter(id => id !== agentId)
    }));
  };

  return (
    <div className="space-y-4 max-h-full overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-start sticky top-0 bg-background z-10 pb-4">
        <div className="space-y-1 flex-1 mr-4">
          {isEditMode ? (
            <>
              <Input
                value={editFormData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="text-2xl font-bold h-auto p-1 border-none shadow-none bg-transparent"
                placeholder="Team name"
              />
              <Input
                value={editFormData.purpose}
                onChange={(e) => handleInputChange('purpose', e.target.value)}
                className="text-muted-foreground h-auto p-1 border-none shadow-none bg-transparent"
                placeholder="Team purpose"
              />
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold">{team.name}</h2>
              {team.purpose && (
                <p className="text-muted-foreground">{team.purpose}</p>
              )}
            </>
          )}
          <div className="flex gap-2 mt-2">
            <Badge variant="outline">
              <Users size={12} className="mr-1" />
              {teamAgents.length} agent{teamAgents.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditMode ? (
            <>
              <Button
                onClick={handleCancel}
                variant="outline"
                size="sm"
                disabled={isSaving}
              >
                <X size={16} />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                size="sm"
                disabled={isSaving || !editFormData.name.trim()}
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save
              </Button>
            </>
          ) : (
            <Button
              onClick={handleEdit}
              variant="outline"
              size="sm"
            >
              <Edit size={16} />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Overview Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={isEditMode ? 'ring-2 ring-primary/20' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditMode ? (
              <Textarea
                value={editFormData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="text-sm"
                placeholder="Team description"
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {team.description || 'No description provided'}
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card className={isEditMode ? 'ring-2 ring-primary/20' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle size={18} />
              Responsibilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditMode ? (
              <Textarea
                value={editFormData.responsibilities}
                onChange={(e) => handleInputChange('responsibilities', e.target.value)}
                className="text-sm"
                placeholder="Enter responsibilities separated by commas"
                rows={3}
              />
            ) : team.responsibilities && team.responsibilities.length > 0 ? (
              <ul className="space-y-1">
                {team.responsibilities.slice(0, 3).map((responsibility, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle size={12} className="text-muted-foreground mt-1 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">{responsibility}</span>
                  </li>
                ))}
                {team.responsibilities.length > 3 && (
                  <li className="text-xs text-muted-foreground">
                    +{team.responsibilities.length - 3} more responsibilities
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No responsibilities defined</p>
            )}
          </CardContent>
        </Card>
        
        <Card className={`md:col-span-2 ${isEditMode ? 'ring-2 ring-primary/20' : ''}`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target size={18} />
              Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditMode ? (
              <Textarea
                value={editFormData.goals}
                onChange={(e) => handleInputChange('goals', e.target.value)}
                className="text-sm"
                placeholder="Enter goals separated by commas"
                rows={3}
              />
            ) : team.goals && team.goals.length > 0 ? (
              <ul className="space-y-1">
                {team.goals.slice(0, 2).map((goal, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Target size={12} className="text-muted-foreground mt-1 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">{goal}</span>
                  </li>
                ))}
                {team.goals.length > 2 && (
                  <li className="text-xs text-muted-foreground">
                    +{team.goals.length - 2} more goals
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No goals defined</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Agents Section */}
      <Card className={isEditMode ? 'ring-2 ring-primary/20' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users size={18} />
            Team Agents ({teamAgents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEditMode ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Select agents for this team:</p>
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center space-x-2 p-2 border rounded">
                    <Checkbox
                      id={`agent-${agent.id}`}
                      checked={editFormData.agentIds.includes(agent.id.toString())}
                      onCheckedChange={(checked) => 
                        handleAgentToggle(agent.id.toString(), checked as boolean)
                      }
                    />
                    <label 
                      htmlFor={`agent-${agent.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.role || 'No role specified'}</p>
                        </div>
                        {agent.status && (
                          <Badge 
                            variant={agent.status === 'active' ? 'success' : 'secondary'}
                            className="text-xs h-5"
                          >
                            {agent.status}
                          </Badge>
                        )}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ) : teamAgents.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {teamAgents.map((agent) => (
                <Card key={agent.id} className="border-muted">
                  <CardContent className="p-3">
                    <h4 className="font-medium text-sm text-foreground">{agent.name}</h4>
                    <p className="text-xs text-muted-foreground">{agent.role || 'No role specified'}</p>
                    {agent.status && (
                      <Badge 
                        variant={agent.status === 'active' ? 'success' : 'secondary'}
                        className="mt-1 text-xs h-5"
                      >
                        {agent.status}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No agents assigned to this team.</p>
          )}
        </CardContent>
      </Card>

      {/* Members Section - Collapsible */}
      <Collapsible open={isMembersOpen} onOpenChange={setIsMembersOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <UserCheck size={18} />
                  Team Members
                </div>
                {isMembersOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <TeamMembersPanel team={team} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Recent Activity Section - Collapsible */}
      <Collapsible open={isActivityOpen} onOpenChange={setIsActivityOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <Activity size={18} />
                  Recent Activity
                </div>
                {isActivityOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <TeamActivityPanel team={team} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}