'use client';

import type { AgentDTO } from '@/app/mappers/agent-mapper';
import React, { useEffect, useState } from 'react';
import { getTasks } from '@/app/actions/tasks';
import TaskFormDialog from './TaskFormDialog';
import { TaskCard } from '@/components/tasks/TaskCard';

interface AgentActivityPanelProps {
  agent: AgentDTO;
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
              <TaskCard
                key={task.id}
                task={task}
                hasMounted={hasMounted}
              />
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
