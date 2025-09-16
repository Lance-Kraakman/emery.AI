'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import { useStore } from '@tanstack/react-store';
import { 
  ReactFlow, 
  Node, 
  Edge, 
  Controls, 
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
  Search, 
  Eye,
  Edit3,
  Activity,
  RotateCcw,
} from 'lucide-react';
import { getTasks } from '@/app/actions/tasks';
import type { TaskDTO } from '@/app/mappers/task-mapper';
import TeamNode from './TeamNode';
import AgentNode from './AgentNode';
import ActivityPanel from './ActivityPanel';
import { useEmeryStore } from '@/contexts/EmeryStoreProvider';
import { Loading } from '@/components/ui/loading';
import { useOrganizationViewConfig } from '@/hooks/useOrganizationViewConfig';
import { orgChartStore, orgChartSelectors } from '@/stores/organization-chart.store';
import { storeActions, orgChartActions } from '@/stores/actions';

// Define custom node types
const nodeTypes = {
  team: TeamNode,
  agent: AgentNode,
};

export default function OrganizationChartClient() {
  const { data, currentOrganization, isLoading } = useEmeryStore();
  const { agents, teams } = data;
  
  // Use TanStack Store for organization chart state
  const tasks = useStore(orgChartStore, orgChartSelectors.tasks);
  const isTasksLoading = useStore(orgChartStore, orgChartSelectors.isTasksLoading);
  const isClient = useStore(orgChartStore, orgChartSelectors.isClient);

  // Handle client-side hydration
  useEffect(() => {
    orgChartActions.setIsClient(true);
  }, []);

  // Fetch tasks only once when component mounts and has current organization
  useEffect(() => {
    if (!currentOrganization?.id || tasks.length > 0) return; // Don't refetch if already have data

    orgChartActions.setTasksLoading(true);
    getTasks().then(result => {
      if (result.success) {
        orgChartActions.setTasks(result.data);
      }
    }).finally(() => {
      orgChartActions.setTasksLoading(false);
    });
  }, [currentOrganization?.id]); // Only depend on organization id
  
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const selectedNodes = useStore(orgChartStore, orgChartSelectors.selectedNodes);
  const isConfiguring = useStore(orgChartStore, orgChartSelectors.isConfiguring);
  const searchTerm = useStore(orgChartStore, orgChartSelectors.searchTerm);
  const isSearchExpanded = useStore(orgChartStore, orgChartSelectors.isSearchExpanded);
  const isPanelCollapsed = useStore(orgChartStore, orgChartSelectors.isPanelCollapsed);
  const showResetNotification = useStore(orgChartStore, orgChartSelectors.showResetNotification);

  // Initialize auto-save hook
  const { saveViewConfig, loadViewConfig, isSaving } = useOrganizationViewConfig({
    organizationId: currentOrganization?.id,
    autoSaveDelay: 2000,
    enabled: !!currentOrganization?.id,
  });

  // Convert teams and agents to React Flow nodes
  const generateNodesAndEdges = useCallback(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Create team nodes
    teams.forEach((team, index) => {
      const teamX = 300 + (index + 1) * 20; // Same position with 20px offset (1-based)
      const teamY = 150 + (index + 1) * 20; // Same position with 20px offset (1-based)

      const teamTasks = tasks.filter(task => {
        // Check if any agent in this team matches the task's agentId
        const teamAgents = agents.filter(agent => 
          team.agentIds?.includes(agent.id.toString())
        );
        return teamAgents.some(agent => task.agentId === agent.id);
      });

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
      const agentTasks = (tasks as TaskDTO[]).filter(task => task.agentId === agent.id);

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


  // Reset layout to default positions
  const resetLayout = useCallback(() => {
    const confirmed = window.confirm(
      'Are you sure you want to reset the layout? This will move all nodes back to their default positions and cannot be undone.'
    );
    
    if (confirmed) {
      generateNodesAndEdges();
      
      // Clear selected nodes since positions are changing
      orgChartActions.setSelectedNodes([]);
      
      // Show reset notification briefly
      orgChartActions.setShowResetNotification(true);
      setTimeout(() => orgChartActions.setShowResetNotification(false), 3000);
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

  // Generate nodes and edges when data changes - only on client, and only when we have data
  useEffect(() => {
    if (isClient && agents.length > 0 && nodes.length === 0) {
      // Only generate initially or when data significantly changes
      generateNodesAndEdges();
    }
  }, [agents.length, teams.length, tasks.length, isClient]); // Depend on data length, not the full generateNodesAndEdges function

  // Load view from DB on mount using the custom hook - only on client
  useEffect(() => {
    if (!isClient || !currentOrganization?.viewConfig || nodes.length === 0) return;
    
    const result = loadViewConfig(currentOrganization.viewConfig, nodes);
    
    if (result) {
      setNodes(result.nodes);
      
      if (result.viewState) {
        if (Array.isArray(result.viewState.selectedNodes)) {
          orgChartActions.setSelectedNodes(result.viewState.selectedNodes);
        }
        if (typeof result.viewState.searchTerm === 'string') {
          orgChartActions.setSearchTerm(result.viewState.searchTerm);
        }
        if (typeof result.viewState.isPanelCollapsed === 'boolean') {
          orgChartActions.setPanelCollapsed(result.viewState.isPanelCollapsed);
        }
        if (typeof result.viewState.isConfiguring === 'boolean') {
          orgChartActions.setConfiguring(result.viewState.isConfiguring);
        }
      }
    }
  }, [currentOrganization?.id, currentOrganization?.viewConfig, nodes.length, loadViewConfig, setNodes]);

  // Debounced auto-save effect - only on client and for meaningful changes
  useEffect(() => {
    if (!isClient || nodes.length === 0 || !currentOrganization?.id) return; // Don't auto-save until we have data

    const timer = setTimeout(() => {
      autoSaveView();
    }, 3000); // Increased delay to 3 seconds to reduce frequency

    return () => clearTimeout(timer);
  }, [nodes, isClient, currentOrganization?.id]); // Only trigger auto-save for node changes (positions), not UI state changes

  // Save UI state changes less frequently (every 10 seconds) to avoid constant updates
  useEffect(() => {
    if (!isClient || !currentOrganization?.id) return;

    const timer = setTimeout(() => {
      autoSaveView(); // This will include current UI state
    }, 10000); // Save UI state every 10 seconds

    return () => clearTimeout(timer);
  }, [selectedNodes, searchTerm, isPanelCollapsed, isConfiguring, isClient, currentOrganization?.id]);

  // Handle node selection with multi-select support
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const isCtrlPressed = event.ctrlKey || event.metaKey;
    
    const prevSelected = selectedNodes;
    if (isCtrlPressed) {
      const newSelected = prevSelected.includes(node.id)
        ? prevSelected.filter(id => id !== node.id)
        : [...prevSelected, node.id];
      orgChartActions.setSelectedNodes(newSelected);
    } else {
      const newSelected = prevSelected.includes(node.id) && prevSelected.length === 1
        ? []
        : [node.id];
      orgChartActions.setSelectedNodes(newSelected);
    }
  }, [selectedNodes]);

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

  // Show loading spinner while data is loading or during hydration
  if (isLoading || isTasksLoading || !isClient) {
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
              <Panel defaultSize={30} minSize={25}>
                <ActivityPanel 
                  activities={filteredActivities}
                  selectedNodes={selectedNodes}
                  onClearSelection={() => orgChartActions.setSelectedNodes([])}
                  onCollapse={() => orgChartActions.setPanelCollapsed(true)}
                />
              </Panel>
              
              <PanelResizeHandle />
            </>
          )}
          
          <Panel defaultSize={isPanelCollapsed ? 100 : 70}>
            <div className="h-full relative">
              {isPanelCollapsed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => orgChartActions.setPanelCollapsed(false)}
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
                      onClick={() => orgChartActions.setConfiguring(!isConfiguring)}
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
                      onClick={() => orgChartActions.setSearchExpanded(!isSearchExpanded)}
                      className="z-10 bg-background"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                    <Input
                      placeholder="Search teams or agents..."
                      value={searchTerm}
                      onChange={(e) => orgChartActions.setSearchTerm(e.target.value)}
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