'use client';

import { useState, useEffect } from 'react';
import { Agent, Team } from '@/types/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { createTeamAction, updateTeam } from '@/app/actions/teams';
import { useEmeryData } from '@/hooks/useEmeryData';
import { AlertCircle } from 'lucide-react';

// AIDEV-NOTE: Team configuration panel that fills the right pane like AgentConfigurationWizard

interface TeamConfigurationPanelProps {
  onClose: () => void;
  team?: Team | null;
  agents: Agent[];
  onSuccess?: () => void;
}

export default function TeamConfigurationPanel({ 
  onClose, 
  team, 
  agents, 
  onSuccess 
}: TeamConfigurationPanelProps) {
  const { currentOrganization } = useEmeryData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(team?.agentIds || []);
  const [formData, setFormData] = useState({
    name: team?.name || '',
    purpose: team?.purpose || '',
    description: team?.description || '',
    responsibilities: team?.responsibilities?.join(', ') || '',
    goals: team?.goals?.join(', ') || '',
  });

  // Update form data when team changes
  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || '',
        purpose: team.purpose || '',
        description: team.description || '',
        responsibilities: team.responsibilities?.join(', ') || '',
        goals: team.goals?.join(', ') || '',
      });
      setSelectedAgentIds(team.agentIds || []);
    } else {
      // Reset form for new team
      setFormData({
        name: '',
        purpose: '',
        description: '',
        responsibilities: '',
        goals: '',
      });
      setSelectedAgentIds([]);
    }
  }, [team]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;
    
    try {
      setLoading(true);
      setError(null);

      let result;
      if (team) {
        // Update existing team
        const data = {
          name: formData.name,
          purpose: formData.purpose,
          description: formData.description,
          responsibilities: formData.responsibilities?.split(',').map(r => r.trim()).filter(r => r),
          goals: formData.goals?.split(',').map(g => g.trim()).filter(g => g),
          agentIds: selectedAgentIds,
        };
        result = await updateTeam(team.id, data);
      } else {
        // Create new team
        const teamData = new FormData();
        teamData.append('name', formData.name);
        teamData.append('purpose', formData.purpose);
        teamData.append('description', formData.description);
        teamData.append('responsibilities', formData.responsibilities);
        teamData.append('goals', formData.goals);
        teamData.append('organizationId', currentOrganization.id.toString());
        teamData.append('agentIds', selectedAgentIds.join(','));
        result = await createTeamAction(teamData);
      }

      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.error || 'Failed to save team');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team');
    } finally {
      setLoading(false);
    }
  };

  const handleAgentToggle = (agentId: string) => {
    setSelectedAgentIds(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-border/20 p-4 flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">
          {team ? 'Edit Team' : 'Create New Team'}
        </h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            form="team-form"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Saving...' : (team ? 'Save Changes' : 'Create Team')}
          </Button>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-6">
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <div className="ml-3">
                <div className="text-sm text-destructive">{error}</div>
              </div>
            </div>
          </div>
        )}

        <form
          id="team-form"
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <FormField label="Team Name" required>
            <Input
              placeholder="e.g., Marketing Team"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </FormField>

          <FormField label="Purpose">
            <Input
              placeholder="e.g., Drive marketing initiatives and campaigns"
              value={formData.purpose}
              onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              placeholder="Describe the team's role and objectives..."
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </FormField>

          <FormField 
            label="Responsibilities" 
            description="Comma-separated list"
          >
            <Textarea
              placeholder="e.g., Content creation, Campaign management, Brand awareness"
              rows={2}
              value={formData.responsibilities}
              onChange={(e) => setFormData(prev => ({ ...prev, responsibilities: e.target.value }))}
            />
          </FormField>

          <FormField 
            label="Goals"
            description="Comma-separated list"
          >
            <Textarea
              placeholder="e.g., Increase brand awareness, Generate qualified leads"
              rows={2}
              value={formData.goals}
              onChange={(e) => setFormData(prev => ({ ...prev, goals: e.target.value }))}
            />
          </FormField>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Assign Agents</label>
              <p className="text-xs text-muted-foreground mb-3">
                Select agents to be part of this team
              </p>
            </div>
            
            {selectedAgentIds.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Selected agents:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedAgentIds.map(agentId => {
                    const agent = agents.find(a => a.id.toString() === agentId);
                    return (
                      <Badge key={agentId} variant="secondary">
                        {agent?.name || `Agent ${agentId}`}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            <ScrollArea className="h-48 border border-border/20 rounded-md p-3">
              <div className="space-y-2">
                {agents.length > 0 ? (
                  agents.map((agent) => (
                    <div key={agent.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={`agent-${agent.id}`}
                        checked={selectedAgentIds.includes(agent.id.toString())}
                        onCheckedChange={() => handleAgentToggle(agent.id.toString())}
                      />
                      <label
                        htmlFor={`agent-${agent.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium text-foreground">{agent.name}</div>
                        {agent.role && (
                          <div className="text-sm text-muted-foreground">{agent.role}</div>
                        )}
                      </label>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>No agents available.</p>
                    <p className="text-sm">Create agents first to assign them to teams.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </form>
      </div>
    </div>
  );
}