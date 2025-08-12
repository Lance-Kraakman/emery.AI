'use client';

import { useState } from 'react';
import { Agent } from '@/types/db';
import { createAgentAction } from '@/app/actions/agents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { useEmery } from '@/contexts/EmeryContext';

// AIDEV-NOTE: Agent form dialog refactored to use consistent design system components and patterns

interface AgentFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  agent?: Agent | null;
}

export default function AgentFormDialog({ isOpen, onClose, agent }: AgentFormDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refetch } = useEmery();

  const handleSubmit = async (formData: FormData) => {
    try {
      setIsPending(true);
      setError(null);
      await createAgentAction(formData);
      refetch();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agent');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{agent ? 'Edit Agent' : 'Create New Agent'}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-3">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
          
          <FormField label="Name" required>
            <Input
              name="name"
              required
              defaultValue={agent?.name}
              placeholder="e.g., Sales Analyst Bot"
              disabled={isPending}
            />
          </FormField>
          
          <FormField label="Role">
            <Input
              name="role"
              defaultValue={agent?.role ?? ''}
              placeholder="e.g., Data Analyst"
              disabled={isPending}
            />
          </FormField>
          
          <FormField label="Description">
            <Textarea
              name="description"
              rows={2}
              defaultValue={agent?.description ?? ''}
              placeholder="A brief description of the agent's purpose."
              disabled={isPending}
            />
          </FormField>
          
          <FormField label="Persona">
            <Textarea
              name="persona"
              rows={2}
              defaultValue={agent?.persona ?? ''}
              placeholder="Describe the agent's personality and communication style."
              disabled={isPending}
            />
          </FormField>
          
          <div className="flex justify-end space-x-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={isPending}
            >
              {isPending ? 'Saving...' : (agent ? 'Save Changes' : 'Create Agent')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
