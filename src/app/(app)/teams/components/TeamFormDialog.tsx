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
  error?: string;
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



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl flex flex-col h-[90vh]">
        <DialogHeader>
          <DialogTitle>{team ? 'Edit Team' : 'Create Team'}</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1">
          <form 
            className="space-y-4 p-4" 
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <div className="space-y-4">
              {/* Name Field */}
              <form.Field
                name="name"
              >
                {(fieldApi) => (
                  <FormField 
                    label="Name"
                    required
                    description="The name of the team"
                    error={fieldApi.state.meta.errors?.[0]}
                  >
                    <Input
                      value={fieldApi.state.value || ''}
                      onChange={(e) => fieldApi.handleChange(e.target.value)}
                      placeholder="e.g., Marketing Team"
                    />
                  </FormField>
                )}
              </form.Field>

              {/* Purpose Field */}
              <form.Field
                name="purpose"
              >
                {(fieldApi) => (
                  <FormField 
                    label="Purpose"
                    description="The purpose and mission of the team"
                    error={fieldApi.state.meta.errors?.[0]}
                  >
                    <Textarea
                      value={fieldApi.state.value || ''}
                      onChange={(e) => fieldApi.handleChange(e.target.value)}
                      placeholder="Describe the team's purpose and mission"
                      rows={3}
                    />
                  </FormField>
                )}
              </form.Field>

              {/* Description Field */}
              <form.Field
                name="description"
              >
                {(fieldApi) => (
                  <FormField 
                    label="Description"
                    description="Team description"
                    error={fieldApi.state.meta.errors?.[0]}
                  >
                    <Textarea
                      value={fieldApi.state.value || ''}
                      onChange={(e) => fieldApi.handleChange(e.target.value)}
                      placeholder="Describe the team's purpose"
                      rows={3}
                    />
                  </FormField>
                )}
              </form.Field>

              {/* Responsibilities Field */}
              <form.Field
                name="responsibilities"
              >
                {(fieldApi) => (
                  <FormField 
                    label="Responsibilities"
                    description="Team responsibilities (comma-separated)"
                    error={fieldApi.state.meta.errors?.[0]}
                  >
                    <Textarea
                      value={fieldApi.state.value || ''}
                      onChange={(e) => fieldApi.handleChange(e.target.value)}
                      placeholder="e.g., Customer support, Technical support, Product feedback"
                      rows={3}
                    />
                  </FormField>
                )}
              </form.Field>

              {/* Goals Field */}
              <form.Field
                name="goals"
              >
                {(fieldApi) => (
                  <FormField 
                    label="Goals"
                    description="Team goals (comma-separated)"
                    error={fieldApi.state.meta.errors?.[0]}
                  >
                    <Textarea
                      value={fieldApi.state.value || ''}
                      onChange={(e) => fieldApi.handleChange(e.target.value)}
                      placeholder="e.g., Improve customer satisfaction, Reduce response time"
                      rows={3}
                    />
                  </FormField>
                )}
              </form.Field>

              {/* Agents Selection */}
              <form.Field
                name="agentIds"
              >
                {(fieldApi) => (
                  <FormField 
                    label="Team Members"
                    description="Select agents to be part of this team"
                    error={fieldApi.state.meta.errors?.[0]}
                  >
                    <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                      {agents.map((agent) => {
                        const agentIdStr = agent.id.toString();
                        return (
                          <div key={agent.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={agentIdStr}
                              checked={fieldApi.state.value?.includes(agentIdStr) || false}
                              onCheckedChange={(checked) => {
                                const currentIds = fieldApi.state.value || [];
                                if (checked) {
                                  fieldApi.handleChange([...currentIds, agentIdStr]);
                                } else {
                                  fieldApi.handleChange(currentIds.filter(id => id !== agentIdStr));
                                }
                              }}
                            />
                            <label htmlFor={agentIdStr} className="text-sm cursor-pointer">
                              {agent.name}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </FormField>
                )}
              </form.Field>
            </div>
          </form>
        </ScrollArea>
        
        <div className="flex justify-end space-x-2 pt-4 border-t mt-4">
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
            onClick={() => form.handleSubmit()}
            disabled={form.state.isSubmitting}
          >
            {form.state.isSubmitting ? 'Saving...' : (team ? 'Update Team' : 'Create Team')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}