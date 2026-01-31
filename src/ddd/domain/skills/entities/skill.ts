import { SkillId } from '../value-objects/skill-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { OrganizationId } from '@/ddd/domain/shared/value-objects/organization-id';
import { MessagePart } from '@/ddd/infrastructure/grpc/generated/agent_worker';

/**
 * Skill Execution Types (legacy - being replaced by unified canvas)
 * @deprecated Use WorkflowNodeType for new code
 */
export type SkillExecutionType = 'agentic' | 'agent' | 'operation' | 'tool' | 'write';

/**
 * Workflow Node Types
 * Used in the unified workflow canvas - all skills are now workflows with typed steps.
 *
 * Execution nodes:
 * - 'agentic': LLM with tools and instructions
 * - 'operation': Direct model call (HuggingFace)
 * - 'tool': Direct Pipedream tool execution
 * - 'write': Direct database write
 * - 'read': Direct database read
 *
 * Flow control nodes:
 * - 'skillRef': Reference to another skill
 * - 'condition': Conditional branching
 * - 'loop': Iteration (for-each, while, until)
 */
export type WorkflowNodeType =
  | 'skillRef'
  | 'condition'
  | 'loop'
  | 'agentic'
  | 'operation'
  | 'tool'
  | 'write'
  | 'read';

// =============================================================================
// DAG Execution Configuration Types
// =============================================================================

/**
 * Error handling configuration for a step
 * Enables continue-on-error and error variable storage
 */
export interface ErrorConfig {
  continueOnError: boolean;              // Continue execution even if step fails
  errorOutputVar?: string;               // Variable name to store error details (e.g., "__error__")
}

/**
 * Retry configuration for error recovery
 * Uses tenacity-style exponential backoff
 */
export interface RetryConfig {
  maxAttempts: number;                   // Max retry attempts (default: 3)
  backoffMs: number;                     // Initial backoff in milliseconds (default: 1000)
  backoffType: 'fixed' | 'exponential' | 'linear';  // Backoff strategy
}

/**
 * Step output routing - determines which steps to execute based on outcome
 * Enables n8n-style branching: success path, error path, conditional paths
 */
export interface StepOutput {
  type: 'success' | 'error' | 'condition' | 'default';  // Output type
  condition?: string;                    // For type="condition": expression like "{{result}} > 100"
  label?: string;                        // Display label for condition edges (full text, not truncated)
  nextSteps: string[];                   // Step names to execute for this output
}

/**
 * Loop configuration for iteration support
 * Enables for-each over arrays and while/until conditional loops
 */
export interface LoopConfig {
  type: 'for_each' | 'while' | 'until';  // Loop type
  itemsVar?: string;                     // For for_each: variable containing array to iterate
  currentItemVar?: string;               // Variable name to store current item (default: "item")
  condition?: string;                    // For while/until: condition expression "{{count}} < 10"
  maxIterations?: number;                // Safety limit to prevent infinite loops (default: 100)
}

// =============================================================================
// Stored Plan Types (for autonomous execution)
// =============================================================================

/**
 * Stored sub-plan from cascading planning
 * Generated when a managed agent creates detailed execution steps
 */
export interface StoredSubPlan {
  agentName: string;
  goal: string;
  steps: StoredPlanStep[];
  planningObservations?: string;
}

/**
 * Individual step within a stored plan
 * Contains execution details without runtime state (status, result, error)
 */
export interface StoredPlanStep {
  stepId: string;
  description: string;
  toolCall?: string;           // e.g., "row_crud:read", "tool_executor"
  parameters?: Record<string, any>;
  contextTables?: string[];
  targetAgent?: string;        // Managed agent for routing
  subPlan?: StoredSubPlan;     // From cascading planning
  promptTemplate?: string;     // Jinja2 template for autonomous execution ({{ variables }})
  requiredContext?: string[];  // Variables needed at runtime from skill inputs/discovery
}

/**
 * Stored execution plan for autonomous execution
 *
 * Contains the execution blueprint from a successful HITL planning session.
 * When present on an agentic node, execution skips HITL and runs autonomously.
 *
 * Matches Python Plan model structure (without runtime fields like status, result, error)
 */
export interface StoredPlan {
  id: string;
  goal: string;
  basicInstructions: string;
  context?: string;            // Discovered databases, tables
  analysis?: string;           // LLM reasoning about what to do
  steps: StoredPlanStep[];
  version: number;
  generatedAt: string;
  approvedAt?: string;
}

// =============================================================================
// Step Configuration Types
// =============================================================================

/**
 * Agentic Step Configuration
 * Used when nodeType is 'agentic' - LLM with tools (smolagents)
 */
export interface AgenticStepConfig {
  instructions: string;
  tools: ToolConfig[];
  agentType?: 'tool_calling' | 'code_agent';
  model?: string | null;
  /** Stored execution plan for autonomous execution */
  plan?: StoredPlan;
}

/**
 * Condition Step Configuration
 * Used when nodeType is 'condition' - branching based on expressions
 */
export interface ConditionStepConfig {
  expression: string;
  label?: string;
}

/**
 * Node Identity - simple type for passing node {id, name} pairs
 */
export interface NodeIdentity {
  id: string;
  name: string;
}

/**
 * Skill Step - defines a single step in a workflow
 * Each step has a nodeType determining its execution behavior.
 */
export interface SkillStep {
  // Identity
  id: string;                             // Stable UUID (for edges and references)
  name: string;                           // Display name (user-editable)
  nodeType?: WorkflowNodeType;            // Node type (defaults to 'agentic' for backwards compat)

  // Node-type specific data (only one populated per step based on nodeType)
  instruction?: string;                   // Legacy instruction field (use agenticConfig.instructions)
  skillId?: number;                       // For 'skillRef' nodes
  agenticConfig?: AgenticStepConfig;      // For 'agentic' nodes
  taskModelConfig?: TaskModelConfig;      // For 'operation' nodes
  toolExecutionConfig?: ToolExecutionConfig;  // For 'tool' nodes
  writeConfig?: WriteConfig;              // For 'write' nodes
  readConfig?: ReadConfig;                // For 'read' nodes
  conditions?: ConditionStepConfig[];     // For 'condition' nodes
  loopConfig?: LoopConfig;                // For 'loop' nodes

  // Legacy fields (for backwards compatibility)
  tools?: string[];                       // @deprecated Use agenticConfig.tools
  inputs?: Record<string, string>;        // @deprecated Context mappings
  outputs?: Record<string, string>;       // @deprecated Context mappings

  // Step-level definitions (unified types)
  inputDefs?: InputDefinition[];          // What this step accepts (schema)
  outputDefs?: OutputDefinition[];        // What this step produces (schema)

  // DAG execution configuration
  errorConfig?: ErrorConfig;              // Error handling (continue_on_error, error variable)
  retryConfig?: RetryConfig;              // Retry configuration for transient failures
  stepOutputs?: StepOutput[];             // Output paths: success, error, conditional branches
  parallelGroup?: string;                 // Steps with same group ID execute concurrently

  // UI state (persisted for convenience)
  isDisabled?: boolean;                   // Step can be disabled without deletion
  _position?: { x: number; y: number };
}

/**
 * Task Model Configuration
 * Used when executionType is 'operation' to bypass LLM orchestration
 * taskType is stored as string for flexibility - validated at execution time
 */
export interface TaskModelConfig {
  modelId: string;           // e.g., 'black-forest-labs/FLUX.1-schnell'
  taskType: string;          // e.g., 'text-to-image', 'speech-to-text' - validated at execution
  parameters?: Record<string, any>;  // Model-specific params (steps, guidance_scale, etc.)
}

// =============================================================================
// Tool Execution Configuration (for executionType: 'tool')
// =============================================================================

/**
 * Tool Input Mapping - maps skill input to tool parameter
 */
export interface ToolInputMapping {
  toolParam: string;                 // Tool parameter name
  skillInputName?: string;           // Skill input to use (if set)
  staticValue?: any;                 // Static value (used if skillInputName not set)
}

/**
 * Tool Execution Configuration
 * Used when executionType is 'tool' for direct Pipedream tool calls
 */
export interface ToolExecutionConfig {
  toolId: string;                    // e.g., 'gmail-send-email', 'slack-send-message'
  inputMappings: ToolInputMapping[]; // Map skill inputs → tool params
  outputTableId?: number;            // Connected table for outputs (schema auto-discovered)
}

// =============================================================================
// Write Execution Configuration (for executionType: 'write')
// =============================================================================

/**
 * Write Field Mapping - maps skill input to table field
 */
export interface WriteFieldMapping {
  skillInputName: string;            // Skill input name
  targetFieldId: number;             // Table field ID
}

/**
 * Update Match Configuration - for update row action
 */
export interface UpdateMatchConfig {
  skillInputName: string;            // Skill input with match value
  targetFieldId: number;             // Field to match against
}

/**
 * Write Execution Configuration
 * Used when executionType is 'write' for direct table writes
 */
export interface WriteConfig {
  targetTableId: number;
  rowAction: 'create' | 'update' | 'upsert';
  fieldMappings: WriteFieldMapping[];
  updateMatch?: UpdateMatchConfig;   // For update/upsert: which field to match
}

// =============================================================================
// Read Execution Configuration Types
// =============================================================================

/**
 * Read Execution Configuration
 * Used for 'read' node type - reads data from tables into workflow variables
 */
export interface ReadConfig {
  mode: 'single_row' | 'query';
  sourceTableId: number;

  // Single row mode - read one row by ID
  rowIdSource?: RowIdSource;

  // Query mode - read multiple rows with filters
  queryFilters?: QueryFilter[];
  queryLimit?: number;

  // Both modes - map table fields to output variables
  fieldMappings: ReadFieldMapping[];
}

/**
 * Query filter for read node query mode
 */
export interface QueryFilter {
  fieldId: number;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'is_empty' | 'is_not_empty';
  valueSource: RowIdSource;  // Reuse RowIdSource for value source (skill_input, previous_step, static)
}

/**
 * Field mapping for read node - maps table field to output variable
 */
export interface ReadFieldMapping {
  sourceFieldId: number;
  targetVariable: string;
}

/**
 * Skill Input/Output Types
 *
 * Expanded to align with database field types for better LLM guidance.
 * - Basic types: text, number, boolean, date, json
 * - Format-specific: email, phone
 * - Select types: single-select, multi-select (for constrained options)
 * - Media types: image, file, audio, video, document
 */
export type SkillParameterType =
  | 'text' | 'number' | 'boolean' | 'date' | 'json'
  | 'email' | 'phone'
  | 'single-select' | 'multi-select'
  | 'image' | 'file' | 'audio' | 'video' | 'document';

// =============================================================================
// Input Mapping Types (read from tables into skill inputs)
// =============================================================================

/**
 * Source for reading a value from a table field
 */
export interface InputFieldSource {
  tableId: number;
  fieldId: number;
  rowSource: RowIdSource;  // Reuses existing RowIdSource type
}

/**
 * Input mapping configuration - maps table field to skill input
 */
export interface InputMappingConfig {
  source: InputFieldSource;
}

// =============================================================================
// Unified Definition Types (used for skill-level AND step-level)
// =============================================================================

/**
 * Unified Input Definition
 * Used for both skill-level inputs and step-level input definitions
 */
export interface InputDefinition {
  name: string;
  required: boolean;
  type?: SkillParameterType;
  inputMapping?: InputMappingConfig;  // Optional: read from table field
}

// =============================================================================
// Multi-Table Output Mapping Types (typed references, no string parsing)
// =============================================================================

/**
 * Reference to a field from a previous table mapping result
 */
export interface TableReference {
  order: number;            // Which table mapping (1, 2, 3...)
  field: string;            // 'row_id' or field name from that table
}

/**
 * Typed field source - skill output, skill input, or reference to previous table
 * Discriminated union for type-safe source selection
 */
export type FieldSource =
  | { type: 'skill_output'; name: string }
  | { type: 'skill_input'; name: string }
  | { type: 'table_ref'; order: number; field: string };

/**
 * Source for row ID in update mode - determines which row to update
 * Discriminated union for type-safe row ID resolution
 */
export type RowIdSource =
  | { type: 'static'; staticId: string }
  | { type: 'skill_input'; skillInput: string }
  | { type: 'skill_output'; skillOutput: string }
  | { type: 'table_ref'; tableRef: TableReference }
  | { type: 'source_row' };

/**
 * Target Field Metadata - info about the destination field
 */
export interface TargetFieldMetadata {
  fieldType: string;         // Database field type: "single-select", "multi-select", "number", etc.
  fieldName?: string;        // Target field name (for display)
  options?: string[];        // For select fields: valid option values
  maxSelections?: number;    // For multi-select: maximum allowed selections
}

/**
 * Field Mapping - maps a typed source to a target table field
 */
export interface FieldMapping {
  source: FieldSource;                  // Where to get the value (typed)
  targetFieldId: number;                // Destination field/column
  targetFieldMetadata?: TargetFieldMetadata;  // Optional: target field info for LLM guidance
  appendMode?: boolean;                 // When true, append to existing relation values instead of replacing
}

/**
 * Table Mapping - ordered operation for a single table
 */
export interface TableMapping {
  order: number;                        // Execution order (1, 2, 3...)
  targetTableId: number;                // Which table to write to
  rowAction: 'create' | 'update' | 'upsert';  // Create, update, or upsert row
  rowIdSource?: RowIdSource;            // For update mode - typed source for row ID
  matchFieldIds?: number[];              // For upsert mode - target fields to match on (composite key)
  mappings: FieldMapping[];             // Field mappings for this table
  displayFieldId?: number;              // Field to use for relation display value
  mode?: 'single_row' | 'multi_row';    // Per-table mode (overrides config default)
}

/**
 * Output Mapping Configuration
 * Multi-table support with typed references
 */
export interface OutputMappingConfig {
  mode: 'single_row' | 'multi_row';
  tableMappings: TableMapping[];        // Ordered table operations
}

/**
 * Output Source - where the skill output value comes from
 * Maps a skill-level output to a node-level output
 */
export interface OutputSource {
  type: 'node_output';
  /** Node ID or name that produces this output */
  nodeId: string;
  /** Output name from the node's outputDefs */
  outputName: string;
}

/**
 * Unified Output Definition
 * Used for both skill-level outputs and step-level output definitions
 */
export interface OutputDefinition {
  name: string;
  type?: SkillParameterType;
  description?: string;  // Description of what this output contains (shown in LLM instructions)
  /** Source: where this output's value comes from (skill-level only) */
  source?: OutputSource;
  outputMapping?: OutputMappingConfig;  // Optional: write to table fields
}

/**
 * Tool Configuration
 */
export interface ToolConfig {
  name: string;
  config?: Record<string, any>;
}

/**
 * Canvas Metadata - visual annotations that don't affect execution
 * Stored separately from steps to avoid polluting the execution graph
 */
export interface CanvasMetadata {
  stickyNotes?: Array<{
    id: string;
    content: string;  // TipTap HTML content (users can format first line as heading for title)
    color?: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
    position: { x: number; y: number };
    size?: { width: number; height: number };
  }>;
}

/**
 * Skill Entity
 *
 * AIDEV-NOTE: Simplified single-instruction model
 * Removed: multi-step workflow (steps array)
 * Added: inputs, outputs, instructions (single text block), tools
 * Added: Global skills support (organizationId + optional agentId)
 * Added: content field for definition-level attachments (images, files)
 *
 * Represents a reusable skill with natural language instructions.
 * Skills have explicit inputs/outputs and can reference tools via @ mentions.
 *
 * Skills can be:
 * - Agent-scoped: agentId is set, owned by specific agent
 * - Organization-scoped: agentId is null, reusable across all agents in organization
 */
export interface Skill {
  readonly id: SkillId;
  readonly organizationId: OrganizationId;
  readonly agentId: AgentId | null; // null for organization skills
  readonly name: string;
  readonly description: string;
  readonly inputs: InputDefinition[];
  readonly outputs: OutputDefinition[];
  readonly instructions: string;
  readonly tools: ToolConfig[];
  readonly content?: MessagePart[]; // Skill-level attachments (images, files, text)
  readonly model?: string | null; // Optional: Override model for this skill
  readonly agentType?: string | null; // Optional: "tool_calling" (default) or "code_agent"
  readonly executionType?: SkillExecutionType; // 'agentic' (default), 'agent', 'operation', 'tool', or 'write'
  readonly taskModelConfig?: TaskModelConfig; // Config for 'operation' execution
  readonly toolExecutionConfig?: ToolExecutionConfig; // Config for 'tool' execution
  readonly writeConfig?: WriteConfig; // Config for 'write' execution
  readonly readConfig?: ReadConfig; // Config for 'read' execution
  readonly steps?: SkillStep[]; // Steps for 'agent' execution (step-based DAG workflow)
  readonly canvasMetadata?: CanvasMetadata; // Canvas annotations (sticky notes) - doesn't affect execution
  readonly isSystem: boolean; // System skills cannot be deleted by users
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Properties required to create a new Skill
 */
export interface CreateSkillProps {
  organizationId: OrganizationId;
  agentId?: AgentId | null; // Optional: null or undefined for organization skills
  name: string;
  description?: string;
  inputs?: InputDefinition[];
  outputs?: OutputDefinition[];
  instructions: string;
  tools?: ToolConfig[];
  content?: MessagePart[];
  model?: string | null; // Optional: Override model for this skill
  agentType?: string | null; // Optional: "tool_calling" (default) or "code_agent"
  executionType?: SkillExecutionType; // 'agentic' (default), 'agent', 'operation', 'tool', or 'write'
  taskModelConfig?: TaskModelConfig; // Config for 'operation' execution
  toolExecutionConfig?: ToolExecutionConfig; // Config for 'tool' execution
  writeConfig?: WriteConfig; // Config for 'write' execution
  readConfig?: ReadConfig; // Config for 'read' execution
  steps?: SkillStep[]; // Steps for 'agent' execution (step-based DAG workflow)
  canvasMetadata?: CanvasMetadata; // Canvas annotations (sticky notes)
}

/**
 * Properties that can be updated on a Skill
 */
export interface UpdateSkillProps {
  name?: string;
  description?: string;
  inputs?: InputDefinition[];
  outputs?: OutputDefinition[];
  instructions?: string;
  tools?: ToolConfig[];
  content?: MessagePart[];
  model?: string | null; // Optional: Override model for this skill
  agentType?: string | null; // Optional: "tool_calling" (default) or "code_agent"
  executionType?: SkillExecutionType; // 'agentic' (default), 'agent', 'operation', 'tool', or 'write'
  taskModelConfig?: TaskModelConfig | null; // Config for 'operation' execution (null to clear)
  toolExecutionConfig?: ToolExecutionConfig | null; // Config for 'tool' execution (null to clear)
  writeConfig?: WriteConfig | null; // Config for 'write' execution (null to clear)
  readConfig?: ReadConfig | null; // Config for 'read' execution (null to clear)
  steps?: SkillStep[] | null; // Steps for 'agent' execution (null to clear)
  canvasMetadata?: CanvasMetadata | null; // Canvas annotations (null to clear)
}

/**
 * Skill Entity Business Logic
 *
 * Provides factory methods and validation for Skill entities.
 * AIDEV-NOTE: Removed all step-related methods
 */
export class SkillEntity {
  /**
   * Create a new Skill (without ID and timestamps)
   * Used before persisting to database
   */
  static create(props: CreateSkillProps): Omit<Skill, 'id' | 'createdAt' | 'updatedAt'> {
    // Validation
    if (!props.name?.trim()) {
      throw new Error('Skill name is required and cannot be empty');
    }
    if (props.name.length > 255) {
      throw new Error('Skill name must be 255 characters or less');
    }
    if (props.description && props.description.length > 1000) {
      throw new Error('Skill description must be 1000 characters or less');
    }

    const executionType = props.executionType || 'agentic';

    // Instructions are required for agentic execution, optional for other modes
    if (executionType === 'agentic' && !props.instructions?.trim()) {
      throw new Error('Instructions are required for agentic execution');
    }

    // Steps are required for agent (step-based) execution
    if (executionType === 'agent' && (!props.steps || props.steps.length === 0)) {
      throw new Error('Steps are required for agent (step-based) execution');
    }

    // Validate input names
    const inputs = props.inputs || [];
    for (const input of inputs) {
      if (!input.name?.trim()) {
        throw new Error('All inputs must have non-empty names');
      }
    }

    // Validate output names
    const outputs = props.outputs || [];
    for (const output of outputs) {
      if (!output.name?.trim()) {
        throw new Error('All outputs must have non-empty names');
      }
    }

    return {
      organizationId: props.organizationId,
      agentId: props.agentId || null,
      name: props.name.trim(),
      description: props.description?.trim() || '',
      inputs: inputs,
      outputs: outputs,
      instructions: props.instructions?.trim() || '',
      tools: props.tools || [],
      content: props.content,
      executionType: executionType,
      taskModelConfig: props.taskModelConfig,
      toolExecutionConfig: props.toolExecutionConfig,
      writeConfig: props.writeConfig,
      steps: props.steps,
      canvasMetadata: props.canvasMetadata,
      isSystem: false // User-created skills are never system skills
    };
  }

  /**
   * Update an existing Skill
   * Returns a new Skill with updated values
   */
  static update(skill: Skill, updates: UpdateSkillProps): Skill {
    // Validation
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) {
        throw new Error('Skill name cannot be empty');
      }
      if (trimmed.length > 255) {
        throw new Error('Skill name must be 255 characters or less');
      }
    }

    if (updates.description !== undefined && updates.description.length > 1000) {
      throw new Error('Skill description must be 1000 characters or less');
    }

    // Determine final execution type
    const finalExecutionType = updates.executionType !== undefined
      ? updates.executionType
      : skill.executionType || 'agentic';

    // Instructions validation depends on execution type
    if (updates.instructions !== undefined && finalExecutionType === 'agentic' && !updates.instructions.trim()) {
      throw new Error('Instructions cannot be empty for agentic execution');
    }

    // Validate input names if provided
    if (updates.inputs) {
      for (const input of updates.inputs) {
        if (!input.name?.trim()) {
          throw new Error('All inputs must have non-empty names');
        }
      }
    }

    // Validate output names if provided
    if (updates.outputs) {
      for (const output of updates.outputs) {
        if (!output.name?.trim()) {
          throw new Error('All outputs must have non-empty names');
        }
      }
    }

    return {
      ...skill,
      name: updates.name !== undefined ? updates.name.trim() : skill.name,
      description: updates.description !== undefined ? updates.description.trim() : skill.description,
      inputs: updates.inputs !== undefined ? updates.inputs : skill.inputs,
      outputs: updates.outputs !== undefined ? updates.outputs : skill.outputs,
      instructions: updates.instructions !== undefined ? updates.instructions.trim() : skill.instructions,
      tools: updates.tools !== undefined ? updates.tools : skill.tools,
      content: updates.content !== undefined ? updates.content : skill.content,
      executionType: updates.executionType !== undefined ? updates.executionType : skill.executionType,
      taskModelConfig: updates.taskModelConfig !== undefined
        ? (updates.taskModelConfig === null ? undefined : updates.taskModelConfig)
        : skill.taskModelConfig,
      toolExecutionConfig: updates.toolExecutionConfig !== undefined
        ? (updates.toolExecutionConfig === null ? undefined : updates.toolExecutionConfig)
        : skill.toolExecutionConfig,
      writeConfig: updates.writeConfig !== undefined
        ? (updates.writeConfig === null ? undefined : updates.writeConfig)
        : skill.writeConfig,
      steps: updates.steps !== undefined
        ? (updates.steps === null ? undefined : updates.steps)
        : skill.steps,
      canvasMetadata: updates.canvasMetadata !== undefined
        ? (updates.canvasMetadata === null ? undefined : updates.canvasMetadata)
        : skill.canvasMetadata,
      updatedAt: new Date()
    };
  }

  /**
   * Check if skill is organization-scoped
   */
  static isOrganizationScoped(skill: Skill): boolean {
    return skill.agentId === null;
  }

  /**
   * Check if skill is agent-scoped
   */
  static isAgentScoped(skill: Skill): boolean {
    return skill.agentId !== null;
  }

  /**
   * Check if skill uses agentic execution (flat LLM orchestration)
   */
  static isAgenticExecution(skill: Skill): boolean {
    return !skill.executionType || skill.executionType === 'agentic';
  }

  /**
   * Check if skill uses agent execution (step-based DAG workflow)
   */
  static isAgentExecution(skill: Skill): boolean {
    return skill.executionType === 'agent';
  }

  /**
   * Get skill scope label for display
   */
  static getScopeLabel(skill: Skill): string {
    return this.isOrganizationScoped(skill) ? 'Organization' : 'Agent';
  }

  /**
   * Get skill summary for display
   */
  static getSummary(skill: Skill): string {
    const parts: string[] = [];

    if (skill.inputs.length > 0) {
      parts.push(`${skill.inputs.length} input${skill.inputs.length !== 1 ? 's' : ''}`);
    }

    if (skill.outputs.length > 0) {
      parts.push(`${skill.outputs.length} output${skill.outputs.length !== 1 ? 's' : ''}`);
    }

    if (skill.tools.length > 0) {
      parts.push(`${skill.tools.length} tool${skill.tools.length !== 1 ? 's' : ''}`);
    }

    return parts.length > 0 ? parts.join(' • ') : 'No configuration';
  }
}
