'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Table2, MoreVertical, Loader2, Sparkles, Wand2, CheckCircle2, RefreshCw, X, ChevronDown, ChevronRight, Settings2, MessageSquare, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { UnifiedChatInput } from '@/components/shared/UnifiedChatInput';
import { DataSourcePicker } from '@/components/data-sources';
import { uploadSkillAttachment, generateSkillPlan } from '@/app/actions/skills';
import {
  getContextMappings,
  attachContextTable,
  updateContextMapping,
  detachContextTable,
  type ContextMappingDTO,
} from '@/app/actions/context-mappings';
import type { ContextMappingAccessMode, ContextMappingSyncMode } from '@/ddd/domain/context/entities/context-mapping';
import { InputDefinitionsSection } from './editor/InputDefinitionsSection';
import { OutputDefinitionsSection } from './editor/OutputDefinitionsSection';
import { InputMappingSection } from './editor/InputMappingSection';
import { OutputMappingSection } from './editor/OutputMappingSection';
import { useChatVariables } from './hooks';
import type { SkillFormData } from './SkillEditor';

interface AgenticSkillEditorProps {
  value: SkillFormData;
  onChange: (value: SkillFormData) => void;
  skillId?: number;
  organizationTier?: 'free' | 'pro' | 'max' | 'enterprise';
  isReadOnly?: boolean;
  /** Offset for floating panels when header is above */
  hasFloatingHeader?: boolean;
}

/**
 * Agentic mode skill editor - Single column layout
 * Config → Instructions → Execution Plan
 */
export function AgenticSkillEditor({
  value,
  onChange,
  skillId,
  isReadOnly = false,
  hasFloatingHeader = false,
}: AgenticSkillEditorProps) {
  // Track pending attachments (files being uploaded)
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Plan generation state
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planFeedback, setPlanFeedback] = useState('');

  // Config section collapsed state - collapsed by default
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Data sources state
  const [dataSources, setDataSources] = useState<ContextMappingDTO[]>([]);
  const [isLoadingDataSources, setIsLoadingDataSources] = useState(true);

  // Load data sources when skillId changes
  useEffect(() => {
    const loadDataSources = async () => {
      if (!skillId) {
        setDataSources([]);
        setIsLoadingDataSources(false);
        return;
      }
      try {
        setIsLoadingDataSources(true);
        const mappings = await getContextMappings('skill', String(skillId));
        setDataSources(mappings);
      } catch (error) {
        console.error('Failed to load data sources:', error);
      } finally {
        setIsLoadingDataSources(false);
      }
    };
    loadDataSources();
  }, [skillId]);

  // Handle update data source
  const handleUpdateDataSource = useCallback(
    async (id: number, data: { accessMode?: ContextMappingAccessMode; syncMode?: ContextMappingSyncMode }) => {
      try {
        const result = await updateContextMapping(id, data);
        if (result.success && result.data) {
          setDataSources((prev) =>
            prev.map((ds) => (ds.id === id ? result.data! : ds))
          );
        } else {
          toast.error(result.error || 'Failed to update data source');
        }
      } catch (error) {
        toast.error('Failed to update data source');
      }
    },
    []
  );

  // Handle remove data source
  const handleRemoveDataSource = useCallback(async (id: number) => {
    try {
      const result = await detachContextTable(id);
      if (result.success) {
        setDataSources((prev) => prev.filter((ds) => ds.id !== id));
        toast.success('Data source removed');
      } else {
        toast.error(result.error || 'Failed to remove data source');
      }
    } catch (error) {
      toast.error('Failed to remove data source');
    }
  }, []);

  // Handle add data source
  const handleAddDataSource = useCallback(async (table: { id: number; name: string }) => {
    if (!skillId) {
      toast.error('Save skill first to add data sources');
      return;
    }
    try {
      const result = await attachContextTable({
        targetType: 'skill',
        targetId: String(skillId),
        tableId: table.id,
        tableName: table.name,
        accessMode: 'read',
        syncMode: 'on_access',
      });

      if (result.success && result.data) {
        setDataSources((prev) => [...prev, result.data!]);
        toast.success(`Added ${table.name} as data source`);
      } else {
        toast.error(result.error || `Failed to add ${table.name}`);
      }
    } catch (error) {
      toast.error(`Failed to add ${table.name}`);
    }
  }, [skillId]);

  // Use shared hook to build chat variables from inputs and data sources
  const chatVariables = useChatVariables({
    inputs: value.inputs,
    dataSources,
  });

  // Handle adding a new attachment - upload to S3 immediately
  const handleAttachmentAdd = useCallback(async (file: File) => {
    if (!skillId) {
      console.error('Cannot upload attachment: skillId is required');
      return;
    }

    setPendingAttachments((prev) => [...prev, file]);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', file.type.startsWith('image/') ? 'image' : 'file');

      const result = await uploadSkillAttachment(skillId, formData);

      if (result.success && result.data) {
        console.log('Attachment uploaded:', result.data);
      } else {
        console.error('Upload failed:', result.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setPendingAttachments((prev) => prev.filter((f) => f !== file));
      setIsUploading(false);
    }
  }, [skillId]);

  // Handle removing a pending attachment
  const handleAttachmentRemove = useCallback((index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleChange = (updates: Partial<SkillFormData>) => {
    onChange({ ...value, ...updates });
  };

  const handleRemovePlan = useCallback(() => {
    onChange({ ...value, plan: undefined });
  }, [value, onChange]);

  // Handle generating a plan from instructions
  const handleGeneratePlan = useCallback(async (withFeedback = false) => {
    if (!skillId || !value.instructions?.trim()) {
      toast.error('Save the skill and add instructions first');
      return;
    }

    setIsGeneratingPlan(true);
    try {
      // Pass previous plan and feedback for regeneration
      const previousPlan = withFeedback && value.plan ? value.plan : undefined;
      const feedback = withFeedback && planFeedback.trim() ? planFeedback.trim() : undefined;

      const result = await generateSkillPlan(skillId, value.instructions, previousPlan, feedback);
      if (result.success && result.data) {
        onChange({ ...value, plan: result.data });
        setPlanFeedback(''); // Clear feedback after successful regeneration
        toast.success(`Plan ${withFeedback ? 'regenerated' : 'generated'} with ${result.data.steps?.length || 0} steps`);
      } else {
        toast.error(result.error || 'Failed to generate plan');
      }
    } catch (error) {
      console.error('Plan generation failed:', error);
      toast.error('Failed to generate plan');
    } finally {
      setIsGeneratingPlan(false);
    }
  }, [skillId, value, onChange, planFeedback]);

  return (
    <div className={cn(
      'h-full flex flex-col p-4 gap-4',
      hasFloatingHeader && 'pt-24'
    )}>
      {/* Skill Config Section - Collapsible */}
      <Collapsible open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <div className="border rounded-lg bg-muted/20 shrink-0">
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Skill Config</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {value.inputs.length} input{value.inputs.length !== 1 ? 's' : ''}, {value.outputs.length} output{value.outputs.length !== 1 ? 's' : ''}
              </span>
              {isConfigOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-3 pb-3 pt-1 space-y-4 border-t">
              {/* Description */}
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={value.description}
                  onChange={(e) => handleChange({ description: e.target.value })}
                  placeholder="Briefly describe what this skill does..."
                  rows={2}
                  className="text-sm resize-none"
                  disabled={isReadOnly}
                />
              </div>

              {/* Inputs and Outputs - side by side */}
              <div className="grid grid-cols-2 gap-4">
                {/* Inputs */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Inputs</Label>
                    <span className="text-[10px] text-muted-foreground">
                      {value.inputs.length}
                    </span>
                  </div>
                  <InputDefinitionsSection
                    inputs={value.inputs}
                    onInputsChange={(inputs) => handleChange({ inputs })}
                    isReadOnly={isReadOnly}
                  />
                </div>

                {/* Outputs */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Outputs</Label>
                    <span className="text-[10px] text-muted-foreground">
                      {value.outputs.length}
                    </span>
                  </div>
                  <OutputDefinitionsSection
                    outputs={value.outputs}
                    onOutputsChange={(outputs) => handleChange({ outputs })}
                    isReadOnly={isReadOnly}
                  />
                </div>
              </div>

              {/* Input Mapping - read from tables */}
              {value.inputs.length > 0 && (
                <InputMappingSection
                  inputs={value.inputs}
                  onInputsChange={(inputs) => handleChange({ inputs })}
                  isReadOnly={isReadOnly}
                />
              )}

              {/* Output Mapping - write to tables */}
              {value.outputs.length > 0 && (
                <OutputMappingSection
                  outputs={value.outputs}
                  onOutputsChange={(outputs) => handleChange({ outputs })}
                  skillOutputs={value.outputs}
                  skillInputs={value.inputs}
                  isReadOnly={isReadOnly}
                />
              )}

              {/* Data Sources and Agent Type - side by side */}
              <div className="grid grid-cols-2 gap-4">
                {/* Data Sources */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Data Sources</Label>
                    <span className="text-[10px] text-muted-foreground">
                      {dataSources.length}
                    </span>
                  </div>

                  {isLoadingDataSources ? (
                    <div className="flex items-center py-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      Loading...
                    </div>
                  ) : dataSources.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-1">
                      No data sources
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {dataSources.map((ds) => (
                        <div
                          key={ds.id}
                          className="flex items-center justify-between p-1.5 rounded border bg-emerald-50/30 dark:bg-emerald-900/10"
                        >
                          <div className="flex items-center gap-1.5">
                            <Table2 className="h-3 w-3 text-emerald-500" />
                            <span className="text-xs font-medium truncate max-w-[100px]">{ds.tableName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1 py-0 h-4 bg-emerald-100/50 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                            >
                              {ds.accessMode}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5" disabled={isReadOnly}>
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36">
                                <DropdownMenuItem
                                  onClick={() => handleUpdateDataSource(ds.id, { accessMode: 'read' })}
                                  disabled={ds.accessMode === 'read'}
                                >
                                  Read only
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleUpdateDataSource(ds.id, { accessMode: 'write' })}
                                  disabled={ds.accessMode === 'write'}
                                >
                                  Write only
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleUpdateDataSource(ds.id, { accessMode: 'readwrite' })}
                                  disabled={ds.accessMode === 'readwrite'}
                                >
                                  Read & Write
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleRemoveDataSource(ds.id)}
                                  className="text-destructive"
                                >
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <DataSourcePicker
                    onTableSelect={handleAddDataSource}
                    excludeTableIds={dataSources.map((ds) => ds.tableId)}
                    disabled={isLoadingDataSources || isReadOnly || !skillId}
                  />
                </div>

                {/* Agent Type */}
                <div className="space-y-1">
                  <Label className="text-xs">Agent Type</Label>
                  <Select
                    value={value.agentType || 'tool_calling'}
                    onValueChange={(agentType) => handleChange({ agentType })}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tool_calling">Tool Calling</SelectItem>
                      <SelectItem value="code_agent">Code Agent</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Tool Calling uses function calls. Code Agent generates Python.
                  </p>

                  {/* Tools display */}
                  {value.tools && value.tools.length > 0 && (
                    <div className="pt-1">
                      <div className="flex flex-wrap gap-1">
                        {value.tools.slice(0, 3).map((tool, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300"
                          >
                            {tool.name}
                          </span>
                        ))}
                        {value.tools.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
                            +{value.tools.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Scrollable content area for Instructions + Execution Plan */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-2 pb-4">
          {/* Instructions Section - bounded height */}
          <div className="flex flex-col">
            <Label className="text-sm font-medium mb-2 shrink-0">Instructions</Label>
            <div className="min-h-[200px] h-[300px]">
              <UnifiedChatInput
                mode="form"
                minHeight="100%"
                value={value.instructions || ''}
                onChange={(instructions) => handleChange({ instructions })}
                variables={chatVariables}
                enableSendButton={false}
                enableAttachments={true}
                pendingAttachments={pendingAttachments}
                onAttachmentAdd={handleAttachmentAdd}
                onAttachmentRemove={handleAttachmentRemove}
                disabled={isReadOnly}
                placeholder="Describe what this skill should do... (@ for tools, { for variables)"
              />
            </div>
          </div>

          {/* Execution Plan Section */}
          {isGeneratingPlan ? (
        // Generating state
        <div className="border rounded-lg p-4 bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            <span className="text-sm font-medium">Generating Plan...</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Analyzing your instructions and creating an execution plan. This may take a moment.
          </p>
        </div>
      ) : value.plan ? (
        // Plan exists state
        <div className="border rounded-lg p-4 bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium">Execution Plan</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px]">
                    <p className="text-xs">
                      Execution plans define how the agent carries out your instructions.
                      Use chat to iteratively design and refine your plan for repeatable results.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge variant="outline" className="text-[10px]">
                {value.plan.steps?.length || 0} steps
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => handleGeneratePlan(false)}
                disabled={!value.instructions?.trim() || !skillId || isReadOnly}
                title="Regenerate plan from scratch"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleRemovePlan}
                disabled={isReadOnly}
                title="Remove plan"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-2">
            {value.plan.goal}
          </p>

          {value.plan.steps && value.plan.steps.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="text-xs text-blue-600 hover:text-blue-800 flex items-center">
                View steps <ChevronDown className="h-3 w-3 ml-1" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ol className="text-xs space-y-1 mt-2 pl-4 list-decimal text-muted-foreground">
                  {value.plan.steps.map((step) => (
                    <li key={step.stepId}>{step.description}</li>
                  ))}
                </ol>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Feedback for regeneration */}
          <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-1.5 mb-1.5">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium">Improve Plan</span>
            </div>
            <Textarea
              value={planFeedback}
              onChange={(e) => setPlanFeedback(e.target.value)}
              placeholder="Describe what to change (e.g., 'add error handling step', 'search by date instead of name')..."
              rows={2}
              className="text-xs resize-none mb-2"
              disabled={isReadOnly || isGeneratingPlan}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGeneratePlan(true)}
              disabled={!planFeedback.trim() || !value.instructions?.trim() || !skillId || isReadOnly || isGeneratingPlan}
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Regenerate with Feedback
            </Button>
          </div>
        </div>
          ) : (
            // No plan state
            <div className="border rounded-lg p-4 bg-muted/30 shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Execution Plan</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[280px]">
                      <p className="text-xs">
                        Execution plans define how the agent carries out your instructions.
                        Use chat to iteratively design and refine your plan for repeatable results.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Pre-generate a plan for repeatable tasks. Without a plan, the agent creates one at runtime and requests approval for each step.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleGeneratePlan(false)}
                disabled={!value.instructions?.trim() || !skillId || isReadOnly}
              >
                <Wand2 className="h-3 w-3 mr-1.5" />
                Generate Plan
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
