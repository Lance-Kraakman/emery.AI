'use client';

import React from 'react';
import { CheckCircle2, XCircle, Clock, Loader2, User, Calendar, MessageSquare, Webhook, Database, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { TaskStepItem } from './TaskStepItem';
import type { TaskDTO } from '@/app/mappers/task-mapper';

// AIDEV-NOTE: Right panel task detail view
// Shows: task info header, execution steps (from logs for now, will add ExecutionSteps later)

interface TaskDetailPanelProps {
  task: TaskDTO;
  agentId: number;
}

const statusConfig = {
  completed: { label: 'Completed', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  failed: { label: 'Failed', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  pending: { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  awaiting_human: { label: 'Awaiting Input', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
  timeout: { label: 'Timeout', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
};

const triggerConfig = {
  MANUAL: { icon: User, label: 'Manual' },
  CALENDAR: { icon: Calendar, label: null },
  CHAT: { icon: MessageSquare, label: 'Chat' },
  WEBHOOK: { icon: Webhook, label: 'Webhook' },
  DATABASE_EVENT: { icon: Database, label: null },
};

function getTriggerDisplay(task: TaskDTO): { icon: React.ElementType; label: string } {
  const triggerType = task.triggerContext?.type || 'MANUAL';
  const config = triggerConfig[triggerType as keyof typeof triggerConfig] || triggerConfig.MANUAL;

  let label = config.label;
  if (!label) {
    if (triggerType === 'CALENDAR' && task.triggerContext?.scheduleName) {
      label = task.triggerContext.scheduleName;
    } else if (triggerType === 'DATABASE_EVENT' && task.triggerContext?.tableChange) {
      label = `${task.triggerContext.tableChange.tableName} change`;
    } else {
      label = triggerType;
    }
  }

  return { icon: config.icon, label };
}

function formatDuration(startedAt: Date | null, completedAt: Date | null): string | null {
  if (!startedAt) return null;
  const end = completedAt || new Date();
  const durationMs = new Date(end).getTime() - new Date(startedAt).getTime();

  if (durationMs < 1000) return '<1s';
  if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`;
  if (durationMs < 3600000) return `${Math.round(durationMs / 60000)}m`;
  return `${Math.round(durationMs / 3600000)}h`;
}

export function TaskDetailPanel({ task, agentId }: TaskDetailPanelProps) {
  const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.pending;
  const trigger = getTriggerDisplay(task);
  const TriggerIcon = trigger.icon;
  const duration = formatDuration(task.startedAt, task.completedAt);

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{task.name}</h2>
          <Badge variant="outline" className={cn('shrink-0', status.color)}>
            {status.label}
          </Badge>
        </div>

        {/* Trigger & timing info */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <TriggerIcon className="h-4 w-4" />
            <span>{trigger.label}</span>
          </div>

          {task.createdAt && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>{format(new Date(task.createdAt), 'MMM d, h:mm a')}</span>
            </div>
          )}

          {duration && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground/50">Duration:</span>
              <span>{duration}</span>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      {task.instructions?.task && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Instructions</h3>
          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
            {task.instructions.task}
          </p>
        </div>
      )}

      {/* Error */}
      {task.error && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-red-500 flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" />
            Error
          </h3>
          <p className="text-sm text-red-500/80 bg-red-500/10 p-3 rounded-md border border-red-500/20">
            {task.error}
          </p>
        </div>
      )}

      {/* Execution Steps */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Execution</h3>

        {task.logs && task.logs.length > 0 ? (
          <div className="space-y-2">
            {task.logs.map((log, index) => (
              <TaskStepItem
                key={index}
                log={log}
                isLast={index === task.logs.length - 1}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No execution steps recorded</p>
        )}
      </div>

      {/* Result */}
      {task.result && task.status === 'completed' && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Result</h3>
          <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-auto max-h-48">
            {typeof task.result === 'string'
              ? task.result
              : JSON.stringify(task.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
