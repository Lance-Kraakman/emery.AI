'use client';

import { useState } from 'react';
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

  const handleSubmit = async (formData: FormData) => {
    if (!currentOrganization) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Add organization ID and agent IDs to form data
      formData.append('organizationId', currentOrganization.id.toString());
      formData.append('agentIds', selectedAgentIds.join(','));

      let result;
      if (team) {
        // Update existing team
        const data = {
          name: formData.get('name') as string,
          purpose: formData.get('purpose') as string,
          description: formData.get('description') as string,
          responsibilities: (formData.get('responsibilities') as string)?.split(',').map(r => r.trim()).filter(r => r),
          goals: (formData.get('goals') as string)?.split(',').map(g => g.trim()).filter(g => g),
          agentIds: selectedAgentIds,
        };
        result = await updateTeam(team.id, data);
      } else {
        // Create new team
        result = await createTeamAction(formData);
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
    <div className="flex flex-col h-full bg-background">
      <div className="flex-shrink-0 border-b p-4 flex justify-between items-center">
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
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(new FormData(e.currentTarget));
          }}
          className="space-y-6"
        >
          <FormField label="Team Name" required>
            <Input
              name="name"
              placeholder="e.g., Marketing Team"
              defaultValue={team?.name || ''}
              required
            />
          </FormField>

          <FormField label="Purpose">
            <Input
              name="purpose"
              placeholder="e.g., Drive marketing initiatives and campaigns"
              defaultValue={team?.purpose || ''}
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              name="description"
              placeholder="Describe the team's role and objectives..."
              rows={3}
              defaultValue={team?.description || ''}
            />
          </FormField>

          <FormField 
            label="Responsibilities" 
            description="Comma-separated list"
          >
            <Textarea
              name="responsibilities"
              placeholder="e.g., Content creation, Campaign management, Brand awareness"
              rows={2}
              defaultValue={team?.responsibilities?.join(', ') || ''}
            />
          </FormField>

          <FormField 
            label="Goals"
            description="Comma-separated list"
          >
            <Textarea
              name="goals"
              placeholder="e.g., Increase brand awareness, Generate qualified leads"
              rows={2}
              defaultValue={team?.goals?.join(', ') || ''}
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

            <ScrollArea className="h-48 border rounded-md p-3">
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