'use client';

import React from 'react';
import { Circle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// AIDEV-NOTE: Individual step display in task detail
// Currently displays log strings, will be enhanced to show ExecutionSteps

interface TaskStepItemProps {
  log: string;
  isLast: boolean;
}

// Parse log timestamp and content from format: "[ISO_TIMESTAMP] message"
function parseLog(log: string): { timestamp: string | null; content: string } {
  const match = log.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (match) {
    return { timestamp: match[1], content: match[2] };
  }
  return { timestamp: null, content: log };
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoString;
  }
}

export function TaskStepItem({ log, isLast }: TaskStepItemProps) {
  const { timestamp, content } = parseLog(log);

  return (
    <div className="flex gap-3">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
          {isLast ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Circle className="h-2.5 w-2.5 text-muted-foreground fill-current" />
          )}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-border mt-1" />}
      </div>

      {/* Step content */}
      <div className={cn('flex-1', !isLast && 'pb-3')}>
        <div className="flex items-center gap-2">
          <span className="text-sm">{content}</span>
          {timestamp && (
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(timestamp)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
