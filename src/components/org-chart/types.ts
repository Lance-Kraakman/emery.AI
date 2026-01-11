/**
 * Org Chart Canvas Types
 *
 * Types for the React Flow-based organization chart editor.
 * Displays hierarchical org structure with agents as containers.
 */

import type { Node, Edge, XYPosition, NodeChange, EdgeChange } from '@xyflow/react';

// =============================================================================
// Node Types
// =============================================================================

/**
 * Types of nodes in the org chart
 * - agent: Container node for agent resources
 * - skill: Skill belonging to agent or org
 * - database: Database belonging to agent or org
 * - sticky: Annotation (same as workflow-canvas)
 * - org_resources: Section header for org-level resources
 */
export type OrgChartNodeType =
  | 'agent'
  | 'skill'
  | 'database'
  | 'sticky'
  | 'org_resources';

// =============================================================================
// Node Data Types
// =============================================================================

/**
 * Base data shared by all org chart nodes
 */
interface BaseOrgChartNodeData {
  [key: string]: unknown;
  name: string;
  description?: string;
}

/**
 * Agent container node data
 */
export interface AgentContainerNodeData extends BaseOrgChartNodeData {
  agentId: number;
  role?: string;
  status?: string;
  avatar?: string;
  /** Counts for collapsed view */
  skillCount?: number;
  databaseCount?: number;
  automationCount?: number;
  /** Whether the container is expanded */
  isExpanded?: boolean;
}

/**
 * Skill node data
 */
export interface SkillNodeData extends BaseOrgChartNodeData {
  skillId: number;
  executionType?: string;
  agentId?: number | null; // null = org-scoped
  /** Whether skill is currently active */
  isActive?: boolean;
}

/**
 * Database node data
 */
export interface DatabaseNodeData extends BaseOrgChartNodeData {
  databaseId: number;
  slug: string;
  agentId?: number | null; // null = org-scoped
  tableCount?: number;
  /** First few tables for inline display in node */
  tables?: Array<{ id: number; name: string }>;
}

/**
 * Sticky note data (same as workflow-canvas)
 * Content is TipTap HTML (users can format first line as heading for title)
 */
export interface StickyNoteData {
  [key: string]: unknown;
  content: string; // TipTap HTML content
  color?: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
}

/**
 * Org resources section header data
 */
export interface OrgResourcesNodeData extends BaseOrgChartNodeData {
  resourceType: 'skills' | 'databases' | 'apps' | 'all';
}

/**
 * Union type for all org chart node data
 */
export type OrgChartNodeData =
  | AgentContainerNodeData
  | SkillNodeData
  | DatabaseNodeData
  | StickyNoteData
  | OrgResourcesNodeData;

/**
 * Org chart node with typed data
 */
export type OrgChartNode = Node<OrgChartNodeData, OrgChartNodeType>;

// =============================================================================
// Edge Types
// =============================================================================

/**
 * Types of edges in the org chart
 * - containment: Parent-child relationship (implicit via parentId)
 * - automation_skill: Automation triggers skill
 * - skill_ref: Skill references another skill
 * - skill_table: Skill reads/writes table
 */
export type OrgChartEdgeType =
  | 'containment'
  | 'automation_skill'
  | 'skill_ref'
  | 'skill_table';

/**
 * Edge data
 */
export interface OrgChartEdgeData {
  [key: string]: unknown;
  label?: string;
  edgeType: OrgChartEdgeType;
}

export type OrgChartEdge = Edge<OrgChartEdgeData>;

// =============================================================================
// Component Props
// =============================================================================

/**
 * Minimal step data needed for edge extraction
 */
export interface SkillStepEdgeData {
  id: string;
  skillId?: number; // For skill_ref edges
  readConfig?: { sourceTableId?: number };
  writeConfig?: { targetTableId?: number };
}

export interface OrgChartCanvasProps {
  /** Initial agents to display */
  agents: Array<{
    id: number;
    name: string;
    role?: string;
    status?: string;
  }>;
  /** Initial skills */
  skills: Array<{
    id: number;
    name: string;
    executionType?: string;
    agentId?: number | null;
    steps?: SkillStepEdgeData[];
  }>;
  /** Initial databases */
  databases: Array<{
    id: number;
    name: string;
    slug: string;
    agentId?: number | null;
    tableCount?: number;
    tables?: Array<{ id: number; name: string; slug?: string }>;
  }>;
  /** Whether the canvas is read-only */
  disabled?: boolean;
  /** Callback when an entity is selected */
  onSelect?: (nodeId: string | null, nodeType?: OrgChartNodeType) => void;
  /** Callback when an entity should be opened (e.g., navigate to skill editor) */
  onOpenEntity?: (entityType: OrgChartNodeType, entityId: number) => void;
}

export interface OrgChartConfigPanelProps {
  nodeId: string | null;
  nodes: OrgChartNode[];
  onUpdateNode: (id: string, data: Partial<OrgChartNodeData>) => void;
  disabled?: boolean;
}

// =============================================================================
// Hook Types
// =============================================================================

export interface UseOrgChartCanvasReturn {
  // State
  nodes: OrgChartNode[];
  edges: OrgChartEdge[];
  setNodes: React.Dispatch<React.SetStateAction<OrgChartNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<OrgChartEdge[]>>;
  onNodesChange: (changes: NodeChange<OrgChartNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<OrgChartEdge>[]) => void;

  // Selection
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedNodeIds: Set<string>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectAll: () => void;
  clearSelection: () => void;

  // Node operations
  addAgent: (position: XYPosition) => Promise<string>;
  addSkill: (position: XYPosition, agentId?: number | null) => Promise<string>;
  addDatabase: (position: XYPosition, agentId?: number | null) => Promise<string>;
  addStickyNote: (position: XYPosition) => void;
  updateNode: (id: string, data: Partial<OrgChartNodeData>) => void;
  deleteNode: (id: string) => void;
  deleteNodes: (ids: Set<string>) => void;

  // Container operations
  toggleAgentExpanded: (nodeId: string) => void;

  // Clipboard operations
  copyNodes: () => number | undefined;
  pasteNodes: (position?: XYPosition) => void;

  // History operations
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// =============================================================================
// Persisted Metadata
// =============================================================================

/**
 * Persisted sticky note for org chart
 */
export interface PersistedOrgChartStickyNote {
  id: string;
  content: string; // TipTap HTML content
  color?: StickyNoteData['color'];
  position: { x: number; y: number };
  size?: { width: number; height: number };
}

/**
 * Persisted edge for org chart
 */
export interface PersistedOrgChartEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  edgeType: OrgChartEdgeType;
  label?: string;
}

/**
 * Canvas metadata stored in organization settings
 */
export interface OrgChartCanvasMetadata {
  stickyNotes?: PersistedOrgChartStickyNote[];
  /** Agent positions (keyed by agentId) */
  agentPositions?: Record<number, { x: number; y: number }>;
  /** Agent expanded states */
  agentExpandedStates?: Record<number, boolean>;
  /** Agent container dimensions (keyed by agentId) */
  agentDimensions?: Record<number, { width: number; height: number }>;
  /** Skill positions (keyed by skillId) - relative to parent if inside agent */
  skillPositions?: Record<number, { x: number; y: number }>;
  /** Database positions (keyed by databaseId) - relative to parent if inside agent */
  databasePositions?: Record<number, { x: number; y: number }>;
  /** Viewport state (zoom and pan) */
  viewport?: { x: number; y: number; zoom: number };
  /** Manual edges (connections between skills and databases) */
  edges?: PersistedOrgChartEdge[];
}

/**
 * Session state for quick restore (stored in sessionStorage)
 * Includes transient state that doesn't need permanent persistence
 */
export interface OrgChartSessionState {
  /** Currently selected node ID */
  selectedNodeId?: string | null;
  /** Viewport state (zoom and pan) - cached for quick restore */
  viewport?: { x: number; y: number; zoom: number };
}
