'use client';

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskDetailPanel } from '../tasks/TaskDetailPanel';
import type { TaskDTO } from '@/app/mappers/task-mapper';

// AIDEV-NOTE: Right panel of split view
// Shows task detail with execution steps when a task is selected

interface RightPanelProps {
  task: TaskDTO | null;
  agentId: number;
}

export function RightPanel({ task, agentId }: RightPanelProps) {
  if (!task) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">Select a task to view details</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <TaskDetailPanel task={task} agentId={agentId} />
    </ScrollArea>
  );
}
