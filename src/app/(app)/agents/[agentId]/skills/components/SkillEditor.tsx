'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { WorkflowCanvas } from '@/components/workflow-canvas';
import { X, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
  /** Offset for floating panels when header is above (default: false) */
  hasFloatingHeader?: boolean;
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
  hasFloatingHeader = false,
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
        hasFloatingHeader={hasFloatingHeader}
        onNodeSelect={handleNodeSelect}
        onNodesExpose={handleNodesChange}
        onEdgesExpose={handleEdgesChange}
        onUpdateNodeExpose={handleUpdateNodeRef}
        onRenameNodeExpose={handleRenameNodeRef}
        onDeleteNodeExpose={handleDeleteNodeRef}
      />

      {/* Floating Config Panel (Right) */}
      <div
        className={cn(
          'absolute right-2 z-10 w-80 bg-background/50 backdrop-blur-sm border rounded-lg shadow-lg overflow-hidden flex flex-col',
          'transition-all duration-200',
          hasFloatingHeader ? 'top-[52px] max-h-[calc(100%-60px)]' : 'top-2 max-h-[calc(100%-1rem)]'
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
          {selectedNode && (
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
          )}
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
            <RootSkillConfig
              value={value}
              onChange={onChange}
              isReadOnly={isReadOnly}
            />
          )}
        </div>
      </div>
    </div>
  );
}
