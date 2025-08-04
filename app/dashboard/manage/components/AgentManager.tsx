'use client';

import { useState } from 'react';
import { createAgentAction, deleteAgent } from '@/app/actions/agents';

interface Agent {
  id: number;
  name: string;
  type: string;
  capabilities: string[] | null;
  status: string | null;
  createdAt: Date | null;
}

interface AgentManagerProps {
  agents: Agent[];
}

export default function AgentManager({ agents }: AgentManagerProps) {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="border rounded p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Agents</h2>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
        >
          {isCreating ? 'Cancel' : 'Add Agent'}
        </button>
      </div>

      {isCreating && (
        <form action={createAgentAction} className="mb-4 p-3 border rounded bg-gray-50">
          <div className="space-y-2">
            <input
              name="name"
              placeholder="Agent name"
              required
              className="w-full p-2 border rounded"
            />
            <select name="type" required className="w-full p-2 border rounded">
              <option value="">Select type</option>
              <option value="ai_agent">AI Agent</option>
              <option value="bot">Bot</option>
              <option value="automation">Automation</option>
              <option value="service">Service</option>
            </select>
            <select name="status" className="w-full p-2 border rounded">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
            <input
              name="capabilities"
              placeholder="Capabilities (comma-separated)"
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="bg-green-500 text-white px-3 py-1 rounded text-sm">
              Create
            </button>
            <button 
              type="button" 
              onClick={() => setIsCreating(false)}
              className="bg-gray-500 text-white px-3 py-1 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {agents.map((agent) => (
          <div key={agent.id} className="flex justify-between items-start p-2 border rounded">
            <div className="flex-1">
              <h3 className="font-medium">{agent.name}</h3>
              <p className="text-sm text-gray-600">
                {agent.type} • {agent.status || 'active'}
              </p>
              {agent.capabilities && agent.capabilities.length > 0 && (
                <p className="text-xs text-gray-500">Capabilities: {agent.capabilities.join(', ')}</p>
              )}
            </div>
            <button
              onClick={async () => {
                if (confirm('Delete this agent?')) {
                  await deleteAgent(agent.id);
                  window.location.reload();
                }
              }}
              className="bg-red-500 text-white px-2 py-1 rounded text-xs"
            >
              Delete
            </button>
          </div>
        ))}
        {agents.length === 0 && (
          <p className="text-gray-500 text-center py-4">No agents found</p>
        )}
      </div>
    </div>
  );
}