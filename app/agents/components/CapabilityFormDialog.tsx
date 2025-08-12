'use client';

import { useState } from 'react';
import { Agent } from '@/types/db';
import { addCapabilityToAgent } from '@/app/actions/agents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';

interface CapabilityFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  agent: Agent;
}

export default function CapabilityFormDialog({ isOpen, onClose, agent }: CapabilityFormDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const tools = (formData.get('tools') as string).split(',').map(t => t.trim()).filter(t => t);
    const serversRaw = formData.get('servers') as string;
    
    let servers = [];
    try {
      if (serversRaw) {
        servers = JSON.parse(serversRaw);
      }
    } catch (e) {
      setError('Invalid JSON format for Servers.');
      setIsPending(false);
      return;
    }

    try {
      await addCapabilityToAgent(agent.id, { name, description, tools, servers });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add capability');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Capability</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
          
          <FormField label="Name" required>
            <Input
              name="name"
              required
              placeholder="e.g., Analyze Sales Data"
              disabled={isPending}
            />
          </FormField>
          
          <FormField label="Description">
            <Textarea
              name="description"
              rows={2}
              placeholder="A brief description of the capability."
              disabled={isPending}
            />
          </FormField>
          
          <FormField label="Tools" description="Comma-separated list of tool names.">
            <Input
              name="tools"
              placeholder="e.g., python_executor, gmail"
              disabled={isPending}
            />
          </FormField>
          
          <FormField label="Servers" description="JSON array of server configurations.">
            <Textarea
              name="servers"
              rows={3}
              placeholder='e.g., [{ "name": "My API", "url": "..." }]'
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
              {isPending ? 'Adding...' : 'Add Capability'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
