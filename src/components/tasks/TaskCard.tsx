'use client';

import React from 'react';
import { Clock, User, Calendar } from 'lucide-react';
import { TaskLogsPanel } from './TaskLogsPanel';
import { TaskResultDisplay } from './TaskResultDisplay';

interface TaskCardProps {
  task: {
    id: string;
    name: string;
    status: string;
    capabilityName?: string;
    result?: any;
    error?: string;
    logs?: string[];
    createdAt: string;
    completedAt?: string;
    startedAt?: string;
  };
  className?: string;
  hasMounted?: boolean;
  variant?: 'full' | 'compact'; // Add variant prop
}

export function TaskCard({ task, className, hasMounted = true, variant = 'full' }: TaskCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  if (variant === 'compact') {
    return (
      <div className={`p-3 border rounded-lg bg-card ${className}`}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0 pr-2">
            <h4 className="font-medium text-sm truncate">{task.name}</h4>
            <p className="text-xs text-muted-foreground truncate">
              {task.capabilityName}
            </p>
          </div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(task.status)}`}
          >
            {task.status.replace('_', ' ')}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>
            {hasMounted ? new Date(task.createdAt).toLocaleString() : ''}
          </span>
        </div>

        {/* Error Display for compact */}
        {task.error && (
          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs">
            <strong>Error:</strong> {task.error}
          </div>
        )}

        {/* Compact expandable sections */}
        <div className="mt-2 space-y-1">
          <TaskResultDisplay
            result={task.result}
            taskStatus={task.status}
          />
          <TaskLogsPanel
            logs={task.logs || []}
            taskStatus={task.status}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 border rounded-lg bg-card ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-semibold text-foreground">{task.name}</h4>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(task.status)}`}
        >
          {task.status}
        </span>
      </div>

      {/* Task Details */}
      <div className="space-y-2 text-sm text-muted-foreground">
        {task.capabilityName && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Capability: {task.capabilityName}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>Created: {hasMounted ? new Date(task.createdAt).toLocaleString() : ''}</span>
        </div>

        {task.startedAt && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Started: {hasMounted ? new Date(task.startedAt).toLocaleString() : ''}</span>
          </div>
        )}

        {task.completedAt && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Completed: {hasMounted ? new Date(task.completedAt).toLocaleString() : ''}</span>
          </div>
        )}
      </div>

      {/* Error Display */}
      {task.error && (
        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
          <strong>Error:</strong> {task.error}
        </div>
      )}

      {/* Expandable Sections */}
      <div className="mt-4 space-y-2">
        {/* Task Result */}
        <TaskResultDisplay
          result={task.result}
          taskStatus={task.status}
        />

        {/* Task Logs */}
        <TaskLogsPanel
          logs={task.logs || []}
          taskStatus={task.status}
        />
      </div>
    </div>
  );
}