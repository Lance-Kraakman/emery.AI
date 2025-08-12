'use client'

import { createContext, useContext, ReactNode } from 'react';
import { useEmeryData, EmeryData } from '@/hooks/useEmeryData';

interface EmeryContextType {
  data: EmeryData;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  currentOrganization: any;
  availableOrganizations: any[];
}

const EmeryContext = createContext<EmeryContextType | undefined>(undefined);

export function EmeryProvider({ children }: { children: ReactNode }) {
  const emeryData = useEmeryData();
  return (
    <EmeryContext.Provider value={emeryData}>
      {children}
    </EmeryContext.Provider>
  );
}

export function useEmery() {
  const context = useContext(EmeryContext);
  if (context === undefined) {
    throw new Error('useEmery must be used within an EmeryProvider');
  }
  return context;
}
