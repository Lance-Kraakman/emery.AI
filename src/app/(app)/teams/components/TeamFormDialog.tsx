'use client';

import React from 'react';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { TeamDTO } from '@/app/mappers/team-mapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createTeamAction, updateTeam } from '@/app/actions/teams';

// AIDEV-NOTE: Restored team form dialog with updated DTOs and modern patterns

interface TeamFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  team?: TeamDTO | null;
  agents: AgentDTO[];
  onUpdate: () => void;
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
}

function FormField({ label, required, description, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

export default function TeamFormDialog({ isOpen, onClose, team, agents, onUpdate }: TeamFormDialogProps) {
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: team?.name || '',
      purpose: team?.purpose || '',
      description: team?.description || '',
      responsibilities: team?.responsibilities?.join(', ') || '',
      goals: team?.goals?.join(', ') || '',
      agentIds: team?.agentIds || [],
    },
    onSubmit: async ({ value }) => {
      try {
        setError(null);
        
        let result;
        if (team) {
          // Update existing team
          const data = {
            name: value.name,
            purpose: value.purpose,
            description: value.description,
            responsibilities: value.responsibilities?.split(',').map(r => r.trim()).filter(r => r) || [],
            goals: value.goals?.split(',').map(g => g.trim()).filter(g => g) || [],
            agentIds: value.agentIds,
          };
          
          result = await updateTeam(team.id, data);
        } else {
          // Create new team - convert to FormData for server action
          const formData = new FormData();
          formData.append('name', value.name);
          formData.append('purpose', value.purpose);
          formData.append('description', value.description);
          formData.append('responsibilities', value.responsibilities);
          formData.append('goals', value.goals);
          formData.append('agentIds', value.agentIds.join(','));
          
          result = await createTeamAction(formData);
        }
        
        if (!result.success) {
          setError(result.error || 'Failed to save team');
          return;
        }
        
        onUpdate();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save team');
      }
    },
  });

  const toggleAgentSelection = (agentId: string, currentValue: string[]) => {
    return currentValue.includes(agentId) 
      ? currentValue.filter(id => id !== agentId)
      : [...currentValue, agentId];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{team ? 'Edit Team' : 'Create New Team'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }} className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
          
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => !value || value.trim() === '' ? 'Name is required' : undefined,
            }}
          >
            {(field) => (
              <FormField label="Name" required>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g., Sales Team"
                  disabled={form.state.isSubmitting}
                />
                {field.state.meta.errors.length > 0 && (
                  <div className="text-sm text-destructive">
                    {field.state.meta.errors[0]}
                  </div>
                )}
              </FormField>
            )}
          </form.Field>
          
          <form.Field name="purpose">
            {(field) => (
              <FormField label="Purpose">
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g., Drive revenue growth"
                  disabled={form.state.isSubmitting}
                />
              </FormField>
            )}
          </form.Field>
          
          <form.Field name="description">
            {(field) => (
              <FormField label="Description">
                <Textarea
                  rows={3}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Provide a detailed description of the team..."
                  disabled={form.state.isSubmitting}
                />
              </FormField>
            )}
          </form.Field>
          
          <form.Field name="responsibilities">
            {(field) => (
              <FormField 
                label="Responsibilities"
                description="Separate multiple responsibilities with commas"
              >
                <Textarea
                  rows={2}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g., Lead generation, Customer outreach, Sales reporting"
                  disabled={form.state.isSubmitting}
                />
              </FormField>
            )}
          </form.Field>
          
          <form.Field name="goals">
            {(field) => (
              <FormField 
                label="Goals"
                description="Separate multiple goals with commas"
              >
                <Textarea
                  rows={2}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g., Increase revenue by 20%, Improve customer satisfaction"
                  disabled={form.state.isSubmitting}
                />
              </FormField>
            )}
          </form.Field>
          
          <form.Field name="agentIds">
            {(field) => (
              <FormField 
                label="Team Agents"
                description={`Selected: ${field.state.value.length} agent${field.state.value.length !== 1 ? 's' : ''}`}
              >
                <ScrollArea className="h-40 border rounded-md p-3">
                  {agents.length > 0 ? (
                    <div className="space-y-3">
                      {agents.map((agent) => (
                        <div key={agent.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`agent-${agent.id}`}
                            checked={field.state.value.includes(agent.id.toString())}
                            onCheckedChange={() => field.handleChange(
                              toggleAgentSelection(agent.id.toString(), field.state.value)
                            )}
                            disabled={form.state.isSubmitting}
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
            )}
          </form.Field>

          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={form.state.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.state.isSubmitting}
            >
              {form.state.isSubmitting ? 'Saving...' : (team ? 'Update Team' : 'Create Team')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}