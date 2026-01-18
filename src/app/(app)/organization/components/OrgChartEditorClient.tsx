'use client';

/**
 * OrgChartEditorClient Component
 *
 * Main client component for the org chart editor.
 * Wraps OrgChartCanvas with side panel configuration.
 */

import React, { useState, useCallback, useMemo, useTransition, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReactFlowProvider } from '@xyflow/react';
import { X, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { OrgChartCanvas } from './OrgChartCanvas';
import {
  AgentConfigPanel,
  SkillConfigPanel,
  DatabaseConfigPanel,
} from '@/components/org-chart/panels';
import { useOrgChartSession } from '@/components/org-chart/hooks';
import { createAgent, deleteAgent } from '@/app/actions/agents';
import { createSkill, deleteSkill } from '@/app/actions/skills';
import { createDatabase, deleteDatabase } from '@/app/actions/databases';
import { getContextMappings, type ContextMappingDTO } from '@/app/actions/context-mappings';
import { TriggerConfigModal } from '@/app/(app)/agents/components/modals/TriggerConfigModal';
import { CreateTableDialog } from '@/app/(app)/data/components/CreateTableDialog';
import { useEmeryAgent } from '@/contexts/EmeryStoreProvider';
import type { OrgChartNodeType, OrgChartCanvasMetadata } from '@/components/org-chart/types';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { DataSourceMapping } from '@/components/org-chart/edgeUtils';

interface OrgChartEditorClientProps {
  /** Initial agents */
  agents: Array<{
    id: number;
    name: string;
    role?: string;
    status?: string;
    automations?: Array<{
      name?: string;
      enabled: boolean;
      skillId: number;
      trigger: { type: string; enabled: boolean };
    }>;
  }>;
  /** Initial skills */
  skills: Array<{
    id: number;
    name: string;
    executionType?: string;
    agentId?: number | null;
  }>;
  /** Initial databases */
  databases: Array<{
    id: number;
    name: string;
    slug: string;
    agentId?: number | null;
    tableCount?: number;
    tables?: Array<{
      id: number;
      name: string;
      slug: string;
      rowCount?: number;
    }>;
  }>;
  /** Saved canvas metadata */
  canvasMetadata?: OrgChartCanvasMetadata;
}

export function OrgChartEditorClient({
  agents,
  skills,
  databases,
  canvasMetadata,
}: OrgChartEditorClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial selection from URL (for restoring state after navigation)
  const initialSelectedFromUrl = searchParams.get('selected');

  // Session-based state persistence (selected node, viewport)
  const {
    selectedNodeId: sessionSelectedNodeId,
    setSelectedNodeId: setSessionSelectedNodeId,
    viewport: sessionViewport,
    setViewport: setSessionViewport,
  } = useOrgChartSession({
    initialSelectedNodeId: initialSelectedFromUrl,
    initialViewport: canvasMetadata?.viewport,
  });

  // Derived selection state from session
  const selectedNodeId = sessionSelectedNodeId;
  const [selectedNodeType, setSelectedNodeType] = useState<OrgChartNodeType | undefined>(() => {
    if (!sessionSelectedNodeId) return undefined;
    const match = sessionSelectedNodeId.match(/^([a-z_]+)-(\d+)$/);
    return match ? match[1] as OrgChartNodeType : undefined;
  });
  const [selectedEntityId, setSelectedEntityId] = useState<number | undefined>(() => {
    if (!sessionSelectedNodeId) return undefined;
    const match = sessionSelectedNodeId.match(/^([a-z_]+)-(\d+)$/);
    return match ? parseInt(match[2], 10) : undefined;
  });

  // Sync selection type/id when session selected node changes
  useEffect(() => {
    if (sessionSelectedNodeId) {
      const match = sessionSelectedNodeId.match(/^([a-z_]+)-(\d+)$/);
      if (match) {
        setSelectedNodeType(match[1] as OrgChartNodeType);
        setSelectedEntityId(parseInt(match[2], 10));
      }
    } else {
      setSelectedNodeType(undefined);
      setSelectedEntityId(undefined);
    }
  }, [sessionSelectedNodeId]);

  // Wrapper to update session selected node
  const setSelectedNodeId = useCallback((nodeId: string | null) => {
    setSessionSelectedNodeId(nodeId);
  }, [setSessionSelectedNodeId]);

  // Trigger config modal state (lifted from AgentConfigPanel for proper overlay)
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [triggerModalMode, setTriggerModalMode] = useState<'create' | 'edit'>('create');
  const [triggerModalAgentId, setTriggerModalAgentId] = useState<number | null>(null);
  const [triggerModalScheduleIndex, setTriggerModalScheduleIndex] = useState<number | undefined>();

  // Get full agent data for modal (only when modal needs to open)
  const triggerModalAgent = useEmeryAgent(triggerModalAgentId ?? 0) as AgentDTO | undefined;

  // Create table dialog state (lifted from DatabaseConfigPanel for proper overlay)
  const [createTableDatabaseId, setCreateTableDatabaseId] = useState<number | null>(null);

  // Connected edges for selected skill (passed from canvas on selection)
  const [selectedEdges, setSelectedEdges] = useState<
    Array<{ id: string; target: string; edgeType: string; tableId?: number }>
  >([]);

  // Data sources for all agents (context mappings)
  const [dataSources, setDataSources] = useState<DataSourceMapping[]>([]);

  // Load data sources for all agents
  useEffect(() => {
    const loadDataSources = async () => {
      const allMappings: DataSourceMapping[] = [];

      // Load data sources for each agent
      for (const agent of agents) {
        try {
          const mappings = await getContextMappings('agent', String(agent.id));
          allMappings.push(
            ...mappings.map((m) => ({
              id: m.id,
              targetType: m.targetType,
              targetId: m.targetId,
              tableId: m.tableId,
              tableName: m.tableName,
              accessMode: m.accessMode,
            }))
          );
        } catch (error) {
          console.error(`Failed to load data sources for agent ${agent.id}:`, error);
        }
      }

      // Also load skill-level data sources
      for (const skill of skills) {
        try {
          const mappings = await getContextMappings('skill', String(skill.id));
          allMappings.push(
            ...mappings.map((m) => ({
              id: m.id,
              targetType: m.targetType,
              targetId: m.targetId,
              tableId: m.tableId,
              tableName: m.tableName,
              accessMode: m.accessMode,
            }))
          );
        } catch (error) {
          console.error(`Failed to load data sources for skill ${skill.id}:`, error);
        }
      }

      setDataSources(allMappings);
    };

    loadDataSources();
  }, [agents, skills]);

  // Handle selection from canvas - includes connected edges for skills
  const handleSelect = useCallback(
    (
      nodeId: string | null,
      nodeType?: OrgChartNodeType,
      entityId?: number,
      connectedEdges?: Array<{ id: string; target: string; edgeType: string; tableId?: number }>
    ) => {
      console.log('[OrgChartEditorClient] handleSelect called:', { nodeId, nodeType, entityId, connectedEdges });
      setSelectedNodeId(nodeId);
      setSelectedNodeType(nodeType);
      setSelectedEntityId(entityId);
      setSelectedEdges(connectedEdges || []);
    },
    []
  );

  // Build return URL with selected node for state preservation
  const buildReturnUrl = useCallback((nodeId?: string) => {
    const selected = nodeId || selectedNodeId;
    return selected ? `org-chart&selected=${selected}` : 'org-chart';
  }, [selectedNodeId]);

  // Handle opening an entity (navigate to editor)
  const handleOpenEntity = useCallback(
    (entityType: OrgChartNodeType, entityId: number) => {
      const nodeId = `${entityType}-${entityId}`;
      const returnTo = buildReturnUrl(nodeId);

      switch (entityType) {
        case 'agent':
          router.push(`/agents/${entityId}?returnTo=${encodeURIComponent(returnTo)}`);
          break;
        case 'skill':
          // Find the agent ID for this skill to build the correct URL
          const skill = skills.find((s) => s.id === entityId);
          if (skill?.agentId) {
            router.push(`/agents/${skill.agentId}/skills/${entityId}?returnTo=${encodeURIComponent(returnTo)}`);
          } else {
            // Org-level skill
            router.push(`/skills/${entityId}?returnTo=${encodeURIComponent(returnTo)}`);
          }
          break;
        case 'database':
          // No database-specific page - users click individual tables instead
          // Double-clicking a database just selects it (shows side panel)
          break;
        default:
          break;
      }
    },
    [router, skills, databases, buildReturnUrl]
  );

  // Loading state for entity creation
  const [isPending, startTransition] = useTransition();

  // Close panel
  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeType(undefined);
    setSelectedEntityId(undefined);
  }, []);

  // Handle opening trigger config modal (from AgentConfigPanel)
  const handleOpenTriggerModal = useCallback(
    (agentId: number, mode: 'create' | 'edit', scheduleIndex?: number) => {
      setTriggerModalAgentId(agentId);
      setTriggerModalMode(mode);
      setTriggerModalScheduleIndex(scheduleIndex);
      setTriggerModalOpen(true);
    },
    []
  );

  // Handle closing trigger config modal
  const handleCloseTriggerModal = useCallback(() => {
    setTriggerModalOpen(false);
    setTriggerModalAgentId(null);
    setTriggerModalScheduleIndex(undefined);
  }, []);

  // Handle creating a new entity - returns the created entity for node creation
  const handleCreateEntity = useCallback(
    async (entityType: OrgChartNodeType, agentId?: number): Promise<{ id: number; name: string; [key: string]: any } | null> => {
      // Show loading toast immediately
      const entityLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);
      const loadingToastId = toast.loading(`Creating ${entityLabel}...`);

      try {
        switch (entityType) {
          case 'agent': {
            const result = await createAgent({
              name: 'New Agent',
              role: '',
            });
            toast.dismiss(loadingToastId);
            if (result.success && result.data?.id) {
              toast.success('Agent created', {
                action: {
                  label: 'Configure',
                  onClick: () => router.push(`/agents/${result.data!.id}`),
                },
              });
              return result.data;
            } else {
              toast.error(result.error || 'Failed to create agent');
              return null;
            }
          }

          case 'skill': {
            // Skills require an agent ID
            // If no agent ID provided, we need to pick one
            let effectiveAgentId = agentId;
            if (!effectiveAgentId && agents.length > 0) {
              // Use first agent as default
              effectiveAgentId = agents[0].id;
            }

            if (!effectiveAgentId) {
              toast.dismiss(loadingToastId);
              toast.error('Create an agent first before adding skills');
              return null;
            }

            const skillResult = await createSkill({
              agentId: effectiveAgentId,
              name: 'New Skill',
            });
            toast.dismiss(loadingToastId);
            if (skillResult.success && skillResult.data?.id) {
              toast.success('Skill created', {
                action: {
                  label: 'Edit',
                  onClick: () => router.push(`/agents/${effectiveAgentId}/skills/${skillResult.data!.id}`),
                },
              });
              return { ...skillResult.data, agentId: effectiveAgentId };
            } else {
              toast.error(skillResult.error || 'Failed to create skill');
              return null;
            }
          }

          case 'database': {
            const dbResult = await createDatabase({
              name: 'New Database',
              agentId: agentId ?? null, // null = org-scoped
            });
            toast.dismiss(loadingToastId);
            if (dbResult.success && dbResult.data?.id) {
              toast.success('Database created', {
                action: {
                  label: 'Open',
                  onClick: () => router.push(`/data/${dbResult.data!.id}`),
                },
              });
              return { ...dbResult.data, agentId: agentId ?? null };
            } else {
              toast.error(dbResult.error || 'Failed to create database');
              return null;
            }
          }

          default:
            toast.dismiss(loadingToastId);
            return null;
        }
      } catch (error) {
        console.error('Error creating entity:', error);
        toast.dismiss(loadingToastId);
        toast.error('An error occurred while creating the entity');
        return null;
      }
    },
    [router, agents]
  );

  // Get selected entity data
  const selectedAgent = useMemo(() => {
    if (selectedNodeType === 'agent' && selectedEntityId) {
      return agents.find((a) => a.id === selectedEntityId);
    }
    return undefined;
  }, [selectedNodeType, selectedEntityId, agents]);

  const selectedSkill = useMemo(() => {
    if (selectedNodeType === 'skill' && selectedEntityId) {
      return skills.find((s) => s.id === selectedEntityId);
    }
    return undefined;
  }, [selectedNodeType, selectedEntityId, skills]);

  const selectedDatabase = useMemo(() => {
    if (selectedNodeType === 'database' && selectedEntityId) {
      return databases.find((d) => d.id === selectedEntityId);
    }
    return undefined;
  }, [selectedNodeType, selectedEntityId, databases]);

  // Count resources for agent panel
  const agentSkillCount = useMemo(() => {
    if (!selectedAgent) return 0;
    return skills.filter((s) => s.agentId === selectedAgent.id).length;
  }, [selectedAgent, skills]);

  const agentDatabaseCount = useMemo(() => {
    if (!selectedAgent) return 0;
    return databases.filter((d) => d.agentId === selectedAgent.id).length;
  }, [selectedAgent, databases]);

  // Get agent name for skill/database panels
  const getAgentName = (agentId: number | null | undefined) => {
    if (!agentId) return undefined;
    const agent = agents.find((a) => a.id === agentId);
    return agent?.name;
  };

  // Handle deleting entities
  const handleDeleteEntities = useCallback(
    async (items: Array<{ type: OrgChartNodeType; entityId: number }>): Promise<boolean> => {
      const loadingToastId = toast.loading(`Deleting ${items.length} item${items.length !== 1 ? 's' : ''}...`);

      try {
        // Delete in order: agents first (will cascade delete skills), then skills, then databases
        const agents = items.filter((i) => i.type === 'agent');
        const skills = items.filter((i) => i.type === 'skill');
        const databases = items.filter((i) => i.type === 'database');

        let hasError = false;

        // Delete agents (cascades to their skills)
        for (const item of agents) {
          const result = await deleteAgent(item.entityId);
          if (!result.success) {
            console.error(`Failed to delete agent ${item.entityId}:`, result.error);
            hasError = true;
          }
        }

        // Delete skills (skip if parent agent was deleted)
        const deletedAgentIds = new Set(agents.map((a) => a.entityId));
        for (const item of skills) {
          // Check if this skill's agent was deleted
          const skill = items.find((s) => s.type === 'skill' && s.entityId === item.entityId);
          const skillData = items.find((s) => s.entityId === item.entityId);
          // Just try to delete - server will handle if already gone
          const result = await deleteSkill(item.entityId);
          if (!result.success && !result.error?.includes('not found')) {
            console.error(`Failed to delete skill ${item.entityId}:`, result.error);
            hasError = true;
          }
        }

        // Delete databases
        for (const item of databases) {
          const result = await deleteDatabase(item.entityId);
          if (!result.success) {
            console.error(`Failed to delete database ${item.entityId}:`, result.error);
            hasError = true;
          }
        }

        toast.dismiss(loadingToastId);

        if (hasError) {
          toast.error('Some items could not be deleted');
          return false;
        } else {
          toast.success(`Deleted ${items.length} item${items.length !== 1 ? 's' : ''}`);
          // Clear selection
          setSelectedNodeId(null);
          setSelectedNodeType(undefined);
          setSelectedEntityId(undefined);
          return true;
        }
      } catch (error) {
        console.error('Error deleting entities:', error);
        toast.dismiss(loadingToastId);
        toast.error('An error occurred while deleting');
        return false;
      }
    },
    []
  );

  // Render config panel based on selected node type
  const renderConfigPanel = () => {
    if (selectedNodeType === 'agent' && selectedAgent) {
      // Get skill names for automation display
      const getSkillName = (skillId: number) => {
        const skill = skills.find((s) => s.id === skillId);
        return skill?.name;
      };

      return (
        <AgentConfigPanel
          agent={selectedAgent}
          skillCount={agentSkillCount}
          databaseCount={agentDatabaseCount}
          onOpenAgent={() => handleOpenEntity('agent', selectedAgent.id)}
          getSkillName={getSkillName}
          onOpenTriggerModal={(mode, scheduleIndex) =>
            handleOpenTriggerModal(selectedAgent.id, mode, scheduleIndex)
          }
        />
      );
    }

    if (selectedNodeType === 'skill' && selectedSkill) {
      // selectedEdges already contains edges where this skill is the source
      // Each edge has { id, target, edgeType }

      // Get connected database info (for skill_table edges)
      const connectedDatabaseIds = selectedEdges
        .filter((e) => e.target.startsWith('database-'))
        .map((e) => parseInt(e.target.replace('database-', ''), 10));
      const connectedDatabases = databases.filter((d) => connectedDatabaseIds.includes(d.id));

      // Get connected skill info (for skill_ref edges)
      const connectedSkillIds = selectedEdges
        .filter((e) => e.target.startsWith('skill-'))
        .map((e) => parseInt(e.target.replace('skill-', ''), 10));
      const connectedSkillsList = skills.filter((s) => connectedSkillIds.includes(s.id));

      // Get agent-level data sources for inheritance display
      const agentDataSources = selectedSkill.agentId
        ? dataSources.filter(
            (ds) => ds.targetType === 'agent' && ds.targetId === String(selectedSkill.agentId)
          )
        : [];

      // Get skill-level data sources
      const skillDataSources = dataSources.filter(
        (ds) => ds.targetType === 'skill' && ds.targetId === String(selectedSkill.id)
      );

      // Refresh data sources callback
      const handleDataSourcesChange = async () => {
        // Reload data sources for this skill
        try {
          const mappings = await getContextMappings('skill', String(selectedSkill.id));
          const updatedSkillSources = mappings.map((m) => ({
            id: m.id,
            targetType: m.targetType,
            targetId: m.targetId,
            tableId: m.tableId,
            tableName: m.tableName,
            accessMode: m.accessMode,
          }));
          // Update dataSources state by replacing skill's entries
          setDataSources((prev) => [
            ...prev.filter((ds) => !(ds.targetType === 'skill' && ds.targetId === String(selectedSkill.id))),
            ...updatedSkillSources,
          ]);
        } catch (error) {
          console.error('Failed to refresh skill data sources:', error);
        }
      };

      return (
        <SkillConfigPanel
          skill={selectedSkill}
          agentName={getAgentName(selectedSkill.agentId)}
          onOpenEditor={() => handleOpenEntity('skill', selectedSkill.id)}
          edges={selectedEdges}
          databases={connectedDatabases}
          connectedSkills={connectedSkillsList}
          agentDataSources={agentDataSources}
          skillDataSources={skillDataSources}
          onDataSourcesChange={handleDataSourcesChange}
        />
      );
    }

    if (selectedNodeType === 'database' && selectedDatabase) {
      return (
        <DatabaseConfigPanel
          database={selectedDatabase}
          agentName={getAgentName(selectedDatabase.agentId)}
          onAddTable={() => setCreateTableDatabaseId(selectedDatabase.id)}
        />
      );
    }

    // Sticky note or org_resources - no config panel
    return (
      <div className="text-center text-muted-foreground py-8">
        <p className="text-sm">
          {selectedNodeType === 'sticky'
            ? 'Double-click to edit note'
            : 'No configuration available'}
        </p>
      </div>
    );
  };

  return (
    <ReactFlowProvider>
      <div className="relative h-full w-full">
        {/* Full-height Canvas */}
        <OrgChartCanvas
          agents={agents}
          skills={skills}
          databases={databases}
          dataSources={dataSources}
          canvasMetadata={canvasMetadata}
          onSelect={handleSelect}
          onOpenEntity={handleOpenEntity}
          onCreateEntity={handleCreateEntity}
          onDeleteEntities={handleDeleteEntities}
          initialViewport={sessionViewport}
          onViewportChange={setSessionViewport}
        />

        {/* Floating Config Panel - matching skill editor style */}
        {selectedNodeId && selectedNodeType && (
          <div
            className={cn(
              'absolute top-2 right-2 w-80 max-h-[calc(100%-1rem)] bg-background/50 backdrop-blur-sm border rounded-lg shadow-lg overflow-hidden flex flex-col',
              'transition-all duration-200'
            )}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {selectedNodeType === 'org_resources'
                    ? 'Organization Resources'
                    : selectedNodeType === 'sticky'
                      ? 'Note'
                      : `${selectedNodeType.charAt(0).toUpperCase() + selectedNodeType.slice(1)} Details`}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleClosePanel}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto p-3">{renderConfigPanel()}</div>
          </div>
        )}
      </div>

      {/* Trigger Config Modal - rendered at root level for proper overlay */}
      {triggerModalAgent && triggerModalAgentId && (
        <TriggerConfigModal
          isOpen={triggerModalOpen}
          onClose={handleCloseTriggerModal}
          agent={triggerModalAgent}
          onUpdate={() => router.refresh()}
          mode={triggerModalMode}
          scheduleIndex={triggerModalScheduleIndex}
        />
      )}

      {/* Create Table Dialog - rendered at root level for proper overlay */}
      {createTableDatabaseId !== null && (
        <CreateTableDialog
          isOpen={true}
          onClose={() => setCreateTableDatabaseId(null)}
          onTableCreated={() => router.refresh()}
          selectedDatabaseId={createTableDatabaseId}
          returnTo="org-chart"
        />
      )}
    </ReactFlowProvider>
  );
}

export default OrgChartEditorClient;
