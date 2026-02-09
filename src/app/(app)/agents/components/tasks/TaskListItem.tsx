'use client';

import React from 'react';
import { CheckCircle2, XCircle, Clock, Loader2, User, Calendar, MessageSquare, Webhook, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { TaskDTO } from '@/app/mappers/task-mapper';

// AIDEV-NOTE: Single task row in the tasks list
// Shows: name, trigger type/automation name, status, duration, timestamp

interface TaskListItemProps {
  task: TaskDTO;
  isSelected: boolean;
  onSelect: () => void;
}

const statusConfig: Record<string, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  animate?: boolean;
}> = {
  completed: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  in_progress: {
    icon: Loader2,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    animate: true,
  },
  pending: {
    icon: Clock,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
  awaiting_human: {
    icon: User,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  cancelled: {
    icon: XCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
  },
  timeout: {
    icon: Clock,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
};

const triggerConfig = {
  MANUAL: { icon: User, label: 'Manual' },
  CALENDAR: { icon: Calendar, label: null }, // Use scheduleName
  CHAT: { icon: MessageSquare, label: 'Chat' },
  WEBHOOK: { icon: Webhook, label: 'Webhook' },
  DATABASE_EVENT: { icon: Database, label: null }, // Use table name
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

export function TaskListItem({ task, isSelected, onSelect }: TaskListItemProps) {
  const status = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const trigger = getTriggerDisplay(task);
  const TriggerIcon = trigger.icon;
  const duration = formatDuration(task.startedAt, task.completedAt);
  const timeAgo = formatDistanceToNow(new Date(task.createdAt), { addSuffix: true });

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left px-3 py-2 rounded-md transition-colors',
        'hover:bg-accent',
        isSelected && 'bg-accent'
      )}
    >
      <div className="flex items-start gap-2">
        {/* Status icon */}
        <div className={cn('mt-0.5 p-1 rounded', status.bgColor)}>
          <StatusIcon
            className={cn(
              'h-3.5 w-3.5',
              status.color,
              status.animate && 'animate-spin'
            )}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{task.name}</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <TriggerIcon className="h-3 w-3" />
            <span className="truncate">{trigger.label}</span>
            <span className="text-muted-foreground/50">•</span>
            <span>{timeAgo}</span>
            {duration && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <span>{duration}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
