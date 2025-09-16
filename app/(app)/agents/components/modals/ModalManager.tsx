'use client';

import React from 'react';
import { useModal } from './ModalContext';
import { BasicInfoModal } from './BasicInfoModal';
import { TriggerConfigModal } from './TriggerConfigModal';
import { CapabilitiesModal } from './CapabilitiesModal';
import { ToolsServersModal } from './ToolsServersModal';
// import { ActivityDetailsModal } from './ActivityDetailsModal';

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

    case 'capabilities':
      return (
        <CapabilitiesModal
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeModal}>
          <div className="bg-background border rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold">Activity Details</h2>
                <p className="text-sm text-muted-foreground">Execution history and performance metrics</p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-muted rounded-md transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-muted-foreground">Activity details functionality coming soon...</p>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}