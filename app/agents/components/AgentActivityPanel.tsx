'use client';

import type { Agent } from '@/ddd/domain/agents/entities/agent';
import { useEffect, useState } from 'react';
import { getTasks } from '@/app/actions/tasks';
import TaskFormDialog from './TaskFormDialog';

interface AgentActivityPanelProps {
  agent: Agent;
}

export default function AgentActivityPanel({ agent }: AgentActivityPanelProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    const fetchTasks = async () => {
      setLoading(true);
      const result = await getTasks(agent.id);
      if (result.success) {
        setTasks(result.data);
      }
      setLoading(false);
    };

    fetchTasks();
  }, [agent.id]);

  return (
    <div className="text-foreground">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Activity</h3>
        <button
          onClick={() => setIsFormOpen(true)}
          className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm hover:bg-primary/90"
        >
          Assign Task
        </button>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Loading tasks...</p>
      ) : (
        <div className="space-y-4">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <div key={task.id} className="p-4 border rounded-lg bg-card">
                <div className="flex justify-between">
                  <h4 className="font-semibold text-foreground">{task.name}</h4>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      task.status === 'completed'
                        ? 'bg-green-500/20 text-green-400'
                        : task.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : task.status === 'in_progress'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {task.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Capability: {task.capabilityName}</p>
                <p className="text-xs text-muted-foreground/80 mt-2">
                  Created at: {hasMounted ? new Date(task.createdAt).toLocaleString() : ''}
                </p>
                <div className="mt-2">
                  <h5 className="text-xs font-semibold text-muted-foreground">Payload</h5>
                  <pre className="text-xs text-muted-foreground/80 mt-1 bg-primary/10 p-2 rounded">
                    {JSON.stringify(task.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No tasks found for this agent.</p>
          )}
        </div>
      )}
      <TaskFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        agent={agent}
      />
    </div>
  );
}
