'use client';

/**
 * OrgChartDragContext
 *
 * Provides drag state information to org chart nodes for visual feedback.
 * Tracks what type of entity is being dragged from the palette.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { OrgChartNodeType } from '../types';

interface OrgChartDragContextValue {
  /** The type of entity currently being dragged, or null if not dragging */
  dragType: OrgChartNodeType | null;
  /** Set when drag starts from palette */
  setDragType: (type: OrgChartNodeType | null) => void;
  /** Whether any drag is active */
  isDragging: boolean;
}

const OrgChartDragContext = createContext<OrgChartDragContextValue | null>(null);

interface OrgChartDragProviderProps {
  children: ReactNode;
}

export function OrgChartDragProvider({ children }: OrgChartDragProviderProps) {
  const [dragType, setDragTypeState] = useState<OrgChartNodeType | null>(null);

  const setDragType = useCallback((type: OrgChartNodeType | null) => {
    setDragTypeState(type);
  }, []);

  return (
    <OrgChartDragContext.Provider
      value={{
        dragType,
        setDragType,
        isDragging: dragType !== null,
      }}
    >
      {children}
    </OrgChartDragContext.Provider>
  );
}

export function useOrgChartDrag() {
  const context = useContext(OrgChartDragContext);
  if (!context) {
    throw new Error('useOrgChartDrag must be used within OrgChartDragProvider');
  }
  return context;
}

/**
 * Safe version that returns null values if used outside provider.
 * Useful for nodes that may be rendered in different contexts.
 */
export function useOrgChartDragSafe(): OrgChartDragContextValue {
  const context = useContext(OrgChartDragContext);
  return context ?? { dragType: null, setDragType: () => {}, isDragging: false };
}
