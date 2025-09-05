'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Agent } from '@/ddd/domain/agents/entities/agent';
import { createAgentAction, updateAgent } from '@/app/actions/agents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { useEmery } from '@/contexts/EmeryContext';
import { useFormWithUnsavedChanges } from '@/hooks/useFormWithUnsavedChanges';
import { agentSchema } from '@/lib/schemas';
import { AlertTriangle } from 'lucide-react';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import ScheduleManager from './ScheduleManager';

// AIDEV-NOTE: Enhanced agent form dialog with Zod validation and unsaved changes detection
// AIDEV-NOTE: Uses consistent form patterns and provides better user experience

interface AgentFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  agent?: Agent | null;
}

export default function AgentFormDialog({ isOpen, onClose, agent }: AgentFormDialogProps) {
  const { currentOrganization, refetch } = useEmery();
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Prepare default values - memoized to prevent infinite loops
  const defaultValues = useMemo(() => agent ? {
    name: agent.name || '',
    role: agent.role || '',
    description: agent.description || '',
    persona: agent.persona || '',
    model: (agent as any).model || '', // Handle potential model field
  } : {
    name: '',
    role: '',
    description: '',
    persona: '',
    model: '',
  }, [agent]);

  const form = useFormWithUnsavedChanges({
    schema: agentSchema,
    defaultValues,
    onSubmit: async (validatedData) => {
      setGlobalError(null);
      
      if (!currentOrganization) {
        throw new Error("No organization selected");
      }

      try {
        if (agent) {
          // Update existing agent - convert organizationId to Value Object
          const updateData = {
            ...validatedData,
            organizationId: currentOrganization.id ? OrganizationId.fromNumber(currentOrganization.id) : undefined
          };
          const result = await updateAgent(agent.id.value, updateData);
          
          if (!result.success) {
            throw new Error(result.error);
          }
        } else {
          // Create new agent using FormData (to match existing server action)
          const formData = new FormData();
          formData.append('name', validatedData.name);
          formData.append('role', validatedData.role || '');
          formData.append('description', validatedData.description || '');
          formData.append('persona', validatedData.persona || '');
          formData.append('organizationId', currentOrganization.id.toString());
          
          const result = await createAgentAction(formData);
          
          if (!result.success) {
            throw new Error(result.error);
          }
        }
        
        refetch();
        onClose();
      } catch (error) {
        console.error('Form submission error:', error);
        setGlobalError(error instanceof Error ? error.message : 'Failed to save agent');
        throw error; // Re-throw to prevent form from closing
      }
    },
    onClose,
  });

  // Reset form when dialog opens/closes or agent changes
  useEffect(() => {
    if (isOpen) {
      form.reset();
      setGlobalError(null);
    }
  }, [isOpen, agent, form.reset]);

  return (
    <Dialog open={isOpen} onOpenChange={form.handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {agent ? 'Edit Agent' : 'Create New Agent'}
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
              placeholder="e.g., Sales Analyst Bot"
              disabled={form.isLoading}
              className={form.errors.name ? 'border-destructive' : ''}
            />
          </FormField>
          
          <FormField 
            label="Role" 
            error={form.errors.role}
          >
            <Input
              value={form.values.role || ''}
              onChange={(e) => form.setValue('role', e.target.value)}
              onBlur={() => form.validateField('role')}
              placeholder="e.g., Data Analyst"
              disabled={form.isLoading}
              className={form.errors.role ? 'border-destructive' : ''}
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
              placeholder="A brief description of the agent's purpose."
              disabled={form.isLoading}
              className={form.errors.description ? 'border-destructive' : ''}
            />
          </FormField>
          
          <FormField 
            label="Persona" 
            error={form.errors.persona}
            description="Describe the agent's personality and communication style"
          >
            <Textarea
              value={form.values.persona || ''}
              onChange={(e) => form.setValue('persona', e.target.value)}
              onBlur={() => form.validateField('persona')}
              rows={3}
              placeholder="Professional, analytical, and detail-oriented..."
              disabled={form.isLoading}
              className={form.errors.persona ? 'border-destructive' : ''}
            />
          </FormField>

          {agent && (
            <FormField label="Schedule">
              <ScheduleManager 
                agentId={agent.id.value} 
                initialRRule={(agent.trigger as any)?.rrule}
                onScheduleChange={(rrule) => {
                  // AIDEV-NOTE: Update agent trigger with new schedule
                  console.log('Schedule changed:', rrule);
                }}
              />
            </FormField>
          )}
          
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
              {form.isLoading ? 'Saving...' : (agent ? 'Save Changes' : 'Create Agent')}
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
// 3. Better error handling and user feedback
// 4. Consistent form patterns across the application
// 5. Visual indicators for form state (unsaved changes icon)