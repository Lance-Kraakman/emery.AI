'use client';

import React from 'react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { TaskDTO } from '@/app/mappers/task-mapper';
import type { SkillDTO } from '@/app/mappers/skill-mapper';
import type { ConnectionDTO } from '@/app/mappers/connection-mapper';
import { CompactAgentHeader } from './CompactAgentHeader';
import { AgentExecutionTimeline } from '@/components/timeline/AgentExecutionTimeline';
import { ModalProvider } from './modals/ModalContext';
import { ModalManager } from './modals/ModalManager';

interface NewAgentDetailsViewProps {
  agent: AgentDTO;
  tasks: TaskDTO[];
  skills: SkillDTO[];
  connections: ConnectionDTO[];
  onUpdate?: () => void;
}

export function NewAgentDetailsView({ agent, tasks, skills, connections, onUpdate }: NewAgentDetailsViewProps) {
  return (
    <ModalProvider>
      {/* Full-screen layout: header on top, timeline below */}
      <div className="h-full flex flex-col bg-card">
        {/* Compact Agent Header */}
        <CompactAgentHeader
          agent={agent}
          skills={skills}
          connections={connections}
        />

        {/* Full-width Timeline */}
        <div className="flex-1 overflow-hidden">
          <AgentExecutionTimeline
            tasks={tasks}
            schedules={agent.schedules}
          />
        </div>
      </div>

      {/* Modal manager */}
      <ModalManager onUpdate={onUpdate} />
    </ModalProvider>
  );
}
