/**
 * Workflow Canvas Types
 *
 * Types for the React Flow-based DAG workflow editor.
 * Maps between React Flow nodes/edges and SkillStep[] data.
 */

import type { Node, Edge, XYPosition, NodeChange, EdgeChange } from '@xyflow/react';
import type {
  SkillStep,
  InputDefinition,
  OutputDefinition,
  ErrorConfig,
  RetryConfig,
  LoopConfig,
  TaskModelConfig,
  ToolExecutionConfig,
  WriteConfig,
  ReadConfig,
  ToolConfig,
  WorkflowNodeType,
  StoredPlan,
} from '@/ddd/domain/skills/entities/skill';

// =============================================================================
// Node Types - Re-exported from domain for canvas usage
// =============================================================================

export type { WorkflowNodeType };

/**
 * Extended canvas node types (includes annotation and virtual nodes)
 * Sticky notes and skill I/O nodes are canvas-only and don't become SkillSteps
 */
export type CanvasNodeType = WorkflowNodeType | 'sticky' | 'skillInput' | 'skillOutput';

/**
 * Base data shared by all node types.
 * Index signature required for React Flow Node<T> compatibility.
 */
interface BaseNodeData {
  [key: string]: unknown;
  name: string;
  inputDefs?: InputDefinition[];
  outputDefs?: OutputDefinition[];
  errorConfig?: ErrorConfig;
  retryConfig?: RetryConfig;
  parallelGroup?: string;
  /** If true, node is disabled and will be skipped during execution */
  isDisabled?: boolean;
}

/**
 * Skill reference node - delegates to another skill
 */
export interface SkillRefNodeData extends BaseNodeData {
  skillId: number;
  skillName?: string; // Display name (optional, for UI)
  skillType?: string; // execution type of referenced skill
}

/**
 * Condition node - branching based on expressions
 */
export interface ConditionNodeData extends BaseNodeData {
  conditions: Array<{
    expression: string;
    label?: string;
  }>;
}

/**
 * Loop node - iteration support
 */
export interface LoopNodeData extends BaseNodeData {
  loopConfig: LoopConfig;
  // The instruction to execute each iteration
  instruction?: string;
  skillId?: number;
}

// =============================================================================
// New Unified Node Types (former skill execution types)
// =============================================================================

/**
 * Agentic node - LLM with instructions and tool access
 * Replaces the 'agentic' skill type
 */
export interface AgenticNodeData extends BaseNodeData {
  instructions: string;
  tools: ToolConfig[];
  agentType?: 'tool_calling' | 'code_agent';
  model?: string | null;
  attachments?: Array<{
    url: string;
    filename: string;
    type: 'image' | 'file';
    size?: number;
    s3Key?: string;
  }>;
  /** Stored plan for autonomous execution */
  plan?: StoredPlan;
}

/**
 * Operation node - Direct model invocation (HuggingFace)
 * Replaces the 'operation' skill type
 */
export interface OperationNodeData extends BaseNodeData {
  taskModelConfig?: TaskModelConfig;
  promptTemplate?: string;
}

/**
 * Tool node - Direct Pipedream tool execution
 * Replaces the 'tool' skill type
 */
export interface ToolNodeData extends BaseNodeData {
  toolExecutionConfig?: ToolExecutionConfig;
  /** Discovered outputs from connected table (populated by UI after test run) */
  discoveredOutputs?: Array<{
    name: string;
    type: string;
    tableName?: string;
  }>;
}

/**
 * Write node - Direct database write
 * Replaces the 'write' skill type
 */
export interface WriteNodeData extends BaseNodeData {
  writeConfig?: WriteConfig;
}

/**
 * Read node - Database read (single-row or query)
 */
export interface ReadNodeData extends BaseNodeData {
  readConfig?: ReadConfig;
}

/**
 * Sticky note - Canvas annotation (not a workflow step)
 */
export interface StickyNodeData {
  [key: string]: unknown;
  content: string;
  color?: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
  textSize?: 'sm' | 'md' | 'lg';
}

/**
 * Skill Input node - Virtual node showing skill inputs (not a workflow step)
 * Positioned at the left side of the canvas to show data flow into the skill
 */
export interface SkillInputNodeData {
  [key: string]: unknown;
  inputs: InputDefinition[];
  /** Marks as non-executable virtual node */
  isVirtual: true;
}

/**
 * Skill Output node - Virtual node showing skill outputs (not a workflow step)
 * Positioned at the right side of the canvas to show data flow out of the skill
 */
export interface SkillOutputNodeData {
  [key: string]: unknown;
  outputs: OutputDefinition[];
  /** Marks as non-executable virtual node */
  isVirtual: true;
}

/**
 * Union type for all workflow node data (excludes sticky notes)
 */
export type WorkflowNodeData =
  | SkillRefNodeData
  | ConditionNodeData
  | LoopNodeData
  | AgenticNodeData
  | OperationNodeData
  | ToolNodeData
  | WriteNodeData
  | ReadNodeData;

/**
 * Union type for all canvas node data (includes sticky notes and virtual I/O nodes)
 */
export type CanvasNodeData = WorkflowNodeData | StickyNodeData | SkillInputNodeData | SkillOutputNodeData;

/**
 * Workflow node with typed data (includes sticky notes)
 */
export type WorkflowNode = Node<CanvasNodeData, CanvasNodeType>;

// =============================================================================
// Edge Types
// =============================================================================

export type WorkflowEdgeType = 'success' | 'error' | 'condition' | 'default';

/**
 * Edge data with index signature for React Flow Edge<T> compatibility.
 */
export interface WorkflowEdgeData {
  [key: string]: unknown;
  label?: string;
  condition?: string; // For condition edges
}

export type WorkflowEdge = Edge<WorkflowEdgeData>;

// =============================================================================
// Component Props
// =============================================================================

export interface AvailableSkill {
  id: number;
  name: string;
  executionType?: string;
}

export interface WorkflowCanvasProps {
  steps: SkillStep[];
  onChange: (steps: SkillStep[]) => void;
  skillInputs: InputDefinition[];
  skillOutputs: OutputDefinition[];
  availableSkills?: AvailableSkill[];
  disabled?: boolean;
}

export interface NodePaletteProps {
  disabled?: boolean;
}

export interface NodeConfigPanelProps {
  nodeId: string | null;
  nodes: WorkflowNode[];
  onUpdateNode: (id: string, data: Partial<WorkflowNodeData>) => void;
  skillInputs: InputDefinition[];
  availableSkills: AvailableSkill[];
  disabled?: boolean;
}

// =============================================================================
// Hook Types
// =============================================================================

export interface UseWorkflowCanvasReturn {
  // State
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<WorkflowEdge[]>>;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;

  // Single selection (backwards compatible)
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Multi-selection
  selectedNodeIds: Set<string>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectAll: () => void;
  clearSelection: () => void;

  // Node operations
  addNode: (type: WorkflowNodeType, position: XYPosition) => void;
  addStickyNote: (position: XYPosition) => void;
  updateNode: (id: string, data: Partial<WorkflowNodeData>) => void;
  renameNode: (id: string, newName: string) => void;
  deleteNode: (id: string) => void;
  deleteNodes: (ids: Set<string>) => void;

  // Clipboard operations
  copyNodes: () => number | undefined;
  pasteNodes: (position?: XYPosition) => void;
  duplicateNodes: () => void;

  // History operations
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Other operations
  toggleDisabled: () => void;
  updateMousePosition: (pos: XYPosition) => void;
}

// Note: SkillStep now includes _position directly in domain types

// =============================================================================
// Canvas Metadata (persisted to DB, separate from execution steps)
// =============================================================================

/**
 * Persisted sticky note data for canvas_metadata column
 */
export interface PersistedStickyNote {
  id: string;
  content: string; // TipTap HTML content
  color?: StickyNodeData['color'];
  position: { x: number; y: number };
  size?: { width: number; height: number };
}

/**
 * Canvas metadata stored in DB - annotations and visual elements
 * that don't affect workflow execution
 */
export interface CanvasMetadata {
  stickyNotes?: PersistedStickyNote[];
}
