'use client';

import React from 'react';
import { useModal } from './ModalContext';
import { BasicInfoModal } from './BasicInfoModal';
import { TriggerConfigModal } from './TriggerConfigModal';
import { ToolsServersModal } from './ToolsServersModal';
import { ActivityDetailsModal } from './ActivityDetailsModal';

interface ModalManagerProps {
  onUpdate?: () => void;
}

export function ModalManager({ onUpdate }: ModalManagerProps) {
  const { modalState, closeModal } = useModal();

  if (!modalState.isOpen || !modalState.type) {
    return null;
  }

  switch (modalState.type) {
    case 'basic-info':
      return (
        <BasicInfoModal
          isOpen={true}
          onClose={closeModal}
          agent={modalState.data?.agent}
          onUpdate={onUpdate}
        />
      );

    case 'trigger-config':
      return (
        <TriggerConfigModal
          isOpen={true}
          onClose={closeModal}
          agent={modalState.data?.agent}
          onUpdate={onUpdate}
        />
      );

    case 'tools-servers':
      return (
        <ToolsServersModal
          isOpen={true}
          onClose={closeModal}
          agent={modalState.data?.agent}
          onUpdate={onUpdate}
        />
      );

    case 'activity-details':
      return (
        <ActivityDetailsModal
          isOpen={true}
          onClose={closeModal}
          agent={modalState.data?.agent}
          onUpdate={onUpdate}
        />
      );

    default:
      return null;
  }
}