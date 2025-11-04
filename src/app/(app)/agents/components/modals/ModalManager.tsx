'use client';

import React from 'react';
import { useModal } from './ModalContext';
import { BasicInfoModal } from './BasicInfoModal';
import { TriggerConfigModal } from './TriggerConfigModal';
import { ActivityDetailsModal } from './ActivityDetailsModal';
import { AuthorizedConnectionsModal } from './AuthorizedConnectionsModal';

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
          mode={modalState.data?.mode || 'create'}
          scheduleIndex={modalState.data?.scheduleIndex}
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

    case 'authorized-connections':
      return (
        <AuthorizedConnectionsModal
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