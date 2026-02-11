'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, Loader2, User, Calendar, MessageSquare, Webhook, Database, AlertCircle, Brain, Wrench, Lightbulb, Code } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { TaskStepItem } from './TaskStepItem';
import type { TaskDTO } from '@/app/mappers/task-mapper';
import { getChatMessageExecutionSteps } from '@/app/actions/chat-history';
import type { ExecutionStep } from '@/ddd/domain/chat/value-objects/execution-step';
import { getStepConfig } from '@/lib/chat/step-config';

// AIDEV-NOTE: Right panel task detail view
// Shows: task info header, execution steps from ChatMessage (rich) or logs (fallback)

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

/**
 * Safely format a date with a given format string
 * Returns 'Unknown' if date is null/undefined or invalid
 */
function safeFormatDate(date: Date | string | null | undefined, formatStr: string): string {
  if (!date) return 'Unknown';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid date';
    return format(d, formatStr);
  } catch {
    return 'Unknown';
  }
}

/**
 * Format task result for display
 * Extracts 'result' key from JSON objects for cleaner display
 */
function formatResult(result: unknown): { display: string; isJson: boolean } {
  // If it's a string, try to parse as JSON first
  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result);
      // If parsed successfully, recursively format
      return formatResult(parsed);
    } catch {
      // Not JSON, return as-is
      return { display: result, isJson: false };
    }
  }
  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>;
    // If it has a 'result' key with string value, extract for clean display
    if ('result' in obj && typeof obj.result === 'string') {
      return { display: obj.result, isJson: false };
    }
    // If it has a 'message' key, use that
    if ('message' in obj && typeof obj.message === 'string') {
      return { display: obj.message, isJson: false };
    }
  }
  // Fallback to formatted JSON
  return { display: JSON.stringify(result, null, 2), isJson: true };
}

// Component to render a single ExecutionStep
function ExecutionStepItemRich({ step, isLast }: { step: ExecutionStep; isLast: boolean }) {
  const config = getStepConfig(step.type);
  const StepIcon = config.icon;

  return (
    <div className={cn(
      'relative pl-6 pb-4',
      !isLast && 'border-l border-border ml-2'
    )}>
      <div className={cn(
        'absolute left-0 top-0 w-4 h-4 rounded-full flex items-center justify-center -translate-x-1/2',
        config.bgColor
      )}>
        <StepIcon className={cn('h-2.5 w-2.5', config.color)} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium', config.color)}>{step.name}</span>
          {step.metadata?.tool && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {step.metadata.tool}
            </Badge>
          )}
        </div>
        {step.content && (
          <p className="text-xs text-muted-foreground line-clamp-3">{step.content}</p>
        )}
        {step.metadata?.skill_name && (
          <p className="text-xs text-muted-foreground">
            Skill: {step.metadata.skill_name}
            {step.metadata.skill_status && ` (${step.metadata.skill_status})`}
          </p>
        )}
        {step.metadata?.error && (
          <p className="text-xs text-red-500">{step.metadata.error}</p>
        )}
      </div>
    </div>
  );
}

export function TaskDetailPanel({ task, agentId }: TaskDetailPanelProps) {
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [isLoadingSteps, setIsLoadingSteps] = useState(false);

  // Formatted date (set after hydration to prevent timezone mismatch)
  const [formattedDate, setFormattedDate] = useState<string>('');

  // Format date after hydration to avoid server/client timezone mismatch
  useEffect(() => {
    if (task.createdAt) {
      setFormattedDate(safeFormatDate(task.createdAt, 'MMM d, h:mm a'));
    }
  }, [task.createdAt]);

  // Fetch execution steps from ChatMessage when chatMessageId is present
  useEffect(() => {
    if (task.chatMessageId) {
      setIsLoadingSteps(true);
      getChatMessageExecutionSteps(task.chatMessageId)
        .then((result) => {
          if (result.success && result.data) {
            setExecutionSteps(result.data);
          }
        })
        .catch((error) => {
          console.error('Failed to fetch execution steps:', error);
        })
        .finally(() => {
          setIsLoadingSteps(false);
        });
    } else {
      setExecutionSteps([]);
    }
  }, [task.chatMessageId]);

  const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.pending;
  const trigger = getTriggerDisplay(task);
  const TriggerIcon = trigger.icon;

  // Defer duration calculation to avoid hydration mismatch (uses new Date())
  const [duration, setDuration] = useState<string | null>(null);

  useEffect(() => {
    setDuration(formatDuration(task.startedAt, task.completedAt));
  }, [task.startedAt, task.completedAt]);

  // Use rich execution steps if available, otherwise fall back to logs
  const hasExecutionSteps = executionSteps.length > 0;
  const hasLogs = task.logs && task.logs.length > 0;

  return (
    <div className="p-4 space-y-4">
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

          {formattedDate && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>{formattedDate}</span>
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

        {isLoadingSteps ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading execution steps...</span>
          </div>
        ) : hasExecutionSteps ? (
          // Rich execution steps from ChatMessage
          <div className="space-y-0">
            {executionSteps.map((step, index) => (
              <ExecutionStepItemRich
                key={`${step.index}-${step.type}`}
                step={step}
                isLast={index === executionSteps.length - 1}
              />
            ))}
          </div>
        ) : hasLogs ? (
          // Fallback to simple logs
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
          {(() => {
            // Extract result text if available, otherwise show formatted JSON
            const { display, isJson } = formatResult(task.result);
            return isJson ? (
              <pre className="text-xs font-mono bg-muted/50 p-3 rounded-md overflow-auto max-h-48 whitespace-pre-wrap break-words">
                {display}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md whitespace-pre-wrap break-words">
                {display}
              </p>
            );
          })()}
        </div>
      )}
    </div>
  );
}
