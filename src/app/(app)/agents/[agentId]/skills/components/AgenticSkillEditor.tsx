'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Table2, MoreVertical, Loader2, Settings2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { UnifiedChatInput } from '@/components/shared/UnifiedChatInput';
import { DataSourcePicker } from '@/components/data-sources';
import { uploadSkillAttachment } from '@/app/actions/skills';
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
import { StoredPlanSection } from './editor/StoredPlanSection';
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
 * Agentic mode skill editor - Instructions as main area, config in floating side panel
 * Matches workflow mode layout pattern
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

  const handleRemovePlan = useCallback(() => {
    onChange({ ...value, plan: undefined });
  }, [value, onChange]);

  return (
    <div className="relative h-full w-full">
      {/* Main content area - Instructions (full height like workflow canvas) */}
      <div className={cn(
        'h-full flex flex-col p-4 pr-[21.5rem]',
        hasFloatingHeader && 'pt-20'
      )}>
        <div className="flex-1 flex flex-col min-h-0">
          <Label className="text-sm font-medium mb-2 shrink-0">Instructions</Label>
          <div className="flex-1 min-h-0">
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
      </div>

      {/* Floating Config Panel (Right) - like workflow mode */}
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
            <span className="text-sm font-medium">Skill Config</span>
          </div>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Description */}
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={value.description}
              onChange={(e) => handleChange({ description: e.target.value })}
              placeholder="Briefly describe what this skill does..."
              rows={2}
              className="text-xs resize-none"
              disabled={isReadOnly}
            />
            <p className="text-[10px] text-muted-foreground">
              Describe what this skill does and when it should be used
            </p>
          </div>

          {/* Stored Plan (if exists) */}
          {value.plan && (
            <StoredPlanSection
              plan={value.plan}
              onRemove={handleRemovePlan}
              isReadOnly={isReadOnly}
              compact
            />
          )}

          {/* Inputs */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Inputs</Label>
              <span className="text-[10px] text-muted-foreground">
                {value.inputs.length} input{value.inputs.length !== 1 ? 's' : ''}
              </span>
            </div>
            <InputDefinitionsSection
              inputs={value.inputs}
              onInputsChange={(inputs) => handleChange({ inputs })}
              isReadOnly={isReadOnly}
            />
          </div>

          {/* Input Mapping - read from tables */}
          {value.inputs.length > 0 && (
            <InputMappingSection
              inputs={value.inputs}
              onInputsChange={(inputs) => handleChange({ inputs })}
              isReadOnly={isReadOnly}
            />
          )}

          {/* Outputs */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Outputs</Label>
              <span className="text-[10px] text-muted-foreground">
                {value.outputs.length} output{value.outputs.length !== 1 ? 's' : ''}
              </span>
            </div>
            <OutputDefinitionsSection
              outputs={value.outputs}
              onOutputsChange={(outputs) => handleChange({ outputs })}
              isReadOnly={isReadOnly}
            />
          </div>

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

          {/* Data Sources */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Data Sources</Label>
              <span className="text-[10px] text-muted-foreground">
                {dataSources.length} {dataSources.length === 1 ? 'table' : 'tables'}
              </span>
            </div>

            {isLoadingDataSources ? (
              <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Loading...
              </div>
            ) : dataSources.length === 0 ? (
              <div className="text-xs text-muted-foreground py-1">
                No data sources attached
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
                      <span className="text-xs font-medium">{ds.tableName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-5 bg-emerald-100/50 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
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

            {/* Add data source picker */}
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
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tool_calling">Tool Calling</SelectItem>
                <SelectItem value="code_agent">Code Agent</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Tool Calling uses function calls. Code Agent generates Python code.
            </p>
          </div>

          {/* Tools display - if any tools are configured */}
          {value.tools && value.tools.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Tools ({value.tools.length})</Label>
              <div className="flex flex-wrap gap-1">
                {value.tools.map((tool, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300"
                  >
                    {tool.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
