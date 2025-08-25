'use client';

import { useState } from 'react';
import type { Agent } from '@/ddd/domain/agents/entities/agent';
import type { Team } from '@/ddd/domain/teams/entities/team';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createTeamAction, updateTeam } from '@/app/actions/teams';
import { useEmery } from '@/contexts/EmeryContext';

// AIDEV-NOTE: Team form dialog refactored to use consistent design system components and patterns

interface TeamFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  team?: Team | null;
  agents: Agent[];
}

export default function TeamFormDialog({ isOpen, onClose, team, agents }: TeamFormDialogProps) {
  const { currentOrganization, refetch } = useEmery();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(
    team?.agentIds?.map(id => typeof id === 'string' ? id : id.value?.toString()) || []
  );

  const handleSubmit = async (formData: FormData) => {
    if (!currentOrganization) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Add organization ID and agent IDs to form data
      formData.append('organizationId', currentOrganization.id.toString());
      formData.append('agentIds', selectedAgentIds.join(','));

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
        
        await updateTeam(team.id.value, data);
      } else {
        // Create new team
        await createTeamAction(formData);
      }
      
      refetch();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team');
    } finally {
      setLoading(false);
    }
  };

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgentIds(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{team ? 'Edit Team' : 'Create New Team'}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
          
          <FormField label="Name" required>
            <Input
              name="name"
              required
              defaultValue={team?.name}
              placeholder="e.g., Sales Team"
              disabled={loading}
            />
          </FormField>
          
          <FormField label="Purpose">
            <Input
              name="purpose"
              defaultValue={team?.purpose ?? ''}
              placeholder="e.g., Drive revenue growth"
              disabled={loading}
            />
          </FormField>
          
          <FormField label="Description">
            <Textarea
              name="description"
              rows={3}
              defaultValue={team?.description ?? ''}
              placeholder="Provide a detailed description of the team..."
              disabled={loading}
            />
          </FormField>
          
          <FormField 
            label="Responsibilities"
            description="Separate multiple responsibilities with commas"
          >
            <Textarea
              name="responsibilities"
              rows={2}
              defaultValue={team?.responsibilities?.join(', ') ?? ''}
              placeholder="e.g., Lead generation, Customer outreach, Sales reporting"
              disabled={loading}
            />
          </FormField>
          
          <FormField 
            label="Goals"
            description="Separate multiple goals with commas"
          >
            <Textarea
              name="goals"
              rows={2}
              defaultValue={team?.goals?.join(', ') ?? ''}
              placeholder="e.g., Increase revenue by 20%, Improve customer satisfaction"
              disabled={loading}
            />
          </FormField>
          
          <FormField 
            label="Team Agents"
            description={`Selected: ${selectedAgentIds.length} agent${selectedAgentIds.length !== 1 ? 's' : ''}`}
          >
            <ScrollArea className="h-40 border rounded-md p-3">
              {agents.length > 0 ? (
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <div key={agent.id.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`agent-${agent.id.value}`}
                        checked={selectedAgentIds.includes(agent.id.value.toString())}
                        onCheckedChange={() => toggleAgentSelection(agent.id.value.toString())}
                        disabled={loading}
                      />
                      <label
                        htmlFor={`agent-${agent.id.value}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        <span className="font-medium">{agent.name}</span>
                        {agent.role && (
                          <span className="text-muted-foreground"> - {agent.role}</span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No agents available</p>
              )}
            </ScrollArea>
          </FormField>

          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={loading}
            >
              {loading ? 'Saving...' : (team ? 'Update Team' : 'Review')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
