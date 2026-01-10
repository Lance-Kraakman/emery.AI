'use client';

/**
 * OrgChartEditorClient Component
 *
 * Main client component for the org chart editor.
 * Wraps OrgChartCanvas with side panel configuration.
 */

import React, { useState, useCallback, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
import { createAgent } from '@/app/actions/agents';
import { createSkill } from '@/app/actions/skills';
import { createDatabase } from '@/app/actions/databases';
import type { OrgChartNodeType, OrgChartCanvasMetadata } from '@/components/org-chart/types';

interface OrgChartEditorClientProps {
  /** Initial agents */
  agents: Array<{
    id: number;
    name: string;
    role?: string;
    status?: string;
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

  // Selection state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeType, setSelectedNodeType] = useState<OrgChartNodeType | undefined>();
  const [selectedEntityId, setSelectedEntityId] = useState<number | undefined>();

  // Handle selection from canvas
  const handleSelect = useCallback(
    (nodeId: string | null, nodeType?: OrgChartNodeType, entityId?: number) => {
      setSelectedNodeId(nodeId);
      setSelectedNodeType(nodeType);
      setSelectedEntityId(entityId);
    },
    []
  );

  // Handle opening an entity (navigate to editor)
  const handleOpenEntity = useCallback(
    (entityType: OrgChartNodeType, entityId: number) => {
      switch (entityType) {
        case 'agent':
          router.push(`/agents/${entityId}`);
          break;
        case 'skill':
          // Find the agent ID for this skill to build the correct URL
          const skill = skills.find((s) => s.id === entityId);
          if (skill?.agentId) {
            router.push(`/agents/${skill.agentId}/skills?skillId=${entityId}`);
          } else {
            // Org-level skill - need to handle differently
            // For now, navigate to first agent that has access
            router.push(`/agents?skillId=${entityId}`);
          }
          break;
        case 'database':
          // Navigate to data page with database ID
          router.push(`/data/${entityId}`);
          break;
        case 'app':
          // Navigate to app builder
          router.push(`/apps/${entityId}`);
          break;
        default:
          break;
      }
    },
    [router, skills, databases]
  );

  // Loading state for entity creation
  const [isPending, startTransition] = useTransition();

  // Close panel
  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeType(undefined);
    setSelectedEntityId(undefined);
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
                  onClick: () => router.push(`/agents/${effectiveAgentId}/skills?skillId=${skillResult.data!.id}`),
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

  // Render config panel based on selected node type
  const renderConfigPanel = () => {
    if (selectedNodeType === 'agent' && selectedAgent) {
      return (
        <AgentConfigPanel
          agent={selectedAgent}
          skillCount={agentSkillCount}
          databaseCount={agentDatabaseCount}
          onOpenAgent={() => handleOpenEntity('agent', selectedAgent.id)}
        />
      );
    }

    if (selectedNodeType === 'skill' && selectedSkill) {
      return (
        <SkillConfigPanel
          skill={selectedSkill}
          agentName={getAgentName(selectedSkill.agentId)}
          onOpenEditor={() => handleOpenEntity('skill', selectedSkill.id)}
        />
      );
    }

    if (selectedNodeType === 'database' && selectedDatabase) {
      return (
        <DatabaseConfigPanel
          database={selectedDatabase}
          agentName={getAgentName(selectedDatabase.agentId)}
          onOpenData={() => handleOpenEntity('database', selectedDatabase.id)}
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
          canvasMetadata={canvasMetadata}
          onSelect={handleSelect}
          onOpenEntity={handleOpenEntity}
          onCreateEntity={handleCreateEntity}
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
    </ReactFlowProvider>
  );
}

export default OrgChartEditorClient;
