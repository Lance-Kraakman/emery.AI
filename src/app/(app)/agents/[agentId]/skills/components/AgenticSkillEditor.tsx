'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadSkillAttachment } from '@/app/actions/skills';
import {
  getContextMappings,
  attachContextTable,
  updateContextMapping,
  detachContextTable,
  type ContextMappingDTO,
} from '@/app/actions/context-mappings';
import type { ContextMappingAccessMode, ContextMappingSyncMode } from '@/ddd/domain/context/entities/context-mapping';
import { DataSourceCards } from '@/components/skill-config/DataSourceCards';
import { TableGroupedInputPanel } from '@/components/skill-config/TableGroupedInputPanel';
import { TableGroupedOutputPanel } from '@/components/skill-config/TableGroupedOutputPanel';
import { PlanBuilderSection } from './editor/PlanBuilderSection';
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
 * Agentic mode skill editor - Table-grouped layout
 * Config (always expanded) → Plan (Instructions + Plan Generation)
 *
 * Layout:
 *   Description
 *   Data Sources (horizontal cards) + Agent Type
 *   Inputs + Input Mapping (left) | Outputs + Output Mapping (right)
 *   Plan Builder
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

  // Track collapsible state
  const [isConfigOpen, setIsConfigOpen] = useState(true);

  return (
    <div className={cn(
      'h-full flex flex-col p-4 overflow-y-auto',
      hasFloatingHeader && 'pt-24'
    )}>
      {/* Skill Config Section - Collapsible */}
      <Collapsible open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left mb-3 group">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Skill Config</span>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            !isConfigOpen && "-rotate-90"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4">
          {/* Description - compact */}
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={value.description}
              onChange={(e) => handleChange({ description: e.target.value })}
              placeholder="Briefly describe what this skill does..."
              rows={1}
              className="text-sm resize-none min-h-[36px]"
              disabled={isReadOnly}
            />
          </div>

          {/* Data Sources (horizontal cards) + Agent Type */}
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Data Sources</Label>
                <span className="text-[10px] text-muted-foreground">
                  {dataSources.length}
                </span>
              </div>
              <DataSourceCards
                dataSources={dataSources}
                isLoading={isLoadingDataSources}
                isReadOnly={isReadOnly}
                skillId={skillId}
                onAddDataSource={handleAddDataSource}
                onUpdateDataSource={handleUpdateDataSource}
                onRemoveDataSource={handleRemoveDataSource}
                excludeTableIds={dataSources.map((ds) => ds.tableId)}
              />
            </div>

            <div className="w-48 shrink-0 space-y-1">
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

          {/* Inputs + Input Mapping (left) | Outputs + Output Mapping (right) */}
          <div className="grid grid-cols-2 gap-4">
            <TableGroupedInputPanel
              inputs={value.inputs}
              onInputsChange={(inputs) => handleChange({ inputs })}
              isReadOnly={isReadOnly}
            />
            <TableGroupedOutputPanel
              outputs={value.outputs}
              inputs={value.inputs}
              onOutputsChange={(outputs) => handleChange({ outputs })}
              isReadOnly={isReadOnly}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Plan Builder Section - Always visible */}
      <div className="mt-4">
        <PlanBuilderSection
          instructions={value.instructions || ''}
          onInstructionsChange={(instructions) => handleChange({ instructions })}
          plan={value.plan}
          onPlanChange={(plan) => handleChange({ plan: plan || undefined })}
          skillId={skillId}
          chatVariables={chatVariables}
          isReadOnly={isReadOnly}
          pendingAttachments={pendingAttachments}
          onAttachmentAdd={handleAttachmentAdd}
          onAttachmentRemove={handleAttachmentRemove}
        />
      </div>
    </div>
  );
}
