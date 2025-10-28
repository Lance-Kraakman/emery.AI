'use client';

import React, { useState } from 'react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { createTask } from '@/app/actions/tasks';

interface TaskFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentDTO;
}

export default function TaskFormDialog({ isOpen, onClose, agent }: TaskFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const name = formData.get('name') as string;
      const skillName = formData.get('capability') as string;
      const instructions = formData.get('instructions') as string;

      const result = await createTask({
        agentId: agent.id,
        name,
        skillName: skillName || undefined, // Auto-route if empty
        instructions: {
          instructions,
          tools: undefined,
          metadata: {}
        }
      });

      if (result.success) {
        onClose();
      } else {
        setError(result.error || 'Failed to create task');
      }
    } catch (error) {
      setError('An unexpected error occurred');
      console.error('Task creation error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-background p-6 rounded-lg shadow-lg w-full max-w-md border" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4 text-foreground">Assign Task</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-muted-foreground">Task Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="mt-1 block w-full p-2 border rounded"
                placeholder="e.g., Generate weekly sales report"
              />
            </div>
            {/* AIDEV-NOTE: Skill selection removed - skills are now in separate table, system will auto-route */}
            <div>
              <label htmlFor="instructions" className="block text-sm font-medium text-muted-foreground">Instructions</label>
              <textarea
                id="instructions"
                name="instructions"
                rows={3}
                required
                className="mt-1 block w-full p-2 border rounded"
                placeholder="e.g., Read my emails for today and summarize any important messages"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tools can be referenced in instructions using @ mentions
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground px-4 py-2 rounded disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Assign Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
