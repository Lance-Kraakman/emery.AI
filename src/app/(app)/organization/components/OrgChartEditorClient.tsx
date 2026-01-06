'use client';

/**
 * OrgChartEditorClient Component
 *
 * Main client component for the org chart editor.
 * Wraps OrgChartCanvas with side panel configuration.
 */

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ReactFlowProvider } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { OrgChartCanvas } from './OrgChartCanvas';
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
          // Navigate to data page with database selected
          const db = databases.find((d) => d.id === entityId);
          if (db) {
            router.push(`/data/${db.slug}`);
          }
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

  return (
    <ReactFlowProvider>
      <div className="flex h-full w-full">
        {/* Main canvas area */}
        <div className="flex-1 h-full">
          <OrgChartCanvas
            agents={agents}
            skills={skills}
            databases={databases}
            canvasMetadata={canvasMetadata}
            onSelect={handleSelect}
            onOpenEntity={handleOpenEntity}
          />
        </div>

        {/* Side panel (shown when something is selected) */}
        {selectedNodeId && selectedNodeType && (
          <div
            className={cn(
              'w-80 border-l bg-card overflow-y-auto',
              'transition-all duration-200'
            )}
          >
            <div className="p-4">
              <h3 className="font-semibold text-sm mb-4 capitalize">
                {selectedNodeType === 'org_resources' ? 'Organization' : selectedNodeType} Details
              </h3>

              {/* Placeholder content - will be replaced with actual config panels */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground">ID</label>
                  <p className="text-sm">{selectedEntityId ?? 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Node ID</label>
                  <p className="text-sm font-mono text-xs">{selectedNodeId}</p>
                </div>

                {/* Action buttons */}
                <div className="pt-4 space-y-2">
                  {(selectedNodeType === 'skill' ||
                    selectedNodeType === 'agent' ||
                    selectedNodeType === 'database') && (
                    <button
                      onClick={() =>
                        selectedEntityId && handleOpenEntity(selectedNodeType, selectedEntityId)
                      }
                      className="w-full px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      Open{' '}
                      {selectedNodeType === 'skill'
                        ? 'Editor'
                        : selectedNodeType === 'database'
                          ? 'Data'
                          : 'Agent'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ReactFlowProvider>
  );
}

export default OrgChartEditorClient;
