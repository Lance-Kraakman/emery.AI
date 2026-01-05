/**
 * Workflow Canvas Types
 *
 * Types for the React Flow-based DAG workflow editor.
 * Maps between React Flow nodes/edges and SkillStep[] data.
 */

import type { Node, Edge, XYPosition } from '@xyflow/react';
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
} from '@/ddd/domain/skills/entities/skill';

// =============================================================================
// Node Types - Re-exported from domain for canvas usage
// =============================================================================

export type { WorkflowNodeType };

/**
 * Base data shared by all node types
 * Uses index signature for React Flow compatibility
 */
interface BaseNodeData {
  [key: string]: unknown;
  name: string;
  inputDefs?: InputDefinition[];
  outputDefs?: OutputDefinition[];
  errorConfig?: ErrorConfig;
  retryConfig?: RetryConfig;
  parallelGroup?: string;
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
 * Union type for all node data
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
 * Workflow node with typed data
 */
export type WorkflowNode = Node<WorkflowNodeData, WorkflowNodeType>;

// =============================================================================
// Edge Types
// =============================================================================

export type WorkflowEdgeType = 'success' | 'error' | 'condition' | 'default';

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
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<WorkflowEdge[]>>;
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  addNode: (type: WorkflowNodeType, position: XYPosition) => void;
  updateNode: (id: string, data: Partial<WorkflowNodeData>) => void;
  deleteNode: (id: string) => void;
}

// Note: SkillStep now includes _position directly in domain types
