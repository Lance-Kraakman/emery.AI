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
  type Agent,
  type Skill,
  type Database,
} from '../utils';
import { orgChartNodeSizes } from '../theme';

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

  // Add real skill node (called after server creates it)
  // Also auto-resizes parent agent if expanded and if needed
  const addSkillNode = useCallback(
    (skill: Skill, position: XYPosition) => {
      const { canvasMetadata } = propsRef.current;
      setNodes((nds) => {
        const newNodes = [...nds];

        // Ensure skill is placed in content area (below header, y >= 50)
        const adjustedPosition = skill.agentId
          ? { x: position.x, y: Math.max(50, position.y) }
          : position;

        newNodes.push(createSkillNode(skill, adjustedPosition, canvasMetadata));

        // Auto-resize parent agent if skill belongs to one and if needed
        if (skill.agentId) {
          const agentNodeId = makeNodeId('agent', skill.agentId);
          const agentIndex = newNodes.findIndex((n) => n.id === agentNodeId);
          if (agentIndex !== -1) {
            const agentNode = newNodes[agentIndex];
            const data = agentNode.data as AgentContainerNodeData;

            if (data.isExpanded) {
              // Count all children for this agent
              const childCount = newNodes.filter((n) => n.parentId === agentNodeId).length;
              const rows = Math.ceil(childCount / 2);
              const neededHeight = 60 + rows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);

              // Get current height from node.width/height or measured or style
              const nodeAny = agentNode as any;
              const currentHeight = nodeAny.height ?? nodeAny.measured?.height ??
                (typeof agentNode.style?.height === 'number' ? agentNode.style.height : orgChartNodeSizes.containerMinHeight);

              // Only resize if needed
              if (neededHeight > currentHeight) {
                const newHeight = Math.max(orgChartNodeSizes.containerMinHeight, neededHeight);
                newNodes[agentIndex] = {
                  ...agentNode,
                  style: { ...agentNode.style, height: newHeight },
                  data: { ...data, skillCount: (data.skillCount ?? 0) + 1 },
                };
              } else {
                // Just update the skill count
                newNodes[agentIndex] = {
                  ...agentNode,
                  data: { ...data, skillCount: (data.skillCount ?? 0) + 1 },
                };
              }
            }
          }
        }

        return newNodes;
      });
    },
    [setNodes]
  );

  // Add real database node (called after server creates it)
  // Also auto-resizes parent agent if expanded and if needed
  const addDatabaseNode = useCallback(
    (database: Database, position: XYPosition) => {
      const { canvasMetadata } = propsRef.current;
      setNodes((nds) => {
        const newNodes = [...nds];

        // Ensure database is placed in content area (below header, y >= 50)
        const adjustedPosition = database.agentId
          ? { x: position.x, y: Math.max(50, position.y) }
          : position;

        newNodes.push(createDatabaseNode(database, adjustedPosition, canvasMetadata));

        // Auto-resize parent agent if database belongs to one and if needed
        if (database.agentId) {
          const agentNodeId = makeNodeId('agent', database.agentId);
          const agentIndex = newNodes.findIndex((n) => n.id === agentNodeId);
          if (agentIndex !== -1) {
            const agentNode = newNodes[agentIndex];
            const data = agentNode.data as AgentContainerNodeData;

            if (data.isExpanded) {
              // Count all children for this agent
              const childCount = newNodes.filter((n) => n.parentId === agentNodeId).length;
              const rows = Math.ceil(childCount / 2);
              const neededHeight = 60 + rows * (orgChartNodeSizes.nodeHeight + orgChartNodeSizes.childNodeGap);

              // Get current height from node.width/height or measured or style
              const nodeAny = agentNode as any;
              const currentHeight = nodeAny.height ?? nodeAny.measured?.height ??
                (typeof agentNode.style?.height === 'number' ? agentNode.style.height : orgChartNodeSizes.containerMinHeight);

              // Only resize if needed
              if (neededHeight > currentHeight) {
                const newHeight = Math.max(orgChartNodeSizes.containerMinHeight, neededHeight);
                newNodes[agentIndex] = {
                  ...agentNode,
                  style: { ...agentNode.style, height: newHeight },
                  data: { ...data, databaseCount: (data.databaseCount ?? 0) + 1 },
                };
              } else {
                // Just update the database count
                newNodes[agentIndex] = {
                  ...agentNode,
                  data: { ...data, databaseCount: (data.databaseCount ?? 0) + 1 },
                };
              }
            }
          }
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
