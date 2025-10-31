'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import { AgentDetailsPanel } from './AgentDetailsPanel';
import { ModalProvider } from './modals/ModalContext';
import { ModalManager } from './modals/ModalManager';

interface NewAgentDetailsViewProps {
  agent: AgentDTO;
  onUpdate?: () => void;
}

export function NewAgentDetailsView({ agent, onUpdate }: NewAgentDetailsViewProps) {
  return (
    <ModalProvider>
      <div className="space-y-6">
        {/* Header without back button */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Agent Details</h1>
            <p className="text-sm text-muted-foreground">
              Configure and monitor your AI agent
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-foreground">{agent.name}</span>
            <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className="text-xs">
              {agent.status}
            </Badge>
            {agent.role && agent.role !== 'No role specified' && (
              <span className="text-sm text-muted-foreground">• {agent.role}</span>
            )}
          </div>
        </div>

        {/* Main content */}
        <AgentDetailsPanel agent={agent} onUpdate={onUpdate} />

        {/* Modal manager */}
        <ModalManager onUpdate={onUpdate} />
      </div>
    </ModalProvider>
  );
}
