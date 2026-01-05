'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { WorkflowCanvas } from '@/components/workflow-canvas';
import { X, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InputDefinition, OutputDefinition } from '@/app/mappers/skill-mapper';
import type { SkillStep } from '@/ddd/domain/skills/entities/skill';
import type { WorkflowNode, WorkflowNodeData } from '@/components/workflow-canvas/types';
import type { WorkflowVariable } from '@/components/workflow-canvas/WorkflowVariableInput';
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
  organizationTier = 'free',
  availableSkills = [],
  isReadOnly = false,
}: SkillEditorProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const updateNodeRef = useRef<((id: string, data: Partial<WorkflowNodeData>) => void) | null>(null);
  const deleteNodeRef = useRef<((id: string) => void) | null>(null);

  const handleStepsChange = useCallback((steps: SkillStep[]) => {
    onChange({ ...value, steps });
  }, [onChange, value]);

  const handleNodeSelect = useCallback((id: string | null) => {
    setSelectedNodeId(id);
  }, []);

  const handleNodesChange = useCallback((newNodes: WorkflowNode[]) => {
    setNodes(newNodes);
  }, []);

  const handleUpdateNodeRef = useCallback((fn: (id: string, data: Partial<WorkflowNodeData>) => void) => {
    updateNodeRef.current = fn;
  }, []);

  const handleUpdateNode = useCallback((id: string, data: Partial<WorkflowNodeData>) => {
    updateNodeRef.current?.(id, data);
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

  // Build workflow variables from skill inputs for autocomplete
  const workflowVariables = useMemo((): WorkflowVariable[] => {
    const vars: WorkflowVariable[] = [];

    // Skill inputs
    for (const input of value.inputs) {
      vars.push({
        name: input.name,
        label: input.name,
        description: input.type ? `Type: ${input.type}` : undefined,
        group: 'input',
      });
    }

    // TODO: Add previous step outputs when we implement node I/O tracking
    // TODO: Add loop context variables (item, index) when inside a loop

    return vars;
  }, [value.inputs]);

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
        onChange={handleStepsChange}
        skillInputs={value.inputs}
        availableSkills={availableSkills}
        disabled={isReadOnly}
        showConfigPanel={false}
        onNodeSelect={handleNodeSelect}
        onNodesExpose={handleNodesChange}
        onUpdateNodeExpose={handleUpdateNodeRef}
        onDeleteNodeExpose={handleDeleteNodeRef}
      />

      {/* Floating Config Panel */}
      <div
        className={cn(
          'absolute top-2 right-2 w-80 max-h-[calc(100%-1rem)] bg-background/80 backdrop-blur-sm border rounded-lg shadow-lg overflow-hidden flex flex-col',
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
              skillInputs={value.inputs}
              availableSkills={availableSkills}
              workflowVariables={workflowVariables}
              organizationTier={organizationTier}
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
