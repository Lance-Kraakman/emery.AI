'use client';

import { useState, useEffect, useMemo } from 'react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { TeamDTO } from '@/app/mappers/team-mapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { createTeamAction, updateTeam } from '@/app/actions/teams';
import { useEmery } from '@/contexts/EmeryContext';
import { useFormWithUnsavedChanges } from '@/hooks/useFormWithUnsavedChanges';
import { teamSchema } from '@/lib/schemas';
import { AlertTriangle, Users } from 'lucide-react';

// AIDEV-NOTE: Enhanced team form dialog with Zod validation and unsaved changes detection
// AIDEV-NOTE: Uses consistent form patterns and provides better user experience for team management

interface TeamFormDialogImprovedProps {
  isOpen: boolean;
  onClose: () => void;
  team?: TeamDTO | null;
  agents: AgentDTO[];
}

export default function TeamFormDialogImproved({ isOpen, onClose, team, agents }: TeamFormDialogImprovedProps) {
  const { currentOrganization, refetch } = useEmery();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(
    team?.agentIds || []
  );

  // Prepare default values - memoized to prevent infinite loops
  const defaultValues = useMemo(() => team ? {
    name: team.name || '',
    purpose: team.purpose || '',
    description: team.description || '',
    responsibilities: team.responsibilities || [],
    goals: team.goals || [],
    agentIds: team.agentIds || [],
  } : {
    name: '',
    purpose: '',
    description: '',
    responsibilities: [],
    goals: [],
    agentIds: [],
  }, [team]);

  const form = useFormWithUnsavedChanges({
    schema: teamSchema,
    defaultValues,
    onSubmit: async (validatedData) => {
      setGlobalError(null);
      
      if (!currentOrganization) {
        throw new Error("No organization selected");
      }

      try {
        if (team) {
          // Update existing team
          const result = await updateTeam(team.id, {
            ...validatedData,
            agentIds: selectedAgentIds,
            organizationId: currentOrganization.id,
          });
          
          if (!result.success) {
            throw new Error(result.error);
          }
        } else {
          // Create new team using FormData (to match existing server action)
          const formData = new FormData();
          formData.append('name', validatedData.name);
          formData.append('purpose', validatedData.purpose || '');
          formData.append('description', validatedData.description || '');
          formData.append('responsibilities', (validatedData.responsibilities || []).join(', '));
          formData.append('goals', (validatedData.goals || []).join(', '));
          formData.append('agentIds', selectedAgentIds.join(','));
          formData.append('organizationId', currentOrganization.id.toString());
          
          const result = await createTeamAction(formData);
          
          if (!result.success) {
            throw new Error(result.error);
          }
        }
        
        refetch();
        onClose();
      } catch (error) {
        console.error('Form submission error:', error);
        setGlobalError(error instanceof Error ? error.message : 'Failed to save team');
        throw error; // Re-throw to prevent form from closing
      }
    },
    onClose,
  });

  // Reset form when dialog opens/closes or team changes
  useEffect(() => {
    if (isOpen) {
      form.reset();
      setSelectedAgentIds(team?.agentIds || []);
      setGlobalError(null);
    }
  }, [isOpen, team, form.reset]);

  // Update form values when selectedAgentIds changes
  useEffect(() => {
    form.setValue('agentIds', selectedAgentIds);
  }, [selectedAgentIds, form.setValue]);

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgentIds(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  const parseCommaSeparatedString = (value: string): string[] => {
    return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
  };

  const handleResponsibilitiesChange = (value: string) => {
    form.setValue('responsibilities', parseCommaSeparatedString(value));
  };

  const handleGoalsChange = (value: string) => {
    form.setValue('goals', parseCommaSeparatedString(value));
  };

  return (
    <Dialog open={isOpen} onOpenChange={form.handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {team ? 'Edit Team' : 'Create New Team'}
            {form.hasUnsavedChanges && (
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            )}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit} className="space-y-4">
          {globalError && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {globalError}
            </div>
          )}
          
          <FormField 
            label="Name" 
            required 
            error={form.errors.name}
          >
            <Input
              value={form.values.name || ''}
              onChange={(e) => form.setValue('name', e.target.value)}
              onBlur={() => form.validateField('name')}
              placeholder="e.g., Sales Team"
              disabled={form.isLoading}
              className={form.errors.name ? 'border-destructive' : ''}
            />
          </FormField>
          
          <FormField 
            label="Purpose" 
            error={form.errors.purpose}
          >
            <Input
              value={form.values.purpose || ''}
              onChange={(e) => form.setValue('purpose', e.target.value)}
              onBlur={() => form.validateField('purpose')}
              placeholder="e.g., Drive revenue growth"
              disabled={form.isLoading}
              className={form.errors.purpose ? 'border-destructive' : ''}
            />
          </FormField>
          
          <FormField 
            label="Description" 
            error={form.errors.description}
          >
            <Textarea
              value={form.values.description || ''}
              onChange={(e) => form.setValue('description', e.target.value)}
              onBlur={() => form.validateField('description')}
              rows={3}
              placeholder="Provide a detailed description of the team..."
              disabled={form.isLoading}
              className={form.errors.description ? 'border-destructive' : ''}
            />
          </FormField>
          
          <FormField 
            label="Responsibilities"
            description="Separate multiple responsibilities with commas"
            error={form.errors.responsibilities}
          >
            <Textarea
              value={(form.values.responsibilities || []).join(', ')}
              onChange={(e) => handleResponsibilitiesChange(e.target.value)}
              onBlur={() => form.validateField('responsibilities')}
              rows={2}
              placeholder="e.g., Lead generation, Customer outreach, Sales reporting"
              disabled={form.isLoading}
              className={form.errors.responsibilities ? 'border-destructive' : ''}
            />
            {form.values.responsibilities && form.values.responsibilities.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.values.responsibilities.slice(0, 3).map((resp, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {resp.length > 20 ? `${resp.substring(0, 20)}...` : resp}
                  </Badge>
                ))}
                {form.values.responsibilities.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{form.values.responsibilities.length - 3} more
                  </Badge>
                )}
              </div>
            )}
          </FormField>
          
          <FormField 
            label="Goals"
            description="Separate multiple goals with commas"
            error={form.errors.goals}
          >
            <Textarea
              value={(form.values.goals || []).join(', ')}
              onChange={(e) => handleGoalsChange(e.target.value)}
              onBlur={() => form.validateField('goals')}
              rows={2}
              placeholder="e.g., Increase revenue by 20%, Improve customer satisfaction"
              disabled={form.isLoading}
              className={form.errors.goals ? 'border-destructive' : ''}
            />
            {form.values.goals && form.values.goals.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.values.goals.slice(0, 3).map((goal, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {goal.length > 20 ? `${goal.substring(0, 20)}...` : goal}
                  </Badge>
                ))}
                {form.values.goals.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{form.values.goals.length - 3} more
                  </Badge>
                )}
              </div>
            )}
          </FormField>
          
          <FormField 
            label="Team Agents"
            description={`Selected: ${selectedAgentIds.length} agent${selectedAgentIds.length !== 1 ? 's' : ''}`}
            error={form.errors.agentIds}
          >
            <ScrollArea className="h-40 border rounded-md p-3">
              {agents.length > 0 ? (
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <div key={agent.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`agent-${agent.id}`}
                        checked={selectedAgentIds.includes(agent.id.toString())}
                        onCheckedChange={() => toggleAgentSelection(agent.id.toString())}
                        disabled={form.isLoading}
                      />
                      <label
                        htmlFor={`agent-${agent.id}`}
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
              onClick={form.handleClose}
              disabled={form.isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={form.isLoading || Object.keys(form.errors).length > 0}
            >
              {form.isLoading ? 'Saving...' : (team ? 'Save Changes' : 'Create Team')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// AIDEV-NOTE: This component provides:
// 1. Zod validation with real-time error feedback
// 2. Unsaved changes detection and warnings  
// 3. Agent selection with visual feedback
// 4. Array field handling for responsibilities and goals
// 5. Better error handling and user feedback
// 6. Visual indicators for form state and selected items