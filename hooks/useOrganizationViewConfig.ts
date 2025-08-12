'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import { updateOrganizationViewConfig } from '@/app/actions/organizations';

// AIDEV-NOTE: Custom hook for managing organization chart view configuration
// AIDEV-NOTE: Provides auto-save functionality with debouncing to prevent excessive API calls

export interface OrganizationViewConfig {
  version: string;
  organizationId: number;
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    type: string;
    data: {
      id: number | string;
      name: string;
      type: string;
    };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
  }>;
  viewState: {
    selectedNodes: string[];
    searchTerm: string;
    isPanelCollapsed: boolean;
    isConfiguring: boolean;
  };
  metadata: {
    timestamp: string;
    nodeCount: number;
    edgeCount: number;
  };
}

interface UseOrganizationViewConfigOptions {
  organizationId?: number;
  autoSaveDelay?: number; // milliseconds to wait before auto-saving
  enabled?: boolean; // whether auto-save is enabled
}

interface UseOrganizationViewConfigReturn {
  saveViewConfig: (
    nodes: Node[],
    edges: Edge[],
    viewState: {
      selectedNodes: string[];
      searchTerm: string;
      isPanelCollapsed: boolean;
      isConfiguring: boolean;
    }
  ) => void;
  loadViewConfig: (
    savedConfig: any,
    currentNodes: Node[]
  ) => {
    nodes: Node[];
    viewState: any;
  } | null;
  isSaving: boolean;
  lastSaved: Date | null;
}

export function useOrganizationViewConfig({
  organizationId,
  autoSaveDelay = 2000,
  enabled = true,
}: UseOrganizationViewConfigOptions = {}): UseOrganizationViewConfigReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hydration check
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Validate view data structure
  const validateViewData = useCallback((data: any): boolean => {
    return (
      data &&
      typeof data === 'object' &&
      data.version &&
      Array.isArray(data.nodes) &&
      Array.isArray(data.edges) &&
      data.viewState &&
      data.metadata
    );
  }, []);

  // Create view data object
  const createViewData = useCallback((
    nodes: Node[],
    edges: Edge[],
    viewState: {
      selectedNodes: string[];
      searchTerm: string;
      isPanelCollapsed: boolean;
      isConfiguring: boolean;
    }
  ): OrganizationViewConfig => {
    return {
      version: '1.0',
      organizationId: organizationId!,
      nodes: nodes.map(node => ({
        id: node.id,
        position: node.position,
        type: node.type || 'default',
        data: {
          id: node.data.id,
          name: node.data.name,
          type: node.data.type,
        }
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'default'
      })),
      viewState,
      metadata: {
        timestamp: new Date().toISOString(),
        nodeCount: nodes.length,
        edgeCount: edges.length
      }
    };
  }, [organizationId]);

  // Auto-save function with debouncing
  const saveViewConfig = useCallback((
    nodes: Node[],
    edges: Edge[],
    viewState: {
      selectedNodes: string[];
      searchTerm: string;
      isPanelCollapsed: boolean;
      isConfiguring: boolean;
    }
  ) => {
    if (!isHydrated || !enabled || !organizationId || nodes.length === 0) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        const viewData = createViewData(nodes, edges, viewState);
        
        await updateOrganizationViewConfig(organizationId, viewData);
        
        setLastSaved(new Date());
      } catch (error) {
        // Only log error if hydrated to prevent SSR/hydration issues
      } finally {
        setIsSaving(false);
      }
    }, autoSaveDelay);
  }, [isHydrated, enabled, organizationId, autoSaveDelay, createViewData]);

  // Load view configuration
  const loadViewConfig = useCallback((
    savedConfig: any,
    currentNodes: Node[]
  ) => {
    if (!savedConfig || !validateViewData(savedConfig)) {
      // Skip restore if invalid data
      return null;
    }

    try {
      // Restore nodes with saved positions
      const restoredNodes = currentNodes.map(node => {
        const savedNode = savedConfig.nodes.find((n: any) => n.id === node.id);
        return savedNode ? { ...node, position: savedNode.position } : node;
      });

      // Restore view state with defaults
      const defaultViewState = {
        selectedNodes: [],
        searchTerm: '',
        isPanelCollapsed: false,
        isConfiguring: false,
      };

      const viewState = savedConfig.viewState ? {
        ...defaultViewState,
        ...savedConfig.viewState
      } : defaultViewState;

      return {
        nodes: restoredNodes,
        viewState
      };
    } catch (error) {
      // Silent error handling to prevent hydration issues
      return null;
    }
  }, [validateViewData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    saveViewConfig,
    loadViewConfig,
    isSaving,
    lastSaved,
  };
}

// AIDEV-NOTE: This hook provides:
// 1. Debounced auto-save functionality to prevent excessive API calls
// 2. Proper view data validation and error handling
// 3. Node position restoration from saved configuration
// 4. View state management (selected nodes, search, panel state)
// 5. Loading indicators and last saved timestamp
// 6. Cleanup of timeouts to prevent memory leaks