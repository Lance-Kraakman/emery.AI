'use client';

import React from 'react';
import { Clock, Calendar, Zap, Webhook, MousePointer, User } from 'lucide-react';
import { TaskLogsPanel } from './TaskLogsPanel';
import { TaskResultDisplay } from './TaskResultDisplay';

interface TaskCardProps {
  task: {
    id: string;
    name: string;
    status: string;
    triggerContext?: {
      type: 'DATABASE_EVENT' | 'CALENDAR' | 'WEBHOOK' | 'MANUAL';
      scheduleName?: string;
      tableChange?: any;
    } | null;
    result?: any;
    error?: string;
    logs?: string[];
    createdAt: string;
    completedAt?: string;
    startedAt?: string;
  };
  className?: string;
  hasMounted?: boolean;
  variant?: 'full' | 'compact';
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
      case 'awaiting_human':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'awaiting_human':
        return 'Needs Action';
      default:
        return status.replace('_', ' ');
    }
  };

  const getTriggerIcon = (type?: string) => {
    switch (type) {
      case 'DATABASE_EVENT':
        return <Zap className="h-3 w-3" />;
      case 'CALENDAR':
        return <Calendar className="h-3 w-3" />;
      case 'WEBHOOK':
        return <Webhook className="h-3 w-3" />;
      default:
        return <MousePointer className="h-3 w-3" />;
    }
  };

  const getTriggerLabel = (type?: string) => {
    switch (type) {
      case 'DATABASE_EVENT':
        return 'Database Event';
      case 'CALENDAR':
        return 'Scheduled';
      case 'WEBHOOK':
        return 'Webhook';
      default:
        return 'Manual';
    }
  };

  const getTriggerColor = (type?: string) => {
    switch (type) {
      case 'DATABASE_EVENT':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'CALENDAR':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'WEBHOOK':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
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
            {/* Trigger information */}
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${getTriggerColor(task.triggerContext?.type)}`}>
                {getTriggerIcon(task.triggerContext?.type)}
                {getTriggerLabel(task.triggerContext?.type)}
              </span>
              {task.triggerContext?.scheduleName && (
                <span className="text-xs text-muted-foreground truncate">
                  {task.triggerContext.scheduleName}
                </span>
              )}
            </div>
          </div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full border flex items-center gap-1 ${getStatusColor(task.status)}`}
          >
            {task.status === 'awaiting_human' && <User className="h-3 w-3" />}
            {getStatusLabel(task.status)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            {hasMounted ? new Date(task.createdAt).toLocaleString() : ''}
          </span>
        </div>

        {/* Database event details for compact */}
        {task.triggerContext?.type === 'DATABASE_EVENT' && task.triggerContext?.tableChange && (
          <div className="mt-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {task.triggerContext.tableChange.operation || 'CHANGE'}
              </span>
              <span className="text-muted-foreground">
                on {task.triggerContext.tableChange.tableName || 'table'}
              </span>
            </div>
          </div>
        )}

        {/* Awaiting Human Banner for compact */}
        {task.status === 'awaiting_human' && (
          <div className="mt-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded text-xs">
            <div className="flex items-center gap-1.5 text-purple-400">
              <User className="h-3 w-3" />
              <span className="font-medium">Needs your action</span>
            </div>
          </div>
        )}

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
          className={`px-2 py-1 text-xs font-medium rounded-full border flex items-center gap-1 ${getStatusColor(task.status)}`}
        >
          {task.status === 'awaiting_human' && <User className="h-3 w-3" />}
          {getStatusLabel(task.status)}
        </span>
      </div>

      {/* Trigger Information */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${getTriggerColor(task.triggerContext?.type)}`}>
            {getTriggerIcon(task.triggerContext?.type)}
            {getTriggerLabel(task.triggerContext?.type)}
          </span>
          {task.triggerContext?.scheduleName && (
            <span className="text-sm text-muted-foreground">
              Schedule: <span className="font-medium">{task.triggerContext.scheduleName}</span>
            </span>
          )}
        </div>

        {/* Database event details */}
        {task.triggerContext?.type === 'DATABASE_EVENT' && task.triggerContext?.tableChange && (
          <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded text-sm">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-400" />
              <span className="font-medium text-purple-400">
                {task.triggerContext.tableChange.operation || 'CHANGE'}
              </span>
              <span className="text-muted-foreground">
                on table <span className="font-medium">{task.triggerContext.tableChange.tableName || 'unknown'}</span>
              </span>
            </div>
            {task.triggerContext.tableChange.rowId && (
              <div className="mt-1 text-xs text-muted-foreground">
                Row ID: {task.triggerContext.tableChange.rowId}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Details */}
      <div className="space-y-2 text-sm text-muted-foreground">
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

      {/* Awaiting Human Banner */}
      {task.status === 'awaiting_human' && (
        <div className="mt-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded">
          <div className="flex items-center gap-2 text-purple-400">
            <User className="h-4 w-4" />
            <span className="font-medium">Human Action Required</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            This task is waiting for a human to complete a step before it can continue.
          </p>
        </div>
      )}

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