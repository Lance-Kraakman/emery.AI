'use client';

import React, { useState } from 'react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import type { ServerConfig } from '@/ddd/domain/agents/entities/agent';
import { createTask } from '@/app/actions/tasks';

interface TaskFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentDTO;
}

export default function TaskFormDialog({ isOpen, onClose, agent }: TaskFormDialogProps) {
  const [selectedTools, setSelectedTools] = useState<ToolConfig[]>([]);
  const [selectedServers, setSelectedServers] = useState<ServerConfig[]>([]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get('name') as string;
    const capabilityName = formData.get('capability') as string;
    const instructions = formData.get('instructions') as string;
    
    await createTask({ 
      agentId: agent.id, 
      name, 
      capabilityName: capabilityName || undefined, // Auto-route if empty
      instructions: {
        instructions,
        tools: selectedTools.length > 0 ? selectedTools : undefined,
        servers: selectedServers.length > 0 ? selectedServers : undefined,
      }
    });
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
              <label htmlFor="capability" className="block text-sm font-medium text-muted-foreground">
                Capability <span className="text-xs text-muted-foreground">(optional - system will auto-route)</span>
              </label>
              <select
                id="capability"
                name="capability"
                className="mt-1 block w-full p-2 border rounded"
              >
                <option value="">Auto-select capability</option>
                {(agent.capabilities as any[] || []).map((cap, index) => (
                  <option key={index} value={cap.name}>{cap.name}</option>
                ))}
              </select>
            </div>
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
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground">
                Available Tools <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <div className="mt-1 space-y-1 max-h-20 overflow-y-auto">
                {(agent.tools as any[] || []).map((tool, index) => (
                  <label key={index} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      className="mr-2"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTools([...selectedTools, tool]);
                        } else {
                          setSelectedTools(selectedTools.filter(t => t.name !== tool.name));
                        }
                      }}
                    />
                    {tool.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground">
                Available Servers <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <div className="mt-1 space-y-1 max-h-20 overflow-y-auto">
                {(agent.servers as any[] || []).map((server, index) => (
                  <label key={index} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      className="mr-2"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedServers([...selectedServers, server]);
                        } else {
                          setSelectedServers(selectedServers.filter(s => s.name !== server.name));
                        }
                      }}
                    />
                    {server.name} {server.endpoint && `(${server.endpoint})`}
                  </label>
                ))}
              </div>
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
