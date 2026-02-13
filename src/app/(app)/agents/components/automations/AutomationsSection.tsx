'use client';

import React from 'react';
import { Calendar, Webhook, Database, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useModal } from '../modals/ModalContext';
import type { AutomationConfigurationDTO } from '@/app/dtos/automation.dto';
import type { AgentDTO } from '@/app/mappers/agent-mapper';

// AIDEV-NOTE: Collapsible automations section in left panel
// Shows list of automations, clicking opens TriggerConfigModal

interface AutomationsSectionProps {
  agent: AgentDTO;
  automations: AutomationConfigurationDTO[];
}

const triggerTypeIcons = {
  CALENDAR: Calendar,
  WEBHOOK: Webhook,
  DATABASE_EVENT: Database,
};

export function AutomationsSection({ agent, automations }: AutomationsSectionProps) {
  const { openModal } = useModal();

  const handleAutomationClick = (automation: AutomationConfigurationDTO, index: number) => {
    openModal('trigger-config', { agent, mode: 'edit', scheduleIndex: index });
  };

  const handleAddAutomation = () => {
    openModal('trigger-config', { agent });
  };

  return (
    <div className="px-2 py-1 space-y-1">
      {automations.length === 0 ? (
        <div className="px-2 py-2 text-xs text-muted-foreground">
          No automations configured
        </div>
      ) : (
        automations.map((automation, index) => {
          const TriggerIcon = triggerTypeIcons[automation.trigger.type as keyof typeof triggerTypeIcons] || Calendar;
          const isEnabled = automation.enabled;

          return (
            <button
              key={index}
              onClick={() => handleAutomationClick(automation, index)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors text-left"
            >
              <TriggerIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 truncate">
                {automation.name || `Automation ${index + 1}`}
              </span>
              {!isEnabled && (
                <span className="text-xs text-muted-foreground">(disabled)</span>
              )}
            </button>
          );
        })
      )}

      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-xs h-7"
        onClick={handleAddAutomation}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add automation
      </Button>
    </div>
  );
}
