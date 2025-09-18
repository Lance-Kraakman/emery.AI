'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import type { AgentDTO } from '@/src/app/mappers/agent-mapper';
import { AgentDetailsPanel } from './AgentDetailsPanel';
import { ModalProvider } from './modals/ModalContext';
import { ModalManager } from './modals/ModalManager';

interface NewAgentDetailsViewProps {
  agent: AgentDTO;
  onBack: () => void;
  onUpdate?: () => void;
}

export function NewAgentDetailsView({ agent, onBack, onUpdate }: NewAgentDetailsViewProps) {
  return (
    <ModalProvider>
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="border-l border-border h-6" />
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
        </div>

        {/* Main content */}
        <AgentDetailsPanel agent={agent} onUpdate={onUpdate} />

        {/* Modal manager */}
        <ModalManager onUpdate={onUpdate} />
      </div>
    </ModalProvider>
  );
}