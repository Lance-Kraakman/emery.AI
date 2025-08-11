'use client';

import { Agent } from '@/types/db';
import { addCapabilityToAgent } from '@/app/actions/agents';

interface CapabilityFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  agent: Agent;
}

export default function CapabilityFormDialog({ isOpen, onClose, agent }: CapabilityFormDialogProps) {
  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const tools = (formData.get('tools') as string).split(',').map(t => t.trim());
    const servers = JSON.parse(formData.get('servers') as string);
    await addCapabilityToAgent(agent.id, { name, description, tools, servers });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-popover p-6 rounded-lg shadow-lg w-full max-w-md border">
        <h2 className="text-2xl font-bold mb-4 text-foreground">Add Capability</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-muted-foreground">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="mt-1 block w-full p-2 border rounded"
                placeholder="e.g., Analyze Sales Data"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-muted-foreground">Description</label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="mt-1 block w-full p-2 border rounded"
                placeholder="A brief description of the capability."
              />
            </div>
            <div>
              <label htmlFor="tools" className="block text-sm font-medium text-muted-foreground">Tools</label>
              <input
                id="tools"
                name="tools"
                type="text"
                className="mt-1 block w-full p-2 border rounded"
                placeholder="e.g., slack,gmail"
              />
            </div>
            <div>
              <label htmlFor="servers" className="block text-sm font-medium text-muted-foreground">Servers</label>
              <textarea
                id="servers"
                name="servers"
                rows={3}
                className="mt-1 block w-full p-2 border rounded"
                placeholder='e.g., [{ "name": "My API", "url": "https://api.example.com", "auth": { "type": "bearer", "token": "abc123" } }]'
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
              Add Capability
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
