'use client';

/**
 * StickyNoteContext
 *
 * Shared context for sticky note inline editing.
 * Used by both workflow-canvas and org-chart canvases.
 */

import React, { createContext, useContext } from 'react';

interface StickyNoteContextValue {
  updateNote: (id: string, data: { name?: string; content?: string }) => void;
}

const StickyNoteContext = createContext<StickyNoteContextValue | null>(null);

export function StickyNoteProvider({
  children,
  updateNote,
}: {
  children: React.ReactNode;
  updateNote: (id: string, data: { name?: string; content?: string }) => void;
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
