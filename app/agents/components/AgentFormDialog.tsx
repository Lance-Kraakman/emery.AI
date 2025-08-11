'use client';

import { useState } from 'react';
import { Agent } from '@/types/db';
import { createAgentAction } from '@/app/actions/agents';

interface AgentFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  agent?: Agent | null;
}

export default function AgentFormDialog({ isOpen, onClose, agent }: AgentFormDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-popover p-6 rounded-lg shadow-lg w-full max-w-md border">
        <h2 className="text-2xl font-bold mb-4 text-foreground">{agent ? 'Edit Agent' : 'Create New Agent'}</h2>
        <form action={createAgentAction}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-muted-foreground">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                defaultValue={agent?.name}
                className="mt-1 block w-full p-2 border rounded"
                placeholder="e.g., Sales Analyst Bot"
              />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-muted-foreground">Role</label>
              <input
                id="role"
                name="role"
                type="text"
                defaultValue={agent?.role ?? ''}
                className="mt-1 block w-full p-2 border rounded"
                placeholder="e.g., Data Analyst"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-muted-foreground">Description</label>
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={agent?.description ?? ''}
                className="mt-1 block w-full p-2 border rounded"
                placeholder="A brief description of the agent's purpose."
              />
            </div>
            <div>
              <label htmlFor="persona" className="block text-sm font-medium text-muted-foreground">Persona</label>
              <textarea
                id="persona"
                name="persona"
                rows={3}
                defaultValue={agent?.persona ?? ''}
                className="mt-1 block w-full p-2 border rounded"
                placeholder="Describe the agent's personality and communication style."
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-primary text-primary-foreground px-4 py-2 rounded"
            >
              {agent ? 'Save Changes' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
