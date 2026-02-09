'use client';

import React, { useState, useEffect } from 'react';
import { Circle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// AIDEV-NOTE: Individual step display in task detail
// Parses task progress logs and displays them cleanly (no raw JSON)

interface TaskStepItemProps {
  log: string;
  isLast: boolean;
}

interface ParsedLog {
  timestamp: string | null;
  status: string;
  percent: number | null;
  message: string | null;
  result: string | null;
  raw: string;
}

// Parse log format: "[ISO_TIMESTAMP] TASK_STATUS - XX% | Output: {...}"
function parseLog(log: string): ParsedLog {
  // First extract timestamp if present
  let timestamp: string | null = null;
  let remaining = log;

  const timestampMatch = log.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (timestampMatch) {
    timestamp = timestampMatch[1];
    remaining = timestampMatch[2];
  }

  // Try to parse task progress format: "TASK_STATUS - XX% | Output: {...}"
  // Also handle format without Output section
  const progressMatch = remaining.match(/^(TASK_\w+)\s*-\s*(\d+)%/);
  if (progressMatch) {
    const [fullMatch, status, percent] = progressMatch;
    let message: string | null = null;
    let result: string | null = null;

    // Extract everything after "Output:" if present
    const outputMatch = remaining.match(/\|\s*Output:\s*(.*)$/);
    if (outputMatch) {
      const outputStr = outputMatch[1].trim();
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(outputStr);
        message = parsed.message || null;
        result = parsed.result || null;
      } catch {
        // Not valid JSON - might be truncated or plain text
        // Try to extract message from partial JSON like {"message": "text...
        const msgMatch = outputStr.match(/"message":\s*"([^"]*)/);
        if (msgMatch) {
          message = msgMatch[1];
        } else {
          message = outputStr;
        }
      }
    }

    return {
      timestamp,
      status,
      percent: parseInt(percent),
      message,
      result,
      raw: remaining
    };
  }

  // Fallback: just return the content as message
  return {
    timestamp,
    status: 'unknown',
    percent: null,
    message: remaining,
    result: null,
    raw: remaining
  };
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoString;
  }
}

function getStatusIcon(status: string, isLast: boolean) {
  if (isLast && (status === 'TASK_COMPLETED' || status === 'unknown')) {
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  }
  if (status === 'TASK_IN_PROGRESS') {
    return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
  }
  if (status === 'TASK_FAILED') {
    return <Circle className="h-2.5 w-2.5 text-red-500 fill-current" />;
  }
  return <Circle className="h-2.5 w-2.5 text-muted-foreground fill-current" />;
}

export function TaskStepItem({ log, isLast }: TaskStepItemProps) {
  const parsed = parseLog(log);

  // Format timestamp after hydration to avoid server/client timezone mismatch
  const [formattedTime, setFormattedTime] = useState<string>('');

  useEffect(() => {
    if (parsed.timestamp) {
      setFormattedTime(formatTimestamp(parsed.timestamp));
    }
  }, [parsed.timestamp]);

  // Build display text: prefer message, fall back to result, then raw
  const displayText = parsed.message || parsed.result || parsed.raw;

  return (
    <div className="flex gap-3">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
          {getStatusIcon(parsed.status, isLast)}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-border mt-1" />}
      </div>

      {/* Step content */}
      <div className={cn('flex-1 min-w-0', !isLast && 'pb-3')}>
        <div className="flex items-start gap-2 flex-wrap">
          <span className="text-sm break-words whitespace-pre-wrap">{displayText}</span>
          {parsed.percent !== null && (
            <span className="text-xs text-muted-foreground">
              {parsed.percent}%
            </span>
          )}
          {formattedTime && (
            <span className="text-xs text-muted-foreground">
              {formattedTime}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
