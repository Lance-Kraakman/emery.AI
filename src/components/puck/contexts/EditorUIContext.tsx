"use client";

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { usePuck } from '@measured/puck';

type TabType = 'blocks' | 'fields' | 'outline';

interface EditorUIContextType {
  activeTab: TabType;
  navigateToTab: (tab: TabType) => void;
  expandCategory: (category: string) => void;
}

const EditorUIContext = createContext<EditorUIContextType | null>(null);

interface EditorUIProviderProps {
  children: ReactNode;
}

export function EditorUIProvider({ children }: EditorUIProviderProps) {
  const [activeTab, setActiveTab] = useState<TabType>('blocks');
  const { dispatch, appState } = usePuck();

  const navigateToTab = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const expandCategory = useCallback((category: string) => {
    // Get existing componentList and merge with our change to preserve all categories
    const existingComponentList = appState.ui.componentList || {};

    dispatch({
      type: "setUi",
      ui: {
        componentList: {
          ...existingComponentList,
          [category]: {
            ...existingComponentList[category],
            expanded: true
          }
        }
      }
    });
  }, [dispatch, appState.ui.componentList]);

  return (
    <EditorUIContext.Provider value={{ activeTab, navigateToTab, expandCategory }}>
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