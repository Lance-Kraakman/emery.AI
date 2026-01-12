/**
 * Flow Converters
 *
 * Convert between SkillStep[] and React Flow nodes/edges.
 * Handles bidirectional sync for the workflow canvas.
 */

import type { XYPosition } from '@xyflow/react';
import type {
  SkillStep,
  StepOutput,
  WorkflowNodeType,
  CanvasMetadata,
} from '@/ddd/domain/skills/entities/skill';
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeData,
  CanvasNodeData,
  SkillRefNodeData,
  ConditionNodeData,
  LoopNodeData,
  AgenticNodeData,
  OperationNodeData,
  ToolNodeData,
  WriteNodeData,
  ReadNodeData,
  StickyNodeData,
  SkillInputNodeData,
  SkillOutputNodeData,
} from '../types';
import type { InputDefinition, OutputDefinition } from '@/ddd/domain/skills/entities/skill';

// Virtual node IDs for skill I/O nodes
export const SKILL_INPUT_NODE_ID = '__skill_input__';
export const SKILL_OUTPUT_NODE_ID = '__skill_output__';

/**
 * Type guard to check if node data is workflow data (not a sticky note)
 */
function isWorkflowNodeData(data: CanvasNodeData): data is WorkflowNodeData {
  return 'inputDefs' in data || 'outputDefs' in data || !('content' in data);
}

// =============================================================================
// SkillStep[] → Nodes/Edges
// =============================================================================

/**
 * Determine node type from a SkillStep
 * Reads nodeType directly if set, otherwise detects from config fields (backwards compat)
 */
export function getNodeType(step: SkillStep): WorkflowNodeType {
  // If nodeType is explicitly set, use it
  if (step.nodeType) return step.nodeType;

  // Detect from configs (backwards compatibility)
  if (step.agenticConfig) return 'agentic';
  if (step.taskModelConfig) return 'operation';
  if (step.toolExecutionConfig) return 'tool';
  if (step.writeConfig) return 'write';
  if (step.readConfig) return 'read';
  if (step.loopConfig) return 'loop';
  if (step.conditions?.length) return 'condition';
  if (step.skillId) return 'skillRef';

  // Default to agentic for LLM-based steps
  return 'agentic';
}

/**
 * Convert a SkillStep to node data
 */
function stepToNodeData(step: SkillStep): WorkflowNodeData {
  const baseData = {
    name: step.name,
    inputDefs: step.inputDefs,
    outputDefs: step.outputDefs,
    errorConfig: step.errorConfig,
    retryConfig: step.retryConfig,
    parallelGroup: step.parallelGroup,
  };

  const nodeType = getNodeType(step);

  switch (nodeType) {
    case 'loop':
      return {
        ...baseData,
        loopConfig: step.loopConfig!,
        instruction: step.instruction,
        skillId: step.skillId,
      } as LoopNodeData;

    case 'condition':
      // Use conditions from step, or extract from stepOutputs (backwards compat)
      const conditions = step.conditions || step.stepOutputs
        ?.filter(o => o.type === 'condition')
        .map(o => ({
          expression: o.condition || '',
          label: o.condition?.slice(0, 20),
        })) || [];
      return {
        ...baseData,
        conditions,
      } as ConditionNodeData;

    case 'skillRef':
      return {
        ...baseData,
        skillId: step.skillId!,
      } as SkillRefNodeData;

    case 'agentic':
    default:
      // Handle both new agenticConfig and legacy instruction field
      return {
        ...baseData,
        instructions: step.agenticConfig?.instructions || step.instruction || '',
        tools: step.agenticConfig?.tools || [],
        agentType: step.agenticConfig?.agentType || 'tool_calling',
        model: step.agenticConfig?.model,
      } as AgenticNodeData;

    case 'operation':
      return {
        ...baseData,
        taskModelConfig: step.taskModelConfig,
        promptTemplate: step.instruction,
      } as OperationNodeData;

    case 'tool':
      return {
        ...baseData,
        toolExecutionConfig: step.toolExecutionConfig,
      } as ToolNodeData;

    case 'write':
      return {
        ...baseData,
        writeConfig: step.writeConfig,
      } as WriteNodeData;

    case 'read':
      return {
        ...baseData,
        readConfig: step.readConfig,
      } as ReadNodeData;
  }
}

/**
 * Auto-layout nodes if no position is stored
 * Tighter grid for compact n8n-style nodes
 */
function getDefaultPosition(index: number): XYPosition {
  const GRID_X = 180; // Tighter horizontal spacing for 140px nodes
  const GRID_Y = 80;  // Tighter vertical spacing for compact nodes
  const OFFSET_X = 100;
  const OFFSET_Y = 100;

  return {
    x: OFFSET_X + (index % 3) * GRID_X,
    y: OFFSET_Y + Math.floor(index / 3) * GRID_Y,
  };
}

/**
 * Convert SkillStep[] to React Flow nodes and edges
 * @param steps - Workflow steps (execution graph)
 * @param canvasMetadata - Optional canvas annotations (sticky notes)
 * @param skillInputs - Skill-level input definitions (for virtual SkillInputNode)
 * @param skillOutputs - Skill-level output definitions (for virtual SkillOutputNode)
 */
export function stepsToFlow(
  steps: SkillStep[],
  canvasMetadata?: CanvasMetadata,
  skillInputs?: InputDefinition[],
  skillOutputs?: OutputDefinition[]
): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  // Build name→id map for resolving edge targets
  // (stepOutputs.nextSteps contains names, not IDs)
  const nameToId = new Map(steps.map(s => [s.name, s.id]));

  steps.forEach((step, index) => {
    const nodeType = getNodeType(step);
    const position = step._position || getDefaultPosition(index);

    nodes.push({
      id: step.id,  // Use stable ID
      type: nodeType,
      position,
      data: stepToNodeData(step),
    });

    // Create edges from stepOutputs
    if (step.stepOutputs) {
      step.stepOutputs.forEach((output, outputIndex) => {
        output.nextSteps.forEach((targetName) => {
          const targetId = nameToId.get(targetName);
          if (!targetId) return; // Skip if target not found

          edges.push({
            id: `${step.id}-${targetId}-${output.type}-${outputIndex}`,
            source: step.id,
            target: targetId,
            sourceHandle: output.type === 'condition'
              ? `cond_${outputIndex}`
              : output.type,
            type: output.type,
            data: {
              label: output.type,
              condition: output.condition,
            },
          });
        });
      });
    }
    // Note: No sequential fallback - only explicit edges are created
  });

  // Add sticky notes from canvas metadata
  if (canvasMetadata?.stickyNotes) {
    canvasMetadata.stickyNotes.forEach((sticky) => {
      nodes.push({
        id: sticky.id,
        type: 'sticky',
        position: sticky.position,
        data: {
          content: sticky.content,
          color: sticky.color || 'yellow',
        } as StickyNodeData,
        style: sticky.size
          ? { width: sticky.size.width, height: sticky.size.height }
          : { width: 200, height: 120 },
      } as WorkflowNode);
    });
  }

  // Add virtual Skill I/O nodes if inputs/outputs are provided
  // Positioned vertically: Inputs at top, Outputs at bottom
  if (skillInputs || skillOutputs) {
    // Calculate positions based on workflow nodes
    const workflowNodes = nodes.filter(n => n.type !== 'sticky');
    const minY = workflowNodes.length > 0
      ? Math.min(...workflowNodes.map(n => n.position.y))
      : 150;
    const maxY = workflowNodes.length > 0
      ? Math.max(...workflowNodes.map(n => n.position.y))
      : 150;
    const avgX = workflowNodes.length > 0
      ? workflowNodes.reduce((sum, n) => sum + n.position.x, 0) / workflowNodes.length
      : 300;

    // Add SkillInputNode at the TOP (horizontally centered)
    if (skillInputs && skillInputs.length > 0) {
      nodes.push({
        id: SKILL_INPUT_NODE_ID,
        type: 'skillInput',
        position: { x: avgX - 100, y: minY - 120 },
        data: {
          inputs: skillInputs,
          isVirtual: true,
        } as SkillInputNodeData,
        draggable: true,
        selectable: true,
        deletable: false,  // Cannot delete virtual nodes
      } as WorkflowNode);
    }

    // Add SkillOutputNode at the BOTTOM (horizontally centered)
    if (skillOutputs && skillOutputs.length > 0) {
      nodes.push({
        id: SKILL_OUTPUT_NODE_ID,
        type: 'skillOutput',
        position: { x: avgX - 100, y: maxY + 180 },
        data: {
          outputs: skillOutputs,
          isVirtual: true,
        } as SkillOutputNodeData,
        draggable: true,
        selectable: true,
        deletable: false,  // Cannot delete virtual nodes
      } as WorkflowNode);
    }
  }

  return { nodes, edges };
}

// =============================================================================
// Nodes/Edges → SkillStep[]
// =============================================================================

/**
 * Convert node data back to SkillStep fields
 * Note: Only called for workflow nodes (sticky notes are filtered out before this)
 */
function nodeDataToStep(node: WorkflowNode): Partial<SkillStep> {
  // Cast to WorkflowNodeData since sticky notes are filtered out before calling this
  const data = node.data as WorkflowNodeData;
  const base: Partial<SkillStep> = {
    nodeType: node.type as WorkflowNodeType,
    inputDefs: data.inputDefs,
    outputDefs: data.outputDefs,
    errorConfig: data.errorConfig,
    retryConfig: data.retryConfig,
    parallelGroup: data.parallelGroup,
  };

  switch (node.type) {
    case 'loop':
      const loopData = data as LoopNodeData;
      return {
        ...base,
        loopConfig: loopData.loopConfig,
        instruction: loopData.instruction,
        skillId: loopData.skillId,
      };

    case 'condition':
      const conditionData = data as ConditionNodeData;
      return {
        ...base,
        conditions: conditionData.conditions,
      };

    case 'skillRef':
      const skillRefData = data as SkillRefNodeData;
      return {
        ...base,
        skillId: skillRefData.skillId,
      };

    case 'agentic':
    default:
      const agenticData = data as AgenticNodeData;
      return {
        ...base,
        agenticConfig: {
          instructions: agenticData.instructions,
          tools: agenticData.tools,
          agentType: agenticData.agentType,
          model: agenticData.model,
        },
      };

    case 'operation':
      const operationData = data as OperationNodeData;
      return {
        ...base,
        instruction: operationData.promptTemplate,
        taskModelConfig: operationData.taskModelConfig,
      };

    case 'tool':
      const toolData = data as ToolNodeData;
      return {
        ...base,
        toolExecutionConfig: toolData.toolExecutionConfig,
      };

    case 'write':
      const writeData = data as WriteNodeData;
      return {
        ...base,
        writeConfig: writeData.writeConfig,
      };

    case 'read':
      const readData = data as ReadNodeData;
      return {
        ...base,
        readConfig: readData.readConfig,
      };
  }
}

/**
 * Group edges by type to create stepOutputs
 * @param edges - outgoing edges from a node
 * @param idToName - map to convert node IDs to names for stepOutputs.nextSteps
 */
function groupEdgesByType(
  edges: WorkflowEdge[],
  idToName: Map<string, string>
): StepOutput[] {
  const outputMap = new Map<string, StepOutput>();

  edges.forEach((edge) => {
    const edgeType = (edge.type || 'success') as StepOutput['type'];
    const key = edgeType === 'condition'
      ? `${edgeType}-${edge.data?.condition || ''}`
      : edgeType;

    if (!outputMap.has(key)) {
      outputMap.set(key, {
        type: edgeType,
        condition: edge.data?.condition,
        nextSteps: [],
      });
    }

    // Convert ID to name for nextSteps (uses names for readability)
    const targetName = idToName.get(edge.target) || edge.target;
    outputMap.get(key)!.nextSteps.push(targetName);
  });

  return Array.from(outputMap.values());
}

/**
 * Result of converting React Flow back to domain data
 */
export interface FlowToStepsResult {
  steps: SkillStep[];
  canvasMetadata: CanvasMetadata;
}

/**
 * Check if a node is a virtual I/O node (not saved as a step)
 */
function isVirtualNode(node: WorkflowNode): boolean {
  return node.type === 'skillInput' || node.type === 'skillOutput';
}

/**
 * Convert React Flow nodes and edges back to SkillStep[] and CanvasMetadata
 * Separates execution steps from canvas annotations (sticky notes, virtual I/O nodes)
 */
export function flowToSteps(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): FlowToStepsResult {
  // Separate sticky notes and virtual nodes from workflow nodes
  const stickyNodes = nodes.filter(n => n.type === 'sticky');
  const workflowNodes = nodes.filter(n => n.type !== 'sticky' && !isVirtualNode(n));

  // Build id→name map for converting edge targets back to names
  // (stepOutputs.nextSteps uses names for readability)
  // Note: workflow nodes always have name, sticky nodes are filtered out
  const idToName = new Map(workflowNodes.map(n => [n.id, (n.data as WorkflowNodeData).name]));

  const steps = workflowNodes.map((node) => {
    const data = node.data as WorkflowNodeData;
    const outgoingEdges = edges.filter((e) => e.source === node.id);
    const stepOutputs = groupEdgesByType(outgoingEdges, idToName);

    return {
      id: node.id,           // Stable ID
      name: data.name,       // Display name from data
      ...nodeDataToStep(node),
      // Always set stepOutputs explicitly (empty array = no outgoing edges)
      stepOutputs,
      _position: node.position,
    } as SkillStep;
  });

  // Extract sticky notes to canvas metadata
  const canvasMetadata: CanvasMetadata = {
    stickyNotes: stickyNodes.map((node) => {
      const data = node.data as StickyNodeData;
      return {
        id: node.id,
        content: data.content,
        color: data.color,
        position: node.position,
        size: node.style
          ? { width: node.style.width as number, height: node.style.height as number }
          : undefined,
      };
    }),
  };

  return { steps, canvasMetadata };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get default data for a new node
 * @param type - the node type
 * @param id - the stable node ID (used to derive a friendly name suffix)
 */
export function getDefaultNodeData(type: WorkflowNodeType, id: string): WorkflowNodeData {
  // Use first 8 chars of UUID for a short, unique suffix
  const shortId = id.slice(0, 8);
  const baseName = `${type}_${shortId}`;

  switch (type) {
    case 'skillRef':
      return {
        name: baseName,
        skillId: 0,
      } as SkillRefNodeData;

    case 'condition':
      return {
        name: baseName,
        conditions: [{ expression: '', label: 'Condition 1' }],
      } as ConditionNodeData;

    case 'loop':
      return {
        name: baseName,
        loopConfig: {
          type: 'for_each',
          itemsVar: '',
          currentItemVar: 'item',
          maxIterations: 100,
        },
      } as LoopNodeData;

    case 'agentic':
    default:
      return {
        name: baseName,
        instructions: '',
        tools: [],
        agentType: 'tool_calling',
      } as AgenticNodeData;

    case 'operation':
      return {
        name: baseName,
        taskModelConfig: undefined,
        promptTemplate: '',
      } as OperationNodeData;

    case 'tool':
      return {
        name: baseName,
        toolExecutionConfig: undefined,
      } as ToolNodeData;

    case 'write':
      return {
        name: baseName,
        writeConfig: undefined,
      } as WriteNodeData;

    case 'read':
      return {
        name: baseName,
        readConfig: {
          mode: 'single_row',
          sourceTableId: 0,
          fieldMappings: [],
        },
      } as ReadNodeData;
  }
}
