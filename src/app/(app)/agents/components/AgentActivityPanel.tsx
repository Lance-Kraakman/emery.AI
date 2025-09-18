'use client';

import type { AgentDTO } from '@/src/app/mappers/agent-mapper';
import React, { useEffect, useState, useMemo } from 'react';
import { getTasks } from '@/src/app/actions/tasks';
import TaskFormDialog from './TaskFormDialog';
import { TaskCard } from '@/src/components/tasks/TaskCard';
import {
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Plus
} from 'lucide-react';
import { TaskDTO as Task } from '@/src/app/mappers/task-mapper';

interface AgentActivityPanelProps {
  agent: AgentDTO;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'in_progress':
      return <Activity className="w-4 h-4 text-green-600" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-600" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-blue-600" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-600" />;
    default:
      return <Clock className="w-4 h-4 text-gray-600" />;
  }
};

export default function AgentActivityPanel({ agent }: AgentActivityPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
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

  // Sort tasks by most recent first
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aDate = a.startedAt || a.createdAt;
      const bDate = b.startedAt || b.createdAt;

      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;

      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }, [tasks]);

  // Group tasks by status
  const groupedTasks = useMemo(() => {
    return sortedTasks.reduce((acc, task) => {
      const status = task.status || 'unknown';
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(task);
      return acc;
    }, {} as Record<string, Task[]>);
  }, [sortedTasks]);

  const taskCounts = useMemo(() => {
    return {
      total: tasks.length,
      active: tasks.filter(t => t.status === 'in_progress').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
    };
  }, [tasks]);

  return (
    <div className="text-foreground">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Activity
          </h3>
          {tasks.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Total: {taskCounts.total}</span>
              {taskCounts.active > 0 && <span className="text-green-600">Active: {taskCounts.active}</span>}
              {taskCounts.pending > 0 && <span className="text-yellow-600">Pending: {taskCounts.pending}</span>}
              {taskCounts.failed > 0 && <span className="text-red-600">Failed: {taskCounts.failed}</span>}
            </div>
          )}
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm hover:bg-primary/90 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Assign Task
        </button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading tasks...</p>
      ) : (
        <div className="space-y-4">
          {sortedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Activity className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No tasks found for this agent.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedTasks).map(([status, statusTasks]) => (
                <div key={status} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <div className="shrink-0">{getStatusIcon(status)}</div>
                    <span className="capitalize">
                      {status.replace('_', ' ')} ({statusTasks.length})
                    </span>
                  </div>

                  {statusTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={{
                        ...task,
                        capabilityName: task.capabilityName || undefined,
                        error: task.error || undefined,
                        logs: task.logs || [],
                        completedAt: task.completedAt ? (typeof task.completedAt === 'string' ? task.completedAt : task.completedAt.toISOString()) : undefined,
                        startedAt: task.startedAt ? (typeof task.startedAt === 'string' ? task.startedAt : task.startedAt.toISOString()) : undefined,
                        createdAt: typeof task.createdAt === 'string' ? task.createdAt : task.createdAt.toISOString()
                      }}
                      hasMounted={hasMounted}
                      variant="full"
                    />
                  ))}
                </div>
              ))}
            </div>
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
