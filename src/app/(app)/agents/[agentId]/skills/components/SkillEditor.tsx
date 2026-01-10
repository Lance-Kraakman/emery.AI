'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { WorkflowCanvas } from '@/components/workflow-canvas';
import { X, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ShareButton } from '@/components/permissions/ShareButton';
import { ModelSelector } from '@/components/ai/ModelSelector';
import { SaveStatusIndicator, type SaveStatus } from '@/components/ui/save-status-indicator';
import type { InputDefinition, OutputDefinition } from '@/app/mappers/skill-mapper';
import type { SkillStep, CanvasMetadata } from '@/ddd/domain/skills/entities/skill';
import type { FlowToStepsResult } from '@/components/workflow-canvas/utils/flow-converters';
import type { WorkflowNode, WorkflowNodeData, WorkflowEdge } from '@/components/workflow-canvas/types';
import type { WorkflowVariable } from '@/components/workflow-canvas/WorkflowVariableInput';
import { inferVariablesForNode } from '@/components/workflow-canvas/utils/variable-inference';
import { NodeConfigContent } from './NodeConfigContent';
import { RootSkillConfig } from './RootSkillConfig';

/**
 * Simplified SkillFormData - all skills are now workflows
 * Node-specific configs live inside the steps (SkillStep[])
 */
export interface SkillFormData {
  name: string;
  description: string;
  inputs: InputDefinition[];
  outputs: OutputDefinition[];
  steps: SkillStep[];
  canvasMetadata?: CanvasMetadata; // Canvas annotations (sticky notes)
  model?: string | null;
}

/**
 * Header controls for floating panels (passed from EditSkillView)
 */
export interface SkillEditorHeaderControls {
  name: string;
  onNameChange: (name: string) => void;
  saveStatus: SaveStatus;
  model?: string | null;
  onModelChange: (model: string | null) => void;
  agentDefaultModel: string;
  isDeleting: boolean;
  onDelete: () => void;
  skillId: number;
  onShareClick: () => void;
  organizationTier: 'free' | 'pro' | 'max' | 'enterprise';
}

interface SkillEditorProps {
  value: SkillFormData;
  onChange: (value: SkillFormData) => void;
  agentId?: number | null;
  skillId?: number;
  agentDefaultModel?: string | null;
  organizationTier?: 'free' | 'pro' | 'max' | 'enterprise';
  availableModels?: string[];
  availableSkills?: { id: number; name: string }[];
  isReadOnly?: boolean;
  /** Header controls for floating panels (passed from EditSkillView) */
  headerControls?: SkillEditorHeaderControls;
}

/**
 * Unified Skill Editor with Workflow Canvas
 *
 * Full-height canvas with floating config panel overlay.
 * Panel shows node config when selected, root I/O config when nothing selected.
 */
export function SkillEditor({
  value,
  onChange,
  skillId,
  organizationTier = 'free',
  availableSkills = [],
  isReadOnly = false,
  headerControls,
}: SkillEditorProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const updateNodeRef = useRef<((id: string, data: Partial<WorkflowNodeData>) => void) | null>(null);
  const renameNodeRef = useRef<((id: string, newName: string) => void) | null>(null);
  const deleteNodeRef = useRef<((id: string) => void) | null>(null);

  const handleCanvasChange = useCallback((result: FlowToStepsResult) => {
    onChange({ ...value, steps: result.steps, canvasMetadata: result.canvasMetadata });
  }, [onChange, value]);

  const handleNodeSelect = useCallback((id: string | null) => {
    setSelectedNodeId(id);
  }, []);

  const handleNodesChange = useCallback((newNodes: WorkflowNode[]) => {
    setNodes(newNodes);
  }, []);

  const handleEdgesChange = useCallback((newEdges: WorkflowEdge[]) => {
    setEdges(newEdges);
  }, []);

  const handleUpdateNodeRef = useCallback((fn: (id: string, data: Partial<WorkflowNodeData>) => void) => {
    updateNodeRef.current = fn;
  }, []);

  const handleUpdateNode = useCallback((id: string, data: Partial<WorkflowNodeData>) => {
    updateNodeRef.current?.(id, data);
  }, []);

  const handleRenameNodeRef = useCallback((fn: (id: string, newName: string) => void) => {
    renameNodeRef.current = fn;
  }, []);

  const handleRenameNode = useCallback((id: string, newName: string) => {
    renameNodeRef.current?.(id, newName);
  }, []);

  const handleDeleteNodeRef = useCallback((fn: (id: string) => void) => {
    deleteNodeRef.current = fn;
  }, []);

  const handleDeleteNode = useCallback(() => {
    if (selectedNodeId) {
      deleteNodeRef.current?.(selectedNodeId);
      setSelectedNodeId(null);
    }
  }, [selectedNodeId]);

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  // Build workflow variables from skill inputs and upstream node outputs
  // Uses auto-inference based on node types and connections
  const workflowVariables = useMemo((): WorkflowVariable[] => {
    return inferVariablesForNode(selectedNodeId, nodes, edges, value.inputs);
  }, [selectedNodeId, nodes, edges, value.inputs]);

  // Node type labels for panel header
  const nodeTypeLabels: Record<string, string> = {
    instruction: 'Instruction',
    skillRef: 'Skill Reference',
    condition: 'Condition',
    loop: 'Loop',
    agentic: 'Agentic',
    operation: 'Operation',
    tool: 'Tool',
    write: 'Write',
  };

  return (
    <div className="relative h-full w-full">
      {/* Full-height Canvas - uncontrolled mode */}
      <WorkflowCanvas
        steps={value.steps || []}
        canvasMetadata={value.canvasMetadata}
        onChange={handleCanvasChange}
        skillInputs={value.inputs}
        availableSkills={availableSkills}
        disabled={isReadOnly}
        showConfigPanel={false}
        onNodeSelect={handleNodeSelect}
        onNodesExpose={handleNodesChange}
        onEdgesExpose={handleEdgesChange}
        onUpdateNodeExpose={handleUpdateNodeRef}
        onRenameNodeExpose={handleRenameNodeRef}
        onDeleteNodeExpose={handleDeleteNodeRef}
      />

      {/* Floating Name Panel - positioned after NodePalette (w-48 + margin) */}
      {headerControls && (
        <div className="absolute top-2 left-56 z-10 flex items-center gap-2 bg-background/50 backdrop-blur-sm border rounded-lg shadow-sm px-3 py-2">
          <Input
            value={headerControls.name}
            onChange={(e) => headerControls.onNameChange(e.target.value)}
            placeholder="Skill name..."
            className="h-8 w-48 text-sm bg-transparent border-0 focus-visible:ring-1"
          />
          <SaveStatusIndicator status={headerControls.saveStatus} />
        </div>
      )}

      {/* Floating Config Panel (Right) */}
      <div
        className={cn(
          'absolute top-2 right-2 z-10 w-80 max-h-[calc(100%-1rem)] bg-background/50 backdrop-blur-sm border rounded-lg shadow-lg overflow-hidden flex flex-col',
          'transition-all duration-200'
        )}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {selectedNode
                ? nodeTypeLabels[selectedNode.type] || 'Node'
                : 'Skill Config'}
            </span>
          </div>
          {selectedNode ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDeleteNode}
                title="Delete node (Delete/Backspace)"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setSelectedNodeId(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : headerControls ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={headerControls.onDelete}
                disabled={headerControls.isDeleting}
                title="Delete skill"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <ShareButton
                resourceType="skill"
                resourceId={headerControls.skillId}
                onShare={headerControls.onShareClick}
                variant="ghost"
                size="sm"
              />
            </div>
          ) : null}
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {selectedNode ? (
            <NodeConfigContent
              node={selectedNode}
              onUpdateNode={handleUpdateNode}
              onRenameNode={handleRenameNode}
              skillInputs={value.inputs}
              availableSkills={availableSkills}
              workflowVariables={workflowVariables}
              organizationTier={organizationTier}
              skillId={skillId}
              disabled={isReadOnly}
            />
          ) : (
            <>
              {/* Model selector when no node selected */}
              {headerControls && (
                <div className="mb-4">
                  <label className="text-xs text-muted-foreground mb-1.5 block">Model</label>
                  <ModelSelector
                    value={headerControls.model}
                    onChange={headerControls.onModelChange}
                    organizationTier={headerControls.organizationTier}
                    showInherit={true}
                    inheritLabel="Inherit"
                    inheritFromModel={headerControls.agentDefaultModel}
                    requiredCapabilities={['toolCalling']}
                    className="w-full h-8"
                  />
                </div>
              )}
              <RootSkillConfig
                value={value}
                onChange={onChange}
                isReadOnly={isReadOnly}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
