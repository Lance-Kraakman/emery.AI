'use client';

import React from 'react';
import { BaseModal } from './BaseModal';
import { AutomationEditor } from '@/components/automation/AutomationEditor';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { AutomationConfigurationDTO } from '@/app/dtos/automation.dto';

interface TriggerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentDTO;
  onUpdate?: () => void;
  mode?: 'create' | 'edit';
  scheduleIndex?: number;
}

export function TriggerConfigModal({
  isOpen,
  onClose,
  agent,
  onUpdate,
  mode = 'edit',
  scheduleIndex = 0
}: TriggerConfigModalProps) {
  const automation: AutomationConfigurationDTO | undefined =
    mode === 'edit' && agent.automations?.[scheduleIndex]
      ? agent.automations[scheduleIndex]
      : undefined;

  const handleSave = () => {
    onUpdate?.();
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Add Automation' : 'Edit Automation'}
      size="lg"
    >
      <div className="p-6">
        <AutomationEditor
          agent={agent}
          automation={automation}
          automationIndex={mode === 'edit' ? scheduleIndex : undefined}
          onSave={handleSave}
          onCancel={onClose}
        />
      </div>
    </BaseModal>
  );
}