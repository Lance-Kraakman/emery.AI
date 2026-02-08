'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  // Handle back navigation based on returnTo param
  const handleBack = () => {
    if (returnTo?.startsWith('org-chart')) {
      // Parse selected node from returnTo (format: org-chart&selected=agent-5)
      const selectedMatch = returnTo.match(/selected=([^&]+)/);
      const selected = selectedMatch ? selectedMatch[1] : null;
      router.push(selected ? `/organization?selected=${selected}` : '/organization');
    } else {
      router.back();
    }
  };

  return (
    <ModalProvider>
      {/* Full-screen layout: header on top, timeline below */}
      <div className="h-full flex flex-col bg-card relative">
        {/* Back button when navigated from org chart */}
        {returnTo?.startsWith('org-chart') && (
          <div className="absolute top-2 left-2 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="bg-background/50 backdrop-blur-sm"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Org Chart
            </Button>
          </div>
        )}

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
            schedules={agent.automations}
          />
        </div>
      </div>

      {/* Modal manager */}
      <ModalManager onUpdate={onUpdate} />
    </ModalProvider>
  );
}
