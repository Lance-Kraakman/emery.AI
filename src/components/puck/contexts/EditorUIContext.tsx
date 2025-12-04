"use client";

import React, { createContext, useContext, useState, type ReactNode } from 'react';

type TabType = 'blocks' | 'fields' | 'outline';

interface EditorUIContextType {
  activeTab: TabType;
  navigateToTab: (tab: TabType) => void;
}

const EditorUIContext = createContext<EditorUIContextType | null>(null);

interface EditorUIProviderProps {
  children: ReactNode;
}

export function EditorUIProvider({ children }: EditorUIProviderProps) {
  const [activeTab, setActiveTab] = useState<TabType>('blocks');

  const navigateToTab = (tab: TabType) => {
    setActiveTab(tab);
  };

  return (
    <EditorUIContext.Provider value={{ activeTab, navigateToTab }}>
      {children}
    </EditorUIContext.Provider>
  );
}

export function useEditorUI(): EditorUIContextType {
  const context = useContext(EditorUIContext);
  if (!context) {
    throw new Error('useEditorUI must be used within an EditorUIProvider');
  }
  return context;
}