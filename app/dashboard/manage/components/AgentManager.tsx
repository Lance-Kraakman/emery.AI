'use client';

import { useState } from 'react';
import { createAgentAction, deleteAgent } from '@/app/actions/agents';

interface Agent {
  id: number;
  name: string;
  role?: string | null;
  description?: string | null;
  persona?: string | null;
  tools?: unknown; // JSONB field for ToolConfig[]
  servers?: unknown; // JSONB field for ServerConfig[]
  capabilities?: unknown; // JSONB field containing capabilities config
  status: string | null;
  apiKey?: string | null;
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
            <input
              name="role"
              placeholder="Role (e.g., assistant, analyst)"
              className="w-full p-2 border rounded"
            />
            <textarea
              name="description"
              placeholder="Description"
              rows={2}
              className="w-full p-2 border rounded"
            />
            <textarea
              name="persona"
              placeholder="Persona (how the agent should behave)"
              rows={2}
              className="w-full p-2 border rounded"
            />
            <select name="model" className="w-full p-2 border rounded">
              <option value="">Select Model</option>
              <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
              <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
            <input
              name="tools"
              placeholder="Tools (comma-separated, e.g., python, calculator)"
              className="w-full p-2 border rounded"
            />
            <input
              name="servers"
              placeholder="Servers (comma-separated, e.g., gmail, slack)"
              className="w-full p-2 border rounded"
            />
            <input
              name="goals"
              placeholder="Goals (comma-separated)"
              className="w-full p-2 border rounded"
            />
            <select name="status" className="w-full p-2 border rounded">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
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
                {agent.role || 'assistant'} • {agent.status || 'active'}
              </p>
              {agent.description && (
                <p className="text-xs text-gray-500 mt-1">{agent.description}</p>
              )}
              {agent.tools && Array.isArray(agent.tools) && agent.tools.length > 0 ? (
                <p className="text-xs text-gray-400">
                  Tools: {(agent.tools as any[]).map(tool => 
                    typeof tool === 'string' ? tool : tool.name || 'Unknown'
                  ).join(', ')}
                </p>
              ) : null}
              {agent.servers && Array.isArray(agent.servers) && agent.servers.length > 0 ? (
                <p className="text-xs text-gray-400">
                  Servers: {(agent.servers as any[]).map(server => 
                    typeof server === 'string' ? server : server.name || 'Unknown'
                  ).join(', ')}
                </p>
              ) : null}
              {agent.capabilities && Array.isArray(agent.capabilities) ? (
                <p className="text-xs text-gray-400">
                  Capabilities: {(agent.capabilities as any[]).map(cap => cap.name).join(', ')}
                </p>
              ) : null}
              {agent.apiKey && (
                <p className="text-xs font-mono text-blue-600 mt-1">API Key: {agent.apiKey}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // Navigate to agent detail page
                  window.location.href = `/dashboard/agents/${agent.id}`;
                }}
                className="bg-blue-500 text-white px-2 py-1 rounded text-xs"
              >
                View
              </button>
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
          </div>
        ))}
        {agents.length === 0 && (
          <p className="text-gray-500 text-center py-4">No agents found</p>
        )}
      </div>
    </div>
  );
}