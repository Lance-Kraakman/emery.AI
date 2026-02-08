/**
 * Org Chart Hooks
 *
 * Composed hook that provides all org chart functionality.
 * Combines state, sync, history, selection, and persistence.
 */

import { useCallback } from 'react';
import type { XYPosition } from '@xyflow/react';
import type {
  OrgChartNode,
  OrgChartEdge,
  OrgChartNodeData,
  OrgChartNodeType,
  OrgChartCanvasMetadata,
} from '../types';
import { useOrgChartState } from './useOrgChartState';
import { useOrgChartSync } from './useOrgChartSync';
import { useOrgChartHistory } from './useOrgChartHistory';
import { useOrgChartSelection } from './useOrgChartSelection';
import { useOrgChartPersistence } from './useOrgChartPersistence';
import type { Agent, Skill, Database } from '../utils';

// Re-export individual hooks for direct use if needed
export { useOrgChartState } from './useOrgChartState';
export { useOrgChartSync } from './useOrgChartSync';
export { useOrgChartHistory } from './useOrgChartHistory';
export { useOrgChartSelection } from './useOrgChartSelection';
export { useOrgChartPersistence } from './useOrgChartPersistence';
export { useOrgChartSession } from './useOrgChartSession';
export { useOrgChartExport, buildOrgSectionTemplate, buildSkillTemplate, buildDatabaseTemplate } from './useOrgChartExport';
export type { ExportableEntity, ExportPreview, UseOrgChartExportReturn } from './useOrgChartExport';

export interface UseOrgChartProps {
  agents: Agent[];
  skills: Skill[];
  databases: Database[];
  canvasMetadata?: OrgChartCanvasMetadata;
  onSelect?: (nodeId: string | null, nodeType?: OrgChartNodeType) => void;
}

export interface UseOrgChartReturn {
  // State
  nodes: OrgChartNode[];
  edges: OrgChartEdge[];
  setNodes: React.Dispatch<React.SetStateAction<OrgChartNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<OrgChartEdge[]>>;
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;

  // Selection
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedNodeIds: Set<string>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectAll: () => void;
  clearSelection: () => void;

  // Node operations
  updateNode: (id: string, data: Partial<OrgChartNodeData>) => void;
  deleteNode: (id: string) => void;
  deleteNodes: (ids: Set<string>) => void;
  addStickyNote: (position: XYPosition) => void;
  toggleAgentExpanded: (nodeId: string) => void;

  // Entity node creation (called after server creates entity)
  addAgentNode: (agent: Agent, position: XYPosition) => void;
  addSkillNode: (skill: Skill, position: XYPosition) => void;
  addDatabaseNode: (database: Database, position: XYPosition) => void;

  // History operations
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useOrgChart(props: UseOrgChartProps): UseOrgChartReturn {
  // Core state management
  const state = useOrgChartState();

  // Selection management
  const selection = useOrgChartSelection(state.nodes, props.onSelect);

  // History management (needs selection for clearing on undo/redo)
  const history = useOrgChartHistory(
    state.nodes,
    state.edges,
    state.setNodes,
    state.setEdges,
    selection.setSelectedNodeIds
  );

  // Sync from props with pending positions
  const sync = useOrgChartSync(
    {
      agents: props.agents,
      skills: props.skills,
      databases: props.databases,
      canvasMetadata: props.canvasMetadata,
    },
    state.setNodes,
    state.setEdges
  );

  // Auto-save persistence - pass nodes and edges so changes trigger saves
  useOrgChartPersistence(state.nodes, state.edges, sync.isInitialized);

  // Wrap operations to include history push
  const deleteNode = useCallback(
    (id: string) => {
      state.deleteNode(id, history.pushHistory);
    },
    [state, history.pushHistory]
  );

  const deleteNodes = useCallback(
    (ids: Set<string>) => {
      state.deleteNodes(ids, history.pushHistory);
      selection.clearSelection();
    },
    [state, history.pushHistory, selection]
  );

  const addStickyNote = useCallback(
    (position: XYPosition) => {
      const id = state.addStickyNote(position, history.pushHistory);
      selection.setSelectedNodeIds(new Set([id]));
    },
    [state, history.pushHistory, selection]
  );

  const toggleAgentExpanded = useCallback(
    (nodeId: string) => {
      state.toggleAgentExpanded(nodeId, history.pushHistory);
    },
    [state, history.pushHistory]
  );

  return {
    // State
    nodes: state.nodes,
    edges: state.edges,
    setNodes: state.setNodes,
    setEdges: state.setEdges,
    onNodesChange: state.onNodesChange,
    onEdgesChange: state.onEdgesChange,

    // Selection
    selectedNodeId: selection.selectedNodeId,
    setSelectedNodeId: selection.setSelectedNodeId,
    selectedNodeIds: selection.selectedNodeIds,
    setSelectedNodeIds: selection.setSelectedNodeIds,
    selectAll: selection.selectAll,
    clearSelection: selection.clearSelection,

    // Node operations
    updateNode: state.updateNode,
    deleteNode,
    deleteNodes,
    addStickyNote,
    toggleAgentExpanded,

    // Entity node creation
    addAgentNode: sync.addAgentNode,
    addSkillNode: sync.addSkillNode,
    addDatabaseNode: sync.addDatabaseNode,

    // History operations
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  };
}

// Default export for backwards compatibility
export default useOrgChart;
