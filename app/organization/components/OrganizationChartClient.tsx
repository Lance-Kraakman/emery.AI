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
import '@/styles/reactflow-custom.css';

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
  RotateCcw,
} from 'lucide-react';
import { getTasks } from '@/app/actions/tasks';

import { Agent, Team } from '@/types/db';
import { Task } from '@/app/actions/types';
import TeamNode from './TeamNode';
import AgentNode from './AgentNode';
import ActivityPanel from './ActivityPanel';
import { useEmery } from '@/contexts/EmeryContext';
import { Loading } from '@/components/ui/loading';
import { useOrganizationViewConfig } from '@/hooks/useOrganizationViewConfig';

// Define custom node types
const nodeTypes = {
  team: TeamNode,
  agent: AgentNode,
};

export default function OrganizationChartClient() {
  const { data, currentOrganization, isLoading } = useEmery();
  const { agents, teams } = data;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTasksLoading, setIsTasksLoading] = useState(true);

  useEffect(() => {
    setIsTasksLoading(true);
    getTasks().then(result => {
      if (result.success) {
        setTasks(result.data);
      }
    }).finally(() => {
      setIsTasksLoading(false);
    });
  }, []);
  
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [showResetNotification, setShowResetNotification] = useState(false);

  // Initialize auto-save hook
  const { saveViewConfig, loadViewConfig, isSaving } = useOrganizationViewConfig({
    organizationId: currentOrganization?.id,
    autoSaveDelay: 2000,
    enabled: !!currentOrganization?.id,
  });

  // Reset layout to default positions
  const resetLayout = useCallback(() => {
    const confirmed = window.confirm(
      'Are you sure you want to reset the layout? This will move all nodes back to their default positions and cannot be undone.'
    );
    
    if (confirmed) {
      generateNodesAndEdges();
      
      // Clear selected nodes since positions are changing
      setSelectedNodes([]);
      
      // Show reset notification briefly
      setShowResetNotification(true);
      setTimeout(() => setShowResetNotification(false), 3000);
    }
  }, [generateNodesAndEdges]);

  // Auto-save view using the custom hook
  const autoSaveView = useCallback(() => {
    if (!currentOrganization?.id || nodes.length === 0) return;

    const viewState = {
      selectedNodes,
      searchTerm,
      isPanelCollapsed,
      isConfiguring,
    };

    saveViewConfig(nodes, edges, viewState);
  }, [nodes, edges, selectedNodes, searchTerm, isPanelCollapsed, isConfiguring, currentOrganization, saveViewConfig]);

  // Convert teams and agents to React Flow nodes
  const generateNodesAndEdges = useCallback(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Create team nodes
    teams.forEach((team, index) => {
      const teamX = 200 + (index % 3) * 400;
      const teamY = 100 + Math.floor(index / 3) * 300;

      // Filter tasks for this team (safely handle missing agentIds)
      const teamTasks = (team.agentIds && team.agentIds.length > 0) 
        ? tasks.filter(task => 
            team.agentIds!.some(agentId => 
              agents.some(agent => agent.id.toString() === agentId && agent.id === task.agentId)
            )
          )
        : [];

      newNodes.push({
        id: `team-${team.id}`,
        type: 'team',
        position: { x: teamX, y: teamY },
        data: { 
          ...team,
          type: 'team',
          tasks: teamTasks
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

    // Set nodes and edges
    setNodes(newNodes);
    setEdges(newEdges);
  }, [agents, teams, tasks, setNodes, setEdges]);

  // Generate nodes and edges when data changes
  useEffect(() => {
    generateNodesAndEdges();
  }, [generateNodesAndEdges]);

  // Load view from DB on mount using the custom hook
  useEffect(() => {
    if (!currentOrganization?.viewConfig || nodes.length === 0) return;
    
    const result = loadViewConfig(currentOrganization.viewConfig, nodes);
    
    if (result) {
      setNodes(result.nodes);
      
      if (result.viewState) {
        if (Array.isArray(result.viewState.selectedNodes)) {
          setSelectedNodes(result.viewState.selectedNodes);
        }
        if (typeof result.viewState.searchTerm === 'string') {
          setSearchTerm(result.viewState.searchTerm);
        }
        if (typeof result.viewState.isPanelCollapsed === 'boolean') {
          setIsPanelCollapsed(result.viewState.isPanelCollapsed);
        }
        if (typeof result.viewState.isConfiguring === 'boolean') {
          setIsConfiguring(result.viewState.isConfiguring);
        }
      }
    }
  }, [currentOrganization?.id, currentOrganization?.viewConfig, nodes.length, loadViewConfig, setNodes]);

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

  // Show loading spinner while data is loading
  if (isLoading || isTasksLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loading text="Loading organization chart..." />
      </div>
    );
  }

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
                  <div className="flex items-center gap-2">
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
                    
                    {/* Reset Layout Button - only show in configure mode */}
                    {isConfiguring && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={resetLayout}
                        title="Reset layout to default positions"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Reset Layout
                      </Button>
                    )}
                  </div>
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

                {/* Status indicators - Save or Reset notification */}
                {isSaving ? (
                  <ReactFlowPanel position="bottom-left">
                    <div className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </div>
                  </ReactFlowPanel>
                ) : showResetNotification ? (
                  <ReactFlowPanel position="bottom-left">
                    <div className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2">
                      <RotateCcw className="w-3 h-3" />
                      Layout reset to default positions
                    </div>
                  </ReactFlowPanel>
                ) : null}

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