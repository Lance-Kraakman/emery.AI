/**
 * useOrgChartSession Hook
 *
 * Manages transient org chart state via sessionStorage for quick restore
 * after navigation. State is persisted immediately on change.
 *
 * This is separate from useOrgChartPersistence which saves to the database.
 * Session state provides faster restore for navigation within a session.
 */

import { useCallback, useState } from 'react';
import type { OrgChartSessionState } from '../types';

const SESSION_KEY = 'orgChart:sessionState';

/**
 * Get session state from sessionStorage
 */
function getSessionState(): OrgChartSessionState | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Save session state to sessionStorage
 */
function saveSessionState(state: OrgChartSessionState): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('[OrgChart] Failed to save session state:', error);
  }
}

export interface UseOrgChartSessionOptions {
  /** Initial selected node from URL param (takes precedence) */
  initialSelectedNodeId?: string | null;
  /** Initial viewport from saved metadata */
  initialViewport?: { x: number; y: number; zoom: number };
}

export interface UseOrgChartSessionReturn {
  /** Current selected node ID (from session or URL) */
  selectedNodeId: string | null;
  /** Update selected node and persist to session */
  setSelectedNodeId: (nodeId: string | null) => void;
  /** Current viewport state */
  viewport: { x: number; y: number; zoom: number } | null;
  /** Update viewport and persist to session */
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  /** Whether session state has been restored */
  isRestored: boolean;
}

/**
 * Get initial state synchronously (for useState initializer)
 * This ensures session state is available on first render
 */
function getInitialState(
  initialSelectedNodeId?: string | null,
  initialViewport?: { x: number; y: number; zoom: number }
): {
  selectedNodeId: string | null;
  viewport: { x: number; y: number; zoom: number } | null;
} {
  const sessionState = getSessionState();

  // URL param takes precedence over session state for selected node
  const selectedNodeId = initialSelectedNodeId ?? sessionState?.selectedNodeId ?? null;

  // Session viewport takes precedence over DB metadata for quicker restore
  const viewport = sessionState?.viewport ?? initialViewport ?? null;

  return { selectedNodeId, viewport };
}

/**
 * Hook for managing org chart session state
 */
export function useOrgChartSession({
  initialSelectedNodeId,
  initialViewport,
}: UseOrgChartSessionOptions = {}): UseOrgChartSessionReturn {
  // Read session state synchronously on first render
  const [initialState] = useState(() =>
    getInitialState(initialSelectedNodeId, initialViewport)
  );

  const [selectedNodeId, setSelectedNodeIdState] = useState<string | null>(
    initialState.selectedNodeId
  );
  const [viewport, setViewportState] = useState<{
    x: number;
    y: number;
    zoom: number;
  } | null>(initialState.viewport);

  // isRestored is always true since we read synchronously now
  const isRestored = true;

  // Update selected node and persist
  const setSelectedNodeId = useCallback((nodeId: string | null) => {
    setSelectedNodeIdState(nodeId);

    // Persist to session
    const current = getSessionState() || {};
    saveSessionState({
      ...current,
      selectedNodeId: nodeId,
    });
  }, []);

  // Update viewport and persist
  const setViewport = useCallback(
    (newViewport: { x: number; y: number; zoom: number }) => {
      setViewportState(newViewport);

      // Persist to session
      const current = getSessionState() || {};
      saveSessionState({
        ...current,
        viewport: newViewport,
      });
    },
    []
  );

  return {
    selectedNodeId,
    setSelectedNodeId,
    viewport,
    setViewport,
    isRestored,
  };
}
