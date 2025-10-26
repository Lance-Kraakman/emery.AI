'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ModalType =
  | 'basic-info'
  | 'trigger-config'
  | 'skills'
  | 'tools-servers'
  | 'activity-details';

interface ModalState {
  type: ModalType | null;
  isOpen: boolean;
  data?: any;
}

interface ModalContextType {
  modalState: ModalState;
  openModal: (type: ModalType, data?: any) => void;
  closeModal: () => void;
  updateModalData: (data: any) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}

interface ModalProviderProps {
  children: React.ReactNode;
}

export function ModalProvider({ children }: ModalProviderProps) {
  const [modalState, setModalState] = useState<ModalState>({
    type: null,
    isOpen: false,
    data: undefined
  });

  const openModal = useCallback((type: ModalType, data?: any) => {
    setModalState({
      type,
      isOpen: true,
      data
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalState({
      type: null,
      isOpen: false,
      data: undefined
    });
  }, []);

  const updateModalData = useCallback((data: any) => {
    setModalState(prev => ({
      ...prev,
      data: { ...prev.data, ...data }
    }));
  }, []);

  const value: ModalContextType = {
    modalState,
    openModal,
    closeModal,
    updateModalData
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}