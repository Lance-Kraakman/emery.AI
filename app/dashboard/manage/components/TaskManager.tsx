'use client';

import { useState, useEffect } from 'react';

interface Task {
  id: string;
  agentId: number;
  name: string;
  capabilityName: string;
  status: string;
  payload?: any;
  result?: any;
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdBy?: string | null;
  createdAt: Date;
}

interface TaskManagerProps {
  tasks: Task[];
  agents: Array<{id: number, name: string}>;
}

export default function TaskManager({ tasks, agents }: TaskManagerProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const filteredTasks = selectedAgentId 
    ? tasks.filter(task => task.agentId === selectedAgentId)
    : tasks;

  const getAgentName = (agentId: number) => {
    const agent = agents.find(a => a.id === agentId);
    return agent?.name || `Agent ${agentId}`;
  };

  const executeCapability = async (agentId: number, capabilityName: string) => {
    setIsExecuting(true);
    try {
      const response = await fetch(`/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          name: `Test execution: ${capabilityName}`,
          capabilityName,
          payload: {
            trigger_type: 'MANUAL',
            user_request: 'Test execution from dashboard',
            timestamp: new Date().toISOString()
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`Task created successfully! Task ID: ${result.data.id}`);
        window.location.reload(); // Simple refresh to show new task
      } else {
        alert(`Task creation failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Task creation error:', error);
      alert(`Error creating task: ${error}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="border rounded p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Agent Tasks</h2>
        <div className="flex gap-2 items-center">
          <select 
            value={selectedAgentId || ''} 
            onChange={(e) => setSelectedAgentId(e.target.value ? parseInt(e.target.value) : null)}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value="">All Agents</option>
            {agents.map(agent => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Execute Section */}
      {selectedAgentId && (
        <div className="mb-4 p-3 border rounded bg-blue-50">
          <h3 className="font-medium mb-2">Test Agent Execution</h3>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Capability name (e.g., email_assistant)"
              className="flex-1 p-2 border rounded"
              id="capability-input"
            />
            <button
              onClick={() => {
                const input = document.getElementById('capability-input') as HTMLInputElement;
                if (input?.value && selectedAgentId) {
                  executeCapability(selectedAgentId, input.value);
                } else {
                  alert('Please enter a capability name');
                }
              }}
              disabled={isExecuting}
              className="bg-green-500 text-white px-3 py-1 rounded text-sm disabled:bg-gray-400"
            >
              {isExecuting ? 'Executing...' : 'Execute'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            This will execute the capability manually for testing purposes
          </p>
        </div>
      )}

      {/* Tasks List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredTasks.length === 0 && (
          <p className="text-gray-500 text-center py-4">No tasks found</p>
        )}
        
        {filteredTasks.map((task) => (
          <div key={task.id} className="p-3 border rounded bg-white">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium">{task.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(task.status)}`}>
                    {task.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Agent: {getAgentName(task.agentId)} • 
                  Capability: {task.capabilityName} • 
                  ID: {task.id.substring(0, 8)}...
                </p>
                <p className="text-xs text-gray-400">
                  Created: {new Date(task.createdAt).toLocaleString()}
                  {task.startedAt && (
                    <> • Started: {new Date(task.startedAt).toLocaleString()}</>
                  )}
                  {task.completedAt && (
                    <> • Completed: {new Date(task.completedAt).toLocaleString()}</>
                  )}
                </p>
              </div>
            </div>

            {/* Task Payload */}
            {task.payload && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-700">Payload:</p>
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(task.payload, null, 2)}
                </pre>
              </div>
            )}

            {/* Task Result */}
            {task.result && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-700">Result:</p>
                <pre className="text-xs bg-green-50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(task.result, null, 2)}
                </pre>
              </div>
            )}

            {/* Error Message */}
            {task.error && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-red-700">Error:</p>
                <p className="text-xs bg-red-50 p-2 rounded text-red-800">
                  {task.error}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Total tasks: {filteredTasks.length}
        {selectedAgentId && ` (filtered for ${getAgentName(selectedAgentId)})`}
      </div>
    </div>
  );
}