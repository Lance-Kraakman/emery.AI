/**
 * Variable Inference Utility
 *
 * Automatically infers available variables for a node by tracing upstream connections.
 * This replaces the need for manual inputDefs/outputDefs on most nodes.
 */

import type { WorkflowNode, WorkflowEdge } from '../types';
import type { WorkflowVariable } from '../WorkflowVariableInput';
import type { InputDefinition } from '@/ddd/domain/skills/entities/skill';
import type {
  ReadNodeData,
  WriteNodeData,
  AgenticNodeData,
  ToolNodeData,
  OperationNodeData,
  LoopNodeData,
  ConditionNodeData,
  SkillRefNodeData,
} from '../types';

/**
 * Inferred output from a node
 */
interface InferredOutput {
  name: string;
  description: string;
  type: 'text' | 'number' | 'json' | 'boolean';
}

/**
 * Get the outputs a node produces based on its type and configuration.
 * This is the core inference logic.
 */
export function getNodeOutputs(node: WorkflowNode): InferredOutput[] {
  const nodeType = node.type;

  switch (nodeType) {
    case 'read': {
      // Read nodes output their field mappings as variables
      const data = node.data as ReadNodeData;
      const fieldMappings = data.readConfig?.fieldMappings || [];
      return fieldMappings.map((mapping) => ({
        name: mapping.targetVariable,
        description: `Field from table read`,
        type: 'text' as const,
      }));
    }

    case 'write': {
      // Write nodes output the created/updated row ID
      return [
        {
          name: 'rowId',
          description: 'ID of the created/updated row',
          type: 'number' as const,
        },
      ];
    }

    case 'agentic': {
      // Agentic nodes output the LLM response
      return [
        {
          name: 'result',
          description: 'LLM response text',
          type: 'text' as const,
        },
      ];
    }

    case 'tool': {
      // Tool nodes output the tool response
      return [
        {
          name: 'result',
          description: 'Tool execution result',
          type: 'json' as const,
        },
      ];
    }

    case 'operation': {
      // Operation nodes output the model response
      const data = node.data as OperationNodeData;
      const taskType = data.taskModelConfig?.taskType;
      return [
        {
          name: 'result',
          description: taskType ? `${taskType} model output` : 'Model output',
          type: 'text' as const,
        },
      ];
    }

    case 'loop': {
      // Loop nodes provide item and index within the loop body
      const data = node.data as LoopNodeData;
      const itemVar = data.loopConfig?.currentItemVar || 'item';
      return [
        {
          name: itemVar,
          description: 'Current loop item',
          type: 'json' as const,
        },
        {
          name: 'index',
          description: 'Current loop index (0-based)',
          type: 'number' as const,
        },
      ];
    }

    case 'condition': {
      // Condition nodes don't produce outputs, they just route
      return [];
    }

    case 'skillRef': {
      // Skill ref nodes output their result
      return [
        {
          name: 'result',
          description: 'Referenced skill output',
          type: 'json' as const,
        },
      ];
    }

    default:
      return [];
  }
}

/**
 * Collect all available variables for a given node by tracing upstream connections.
 * Variables come from:
 * 1. Skill inputs (always available)
 * 2. Outputs from upstream connected nodes
 */
export function getUpstreamVariables(
  nodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  skillInputs: InputDefinition[]
): WorkflowVariable[] {
  const variables: WorkflowVariable[] = [];
  const visited = new Set<string>();

  // 1. Add skill-level inputs (always available to all nodes)
  for (const input of skillInputs) {
    variables.push({
      name: input.name,
      label: input.name,
      description: `Skill input (${input.type || 'text'})`,
      group: 'input',
    });
  }

  // 2. Collect outputs from upstream nodes via BFS
  function collectUpstream(targetNodeId: string) {
    // Find all edges that point TO this node
    const incomingEdges = edges.filter((e) => e.target === targetNodeId);

    for (const edge of incomingEdges) {
      if (visited.has(edge.source)) continue;
      visited.add(edge.source);

      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (!sourceNode) continue;

      // Get outputs from this source node
      const outputs = getNodeOutputs(sourceNode);
      const nodeName = sourceNode.data.name;
      const isLoop = sourceNode.type === 'loop';

      for (const output of outputs) {
        variables.push({
          // Use nodeName.outputName format for clarity
          name: `${nodeName}.${output.name}`,
          label: `${nodeName} > ${output.name}`,
          description: output.description,
          // Loop context variables get 'loop' group, others get 'output'
          group: isLoop ? 'loop' : 'output',
        });
      }

      // Continue tracing upstream (but not through the source node's upstream for loop context)
      // Loop variables are only available inside the loop, not propagated further
      if (!isLoop) {
        collectUpstream(edge.source);
      }
    }
  }

  collectUpstream(nodeId);

  // 3. Add special variables (available everywhere)
  variables.push({
    name: '__error__',
    label: 'Error',
    description: 'Error message from failed previous step',
    group: 'special',
  });

  return variables;
}

/**
 * Hook-friendly function to get variables for a selected node.
 * Returns empty array if no node is selected.
 */
export function inferVariablesForNode(
  selectedNodeId: string | null,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  skillInputs: InputDefinition[]
): WorkflowVariable[] {
  if (!selectedNodeId) return [];
  return getUpstreamVariables(selectedNodeId, nodes, edges, skillInputs);
}
