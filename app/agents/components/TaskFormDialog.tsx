'use client';

import { Agent } from '@/types/db';
import { createTask } from '@/app/actions/tasks';

interface TaskFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  agent: Agent;
}

export default function TaskFormDialog({ isOpen, onClose, agent }: TaskFormDialogProps) {
  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get('name') as string;
    const capabilityName = formData.get('capability') as string;
    const payload = formData.get('payload') as string;
    await createTask({ agentId: agent.id, name, capabilityName, payload: JSON.parse(payload) });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-popover p-6 rounded-lg shadow-lg w-full max-w-md border">
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
            <div>
              <label htmlFor="capability" className="block text-sm font-medium text-muted-foreground">Capability</label>
              <select
                id="capability"
                name="capability"
                required
                className="mt-1 block w-full p-2 border rounded"
              >
                <option value="">Select a capability</option>
                {(agent.capabilities as any[] || []).map((cap, index) => (
                  <option key={index} value={cap.name}>{cap.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="payload" className="block text-sm font-medium text-muted-foreground">Payload</label>
              <textarea
                id="payload"
                name="payload"
                rows={3}
                className="mt-1 block w-full p-2 border rounded"
                placeholder='e.g., { "query": "show me the total sales for last week" }'
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
              Assign Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
