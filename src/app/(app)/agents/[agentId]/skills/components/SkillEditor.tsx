'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { WorkflowCanvas } from '@/components/workflow-canvas';
import { X, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InputDefinition, OutputDefinition, ToolConfigDTO } from '@/app/mappers/skill-mapper';
import type { SkillStep, CanvasMetadata, SkillExecutionType, StoredPlan } from '@/ddd/domain/skills/entities/skill';
import type { FlowToStepsResult } from '@/components/workflow-canvas/utils/flow-converters';
import type { WorkflowNode, WorkflowNodeData, WorkflowEdge } from '@/components/workflow-canvas/types';
import type { WorkflowVariable } from '@/components/workflow-canvas/WorkflowVariableInput';
import { inferVariablesForNode } from '@/components/workflow-canvas/utils/variable-inference';
import { toast } from 'sonner';
import { generateSkillPlan } from '@/app/actions/skills';
import { NodeConfigContent } from './NodeConfigContent';
import { RootSkillConfig } from './RootSkillConfig';
import { AgenticSkillEditor } from './AgenticSkillEditor';

/**
 * SkillFormData - supports both workflow (DAG) and agentic (single-step) modes
 *
 * - executionType: 'agent' = workflow mode (uses steps[])
 * - executionType: 'agentic' = agentic mode (uses instructions, tools, agentType)
 */
export interface SkillFormData {
  name: string;
  description: string;
  inputs: InputDefinition[];
  outputs: OutputDefinition[];
  steps: SkillStep[];
  canvasMetadata?: CanvasMetadata; // Canvas annotations (sticky notes)
  model?: string | null;
  // Execution mode
  executionType?: SkillExecutionType;
  // Agentic mode fields
  instructions?: string;
  tools?: ToolConfigDTO[];
  agentType?: string | null;
  // Stored plan (for autonomous execution)
  plan?: StoredPlan;
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

  // Ref to always have current value without triggering callback recreation
  // This fixes the autosave bug where handleCanvasChange recreation caused
  // an infinite loop that kept clearing the 2-second save timer
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Node-level plan generation state (for agentic nodes in workflow mode)
  const [generatingPlanForNode, setGeneratingPlanForNode] = useState<string | null>(null);

  const handleCanvasChange = useCallback((result: FlowToStepsResult) => {
    onChange({ ...valueRef.current, steps: result.steps, canvasMetadata: result.canvasMetadata });
  }, [onChange]);

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

  // Generate plan for a specific agentic node
  const handleGenerateNodePlan = useCallback(async (nodeId: string, feedback?: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.type !== 'agentic' || !skillId) return;

    const data = node.data as { instructions?: string; plan?: StoredPlan };
    if (!data.instructions?.trim()) {
      toast.error('Add instructions first');
      return;
    }

    setGeneratingPlanForNode(nodeId);
    try {
      // Pass previous plan and feedback for regeneration (same API as agentic page)
      const previousPlan = feedback && data.plan ? data.plan : undefined;
      const result = await generateSkillPlan(skillId, data.instructions, previousPlan, feedback);
      if (result.success && 'data' in result) {
        handleUpdateNode(nodeId, { plan: result.data });
        toast.success(`Plan ${feedback ? 'regenerated' : 'generated'} with ${result.data.steps?.length || 0} steps`);
      } else if ('questions' in result) {
        // Clarifying questions - SkillEditor doesn't support interactive questions yet
        toast.info('Planner needs more information. Use the full skill editor for interactive planning.');
      } else {
        toast.error(result.error || 'Failed to generate plan');
      }
    } catch (error) {
      console.error('Plan generation failed:', error);
      toast.error('Failed to generate plan');
    } finally {
      setGeneratingPlanForNode(null);
    }
  }, [nodes, skillId, handleUpdateNode]);

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
    skillInput: 'Skill Inputs',
    skillOutput: 'Skill Outputs',
  };

  // Check if selected node is a virtual I/O node
  const isIONode = selectedNode?.type === 'skillInput' || selectedNode?.type === 'skillOutput';

  // For I/O nodes, show RootSkillConfig (treat as if no regular node selected)
  const showRootConfig = !selectedNode || isIONode;

  // Agentic mode: show simplified single-step editor
  if (value.executionType !== 'agent') {
    return (
      <AgenticSkillEditor
        value={value}
        onChange={onChange}
        skillId={skillId}
        organizationTier={organizationTier}
        isReadOnly={isReadOnly}
        hasFloatingHeader={hasFloatingHeader}
      />
    );
  }

  // Workflow mode: show DAG canvas with config panel
  return (
    <div className="relative h-full w-full">
      {/* Full-height Canvas - uncontrolled mode */}
      <WorkflowCanvas
        steps={value.steps || []}
        canvasMetadata={value.canvasMetadata}
        onChange={handleCanvasChange}
        skillInputs={value.inputs}
        skillOutputs={value.outputs}
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
          hasFloatingHeader ? 'top-[72px] max-h-[calc(100%-80px)]' : 'top-2 max-h-[calc(100%-1rem)]'
        )}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {showRootConfig
                ? 'Skill Config'
                : nodeTypeLabels[selectedNode!.type] || 'Node'}
            </span>
          </div>
          {/* Only show delete/close buttons for regular workflow nodes (not I/O nodes) */}
          {selectedNode && !isIONode && (
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
          {showRootConfig ? (
            <RootSkillConfig
              value={value}
              onChange={onChange}
              isReadOnly={isReadOnly}
              nodes={nodes}
            />
          ) : (
            <NodeConfigContent
              node={selectedNode!}
              onUpdateNode={handleUpdateNode}
              onRenameNode={handleRenameNode}
              skillInputs={value.inputs}
              availableSkills={availableSkills}
              workflowVariables={workflowVariables}
              organizationTier={organizationTier}
              skillId={skillId}
              disabled={isReadOnly}
              isGeneratingPlan={generatingPlanForNode === selectedNode!.id}
              onGeneratePlan={(feedback) => handleGenerateNodePlan(selectedNode!.id, feedback)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
