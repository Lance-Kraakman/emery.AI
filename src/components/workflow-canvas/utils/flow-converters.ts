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
} from '@/ddd/domain/skills/entities/skill';
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeData,
  SkillRefNodeData,
  ConditionNodeData,
  LoopNodeData,
  AgenticNodeData,
  OperationNodeData,
  ToolNodeData,
  WriteNodeData,
  ReadNodeData,
} from '../types';

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
 */
export function stepsToFlow(steps: SkillStep[]): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  steps.forEach((step, index) => {
    const nodeType = getNodeType(step);
    const position = step._position || getDefaultPosition(index);

    nodes.push({
      id: step.name,
      type: nodeType,
      position,
      data: stepToNodeData(step),
    });

    // Create edges from stepOutputs
    if (step.stepOutputs) {
      step.stepOutputs.forEach((output, outputIndex) => {
        output.nextSteps.forEach((targetName) => {
          edges.push({
            id: `${step.name}-${targetName}-${output.type}-${outputIndex}`,
            source: step.name,
            target: targetName,
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

  return { nodes, edges };
}

// =============================================================================
// Nodes/Edges → SkillStep[]
// =============================================================================

/**
 * Convert node data back to SkillStep fields
 */
function nodeDataToStep(node: WorkflowNode): Partial<SkillStep> {
  const data = node.data;
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
 */
function groupEdgesByType(edges: WorkflowEdge[]): StepOutput[] {
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

    outputMap.get(key)!.nextSteps.push(edge.target);
  });

  return Array.from(outputMap.values());
}

/**
 * Convert React Flow nodes and edges back to SkillStep[]
 */
export function flowToSteps(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): SkillStep[] {
  return nodes.map((node) => {
    const outgoingEdges = edges.filter((e) => e.source === node.id);
    const stepOutputs = groupEdgesByType(outgoingEdges);

    return {
      name: node.id,
      ...nodeDataToStep(node),
      // Always set stepOutputs explicitly (empty array = no outgoing edges)
      stepOutputs,
      _position: node.position,
    } as SkillStep;
  });
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get default data for a new node
 */
export function getDefaultNodeData(type: WorkflowNodeType): WorkflowNodeData {
  const baseName = `${type}_${Date.now()}`;

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
