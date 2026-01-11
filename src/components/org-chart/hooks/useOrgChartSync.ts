/**
 * useOrgChartSync Hook
 *
 * Syncs org chart nodes from server props.
 * Simple approach: initial load from props, then add nodes directly after server creates entities.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { XYPosition } from '@xyflow/react';
import type {
  OrgChartNode,
  OrgChartEdge,
  OrgChartCanvasMetadata,
  AgentContainerNodeData,
} from '../types';
import {
  buildOrgChartFromData,
  createAgentNode,
  createSkillNode,
  createDatabaseNode,
  makeNodeId,
  getNodeDimensions,
  calculateAgentContentHeight,
  ensureContentAreaPosition,
  type Agent,
  type Skill,
  type Database,
} from '../utils';
import { orgChartNodeSizes } from '../theme';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Update an agent node's child count and optionally resize if content doesn't fit.
 */
function updateAgentWithChild(
  nodes: OrgChartNode[],
  agentNodeId: string,
  countKey: 'skillCount' | 'databaseCount'
): OrgChartNode[] {
  const agentIndex = nodes.findIndex((n) => n.id === agentNodeId);
  if (agentIndex === -1) return nodes;

  const agentNode = nodes[agentIndex];
  const data = agentNode.data as AgentContainerNodeData;
  if (!data.isExpanded) return nodes;

  // Calculate new counts for sectioned layout
  const newSkillCount = countKey === 'skillCount'
    ? (data.skillCount ?? 0) + 1
    : (data.skillCount ?? 0);
  const newDatabaseCount = countKey === 'databaseCount'
    ? (data.databaseCount ?? 0) + 1
    : (data.databaseCount ?? 0);

  const neededHeight = calculateAgentContentHeight(newSkillCount, newDatabaseCount);
  const { height: currentHeight } = getNodeDimensions(agentNode);

  const newData = { ...data, [countKey]: (data[countKey] ?? 0) + 1 };

  if (neededHeight > currentHeight) {
    const newHeight = Math.max(orgChartNodeSizes.containerMinHeight, neededHeight);
    nodes[agentIndex] = {
      ...agentNode,
      style: { ...agentNode.style, height: newHeight },
      data: newData,
    };
  } else {
    nodes[agentIndex] = { ...agentNode, data: newData };
  }

  return nodes;
}

export interface SyncProps {
  agents: Agent[];
  skills: Skill[];
  databases: Database[];
  canvasMetadata?: OrgChartCanvasMetadata;
}

export interface UseOrgChartSyncReturn {
  addAgentNode: (agent: Agent, position: XYPosition) => void;
  addSkillNode: (skill: Skill, position: XYPosition) => void;
  addDatabaseNode: (database: Database, position: XYPosition) => void;
  isInitialized: boolean;
}

export function useOrgChartSync(
  props: SyncProps,
  setNodes: React.Dispatch<React.SetStateAction<OrgChartNode[]>>,
  setEdges: React.Dispatch<React.SetStateAction<OrgChartEdge[]>>
): UseOrgChartSyncReturn {
  // Use state instead of ref so changes trigger re-renders for persistence hook
  const [isInitialized, setIsInitialized] = useState(false);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Initial load only - no prop syncing
  useEffect(() => {
    if (isInitialized) return;

    const { agents, skills, databases, canvasMetadata } = props;
    const { nodes, edges } = buildOrgChartFromData(agents, skills, databases, canvasMetadata);

    setNodes(nodes);
    setEdges(edges);
    setIsInitialized(true);
  }, [props, setNodes, setEdges, isInitialized]);

  // Add real agent node (called after server creates it)
  const addAgentNode = useCallback(
    (agent: Agent, position: XYPosition) => {
      const { canvasMetadata, skills, databases } = propsRef.current;
      setNodes((nds) => [...nds, createAgentNode(agent, position, canvasMetadata, skills, databases)]);
    },
    [setNodes]
  );

  // Add skill node and auto-resize parent agent if needed
  const addSkillNode = useCallback(
    (skill: Skill, position: XYPosition) => {
      const { canvasMetadata } = propsRef.current;
      setNodes((nds) => {
        const adjustedPosition = ensureContentAreaPosition(position, !!skill.agentId);
        let newNodes = [...nds, createSkillNode(skill, adjustedPosition, canvasMetadata)];

        if (skill.agentId) {
          newNodes = updateAgentWithChild(newNodes, makeNodeId('agent', skill.agentId), 'skillCount');
        }

        return newNodes;
      });
    },
    [setNodes]
  );

  // Add database node and auto-resize parent agent if needed
  const addDatabaseNode = useCallback(
    (database: Database, position: XYPosition) => {
      const { canvasMetadata } = propsRef.current;
      setNodes((nds) => {
        const adjustedPosition = ensureContentAreaPosition(position, !!database.agentId);
        let newNodes = [...nds, createDatabaseNode(database, adjustedPosition, canvasMetadata)];

        if (database.agentId) {
          newNodes = updateAgentWithChild(newNodes, makeNodeId('agent', database.agentId), 'databaseCount');
        }

        return newNodes;
      });
    },
    [setNodes]
  );

  return {
    addAgentNode,
    addSkillNode,
    addDatabaseNode,
    isInitialized,
  };
}
