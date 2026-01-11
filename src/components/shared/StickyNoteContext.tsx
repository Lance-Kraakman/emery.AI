'use client';

/**
 * StickyNoteContext
 *
 * Shared context for sticky note inline editing.
 * Used by both workflow-canvas and org-chart canvases.
 */

import React, { createContext, useContext } from 'react';

interface StickyNoteUpdate {
  content?: string;
  color?: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
  textSize?: 'sm' | 'md' | 'lg';
}

interface StickyNoteContextValue {
  updateNote: (id: string, data: StickyNoteUpdate) => void;
}

const StickyNoteContext = createContext<StickyNoteContextValue | null>(null);

export function StickyNoteProvider({
  children,
  updateNote,
}: {
  children: React.ReactNode;
  updateNote: (id: string, data: StickyNoteUpdate) => void;
}) {
  return (
    <StickyNoteContext.Provider value={{ updateNote }}>
      {children}
    </StickyNoteContext.Provider>
  );
}

/**
 * Hook to access sticky note update function.
 * Returns null if not within a StickyNoteProvider (editing disabled).
 */
export function useStickyNoteContext() {
  return useContext(StickyNoteContext);
}
