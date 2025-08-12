'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  ReactFlow, 
  Node, 
  Edge, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState,
  ConnectionMode,
  Panel as ReactFlowPanel,
  ReactFlowProvider 
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { 
  Settings, 
  Search, 
  ZoomIn, 
  ZoomOut, 
  Maximize,
  Eye,
  Edit3,
  Activity,
} from 'lucide-react';
import { updateOrganizationViewConfig } from '@/app/actions/organizations';
import { getTasks } from '@/app/actions/tasks';

import { Agent, Team } from '@/types/db';
import { Task } from '@/app/actions/types';
import TeamNode from './TeamNode';
import AgentNode from './AgentNode';
import ActivityPanel from './ActivityPanel';
import { useEmery } from '@/contexts/EmeryContext';

// Define custom node types
const nodeTypes = {
  team: TeamNode,
  agent: AgentNode,
};

export default function OrganizationChart() {
  const { data, currentOrganization } = useEmery();
  const { agents, teams } = data;
  const [tasks, setTasks] = useState<Task[]>([]);
  
  useEffect(() => {
    getTasks().then(result => {
      if (result.success) {
        setTasks(result.data);
      }
    });
  }, []);
  
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Enhanced view data structure with validation
  const createViewData = useCallback(() => {
    return {
      version: '1.0',
      organizationId: currentOrganization?.id,
      nodes: nodes.map(node => ({ 
        id: node.id, 
        position: node.position,
        type: node.type,
        data: {
          id: node.data.id,
          name: node.data.name,
          type: node.data.type,
          // Only save essential data, not full objects
        }
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type
      })),
      viewState: {
        selectedNodes,
        searchTerm,
        isPanelCollapsed,
        isConfiguring
      },
      metadata: {
        timestamp: new Date().toISOString(),
        nodeCount: nodes.length,
        edgeCount: edges.length
      }
    };
  }, [nodes, edges, selectedNodes, searchTerm, isPanelCollapsed, isConfiguring, currentOrganization]);

  // Validate view data structure
  const validateViewData = (data: any): boolean => {
    return (
      data &&
      typeof data === 'object' &&
      data.version &&
      Array.isArray(data.nodes) &&
      Array.isArray(data.edges) &&
      data.viewState &&
      data.metadata
    );
  };

  // Auto-save view to DB (only if currentOrganization is available)
  const autoSaveView = useCallback(async () => {
    if (!currentOrganization?.id || nodes.length === 0) return;

    try {
      const viewData = createViewData();
      await updateOrganizationViewConfig(currentOrganization.id, viewData);
    } catch (error) {
      console.error('Failed to save organization view:', error);
    }
  }, [createViewData, currentOrganization, nodes.length]);

  // Convert teams and agents to React Flow nodes
  const generateNodesAndEdges = useCallback(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Create team nodes
    teams.forEach((team, index) => {
      const teamX = 200 + (index % 3) * 400;
      const teamY = 100 + Math.floor(index / 3) * 300;

      newNodes.push({
        id: `team-${team.id}`,
        type: 'team',
        position: { x: teamX, y: teamY },
        data: { 
          ...team,
          type: 'team',
          tasks: tasks.filter(task => 
            team.agentIds?.some(agentId => 
              agents.some(agent => agent.id.toString() === agentId && agent.id === task.agentId)
            )
          )
        },
        selectable: true,
      });

      // Create agent nodes for this team
      const teamAgents = agents.filter(agent => 
        team.agentIds?.includes(agent.id.toString())
      );

      teamAgents.forEach((agent, agentIndex) => {
        const agentX = teamX + (agentIndex % 2) * 200 - 50;
        const agentY = teamY + 150 + Math.floor(agentIndex / 2) * 120;

        const agentTasks = tasks.filter(task => task.agentId === agent.id);

        newNodes.push({
          id: `agent-${agent.id}`,
          type: 'agent',
          position: { x: agentX, y: agentY },
          data: { 
            ...agent, 
            type: 'agent',
            teamId: team.id,
            tasks: agentTasks
          },
          selectable: true,
        });

        // Create edge from team to agent
        newEdges.push({
          id: `team-${team.id}-agent-${agent.id}`,
          source: `team-${team.id}`,
          target: `agent-${agent.id}`,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#94a3b8', strokeWidth: 2 },
        });
      });
    });

    // Add agents that aren't in any team
    const unassignedAgents = agents.filter(agent => 
      !teams.some(team => team.agentIds?.includes(agent.id.toString()))
    );

    unassignedAgents.forEach((agent, index) => {
      const agentTasks = tasks.filter(task => task.agentId === agent.id);

      newNodes.push({
        id: `agent-${agent.id}`,
        type: 'agent', 
        position: { x: 50 + index * 220, y: 500 },
        data: { 
          ...agent, 
          type: 'agent',
          tasks: agentTasks
        },
        selectable: true,
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [agents, teams, tasks, setNodes, setEdges]);

  // Generate nodes and edges when data changes
  useEffect(() => {
    generateNodesAndEdges();
  }, [generateNodesAndEdges]);

  // Load view from DB on mount (only if currentOrganization and viewConfig are available)
  useEffect(() => {
    if (!currentOrganization?.viewConfig || nodes.length === 0) return;
    
    try {
      const viewData = currentOrganization.viewConfig as any;
      if (validateViewData(viewData)) {
        // Restore nodes with positions
        if (viewData.nodes && viewData.nodes.length > 0) {
          const restoredNodes = nodes.map(node => {
            const savedNode = viewData.nodes.find((n: any) => n.id === node.id);
            return savedNode ? { ...node, position: savedNode.position } : node;
          });
          setNodes(restoredNodes);
        }
        
        // Restore view state
        if (viewData.viewState) {
          const { selectedNodes: saved_selectedNodes, searchTerm: saved_searchTerm, 
                  isPanelCollapsed: saved_isPanelCollapsed, isConfiguring: saved_isConfiguring } = viewData.viewState;
          
          if (Array.isArray(saved_selectedNodes)) setSelectedNodes(saved_selectedNodes);
          if (typeof saved_searchTerm === 'string') setSearchTerm(saved_searchTerm);
          if (typeof saved_isPanelCollapsed === 'boolean') setIsPanelCollapsed(saved_isPanelCollapsed);
          if (typeof saved_isConfiguring === 'boolean') setIsConfiguring(saved_isConfiguring);
        }
      }
    } catch (error) {
      console.error('Failed to load organization view configuration:', error);
    }
  }, [currentOrganization?.id, currentOrganization?.viewConfig, nodes.length, setNodes]);

  // Debounced auto-save effect
  useEffect(() => {
    if (nodes.length === 0) return; // Don't auto-save until we have data
    
    const timer = setTimeout(() => {
      autoSaveView();
    }, 2000); // Auto-save 2 seconds after last change
    
    return () => clearTimeout(timer);
  }, [nodes, selectedNodes, searchTerm, isPanelCollapsed, isConfiguring, autoSaveView]);

  // Handle node selection with multi-select support
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const isCtrlPressed = event.ctrlKey || event.metaKey;
    
    setSelectedNodes(prevSelected => {
      if (isCtrlPressed) {
        return prevSelected.includes(node.id)
          ? prevSelected.filter(id => id !== node.id)
          : [...prevSelected, node.id];
      } else {
        return prevSelected.includes(node.id) && prevSelected.length === 1
          ? []
          : [node.id];
      }
    });
  }, []);

  // Filter nodes based on search term
  const filteredNodes = useMemo(() => {
    if (!searchTerm) return nodes;
    
    return nodes.filter(node => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const data = node.data as any;
      const name = data.name?.toLowerCase() || '';
      const role = data.role?.toLowerCase() || '';
      const purpose = data.purpose?.toLowerCase() || '';
      
      return name.includes(lowerSearchTerm) || 
             role.includes(lowerSearchTerm) || 
             purpose.includes(lowerSearchTerm);
    });
  }, [nodes, searchTerm]);

  // Get filtered activities based on selected nodes
  const filteredActivities = useMemo(() => {
    if (selectedNodes.length === 0) {
      return tasks;
    }

    const selectedNodeIds = selectedNodes.map(nodeId => {
      if (nodeId.startsWith('team-')) {
        return { type: 'team', id: parseInt(nodeId.replace('team-', '')) };
      } else if (nodeId.startsWith('agent-')) {
        return { type: 'agent', id: parseInt(nodeId.replace('agent-', '')) };
      }
      return null;
    }).filter(Boolean);

    return tasks.filter(task => {
      // Check if task belongs to any selected agent
      const directAgentMatch = selectedNodeIds.some(nodeId => 
        nodeId?.type === 'agent' && nodeId.id === task.agentId
      );

      // Check if task belongs to agent in selected team
      const teamAgentMatch = selectedNodeIds.some(nodeId => {
        if (nodeId?.type === 'team') {
          const team = teams.find(t => t.id === nodeId.id);
          const taskAgent = agents.find(a => a.id === task.agentId);
          return team && taskAgent && team.agentIds?.includes(taskAgent.id.toString());
        }
        return false;
      });

      return directAgentMatch || teamAgentMatch;
    });
  }, [selectedNodes, tasks, teams, agents]);

  // Component can work without currentOrganization for basic functionality
  // currentOrganization is only needed for saving/loading view configurations

  return (
    <ReactFlowProvider>
      <div className="h-full flex">
        <PanelGroup direction="horizontal" className="h-full">
          {!isPanelCollapsed && (
            <>
              <Panel defaultSize={25} minSize={20}>
                <ActivityPanel 
                  activities={filteredActivities}
                  selectedNodes={selectedNodes}
                  onClearSelection={() => setSelectedNodes([])}
                  onCollapse={() => setIsPanelCollapsed(true)}
                />
              </Panel>
              
              <PanelResizeHandle />
            </>
          )}
          
          <Panel defaultSize={isPanelCollapsed ? 100 : 75}>
            <div className="h-full relative">
              {isPanelCollapsed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPanelCollapsed(false)}
                  className="absolute top-4 left-4 z-10 bg-background shadow-lg"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Show Activity
                </Button>
              )}
              <ReactFlow
                nodes={searchTerm ? filteredNodes : nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                connectionMode={ConnectionMode.Loose}
                fitView
                fitViewOptions={{ maxZoom: 0.85 }}
                proOptions={{ hideAttribution: true }}
              >
                <Controls />
                
                {/* Top toolbar */}
                <ReactFlowPanel position="top-center">
                    <Button
                      size="sm"
                      variant={isConfiguring ? "default" : "outline"}
                      onClick={() => setIsConfiguring(!isConfiguring)}
                    >
                      {isConfiguring ? (
                        <>
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-4 h-4 mr-1" />
                          Configure
                        </>
                      )}
                    </Button>
                </ReactFlowPanel>

                {/* Search toolbar */}
                <ReactFlowPanel position="top-right">
                  <div className={`relative flex items-center transition-all duration-300 ${
                    isSearchExpanded ? 'w-64' : 'w-10'
                  }`}>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                      className="z-10 bg-background"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                    <Input
                      placeholder="Search teams or agents..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`pl-10 absolute top-0 left-0 h-full transition-all duration-300 bg-background ${
                        isSearchExpanded ? 'w-full opacity-100' : 'w-0 opacity-0'
                      }`}
                    />
                  </div>
                </ReactFlowPanel>

                {/* Selection info */}
                {selectedNodes.length > 0 && (
                  <ReactFlowPanel position="bottom-center">
                    <div className="bg-primary text-primary-foreground px-3 py-1 rounded-lg text-sm">
                      {selectedNodes.length} node{selectedNodes.length !== 1 ? 's' : ''} selected
                    </div>
                  </ReactFlowPanel>
                )}
              </ReactFlow>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </ReactFlowProvider>
  );
}
