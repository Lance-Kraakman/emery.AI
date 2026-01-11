'use client';

/**
 * SkillConfigPanel Component
 *
 * Enhanced configuration panel for skill nodes in the org chart.
 * Features inline name editing, execution type display, and I/O mapping config.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ExternalLink,
  Bot,
  Building2,
  Check,
  X,
  Loader2,
  Table2,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { updateSkill } from '@/app/actions/skills';
import { getFields } from '@/app/actions/fields';
import { InputDefinitionsSection } from '@/app/(app)/agents/[agentId]/skills/components/editor/InputDefinitionsSection';
import { OutputDefinitionsSection } from '@/app/(app)/agents/[agentId]/skills/components/editor/OutputDefinitionsSection';
import { InputMappingSection } from '@/app/(app)/agents/[agentId]/skills/components/editor/InputMappingSection';
import { OutputMappingSection } from '@/app/(app)/agents/[agentId]/skills/components/editor/OutputMappingSection';
import type { InputDefinition, OutputDefinition, TableMapping } from '@/app/mappers/skill-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';

// Map table field types to skill input types
// Returns null for read-only/system fields that shouldn't be mapped
const fieldTypeToInputType: Record<FieldType, InputDefinition['type'] | null> = {
  'text': 'text',
  'number': 'text',
  'boolean': 'text',
  'date': 'text',
  'single-select': 'text',
  'multi-select': 'text',
  'file': 'file',
  'document': 'document',
  'email': 'text',
  'phone': 'text',
  'json': 'text',
  'relation': 'text',
  // Read-only/system fields - skip these
  'embedding': null,
  'autonumber': null,
  'last-updated': null,
  'created-at': null,
};

/** Edge passed from selection (already filtered to this skill) */
interface SelectedEdge {
  id: string;
  target: string;  // e.g., "database-123" or "skill-456"
  edgeType: string; // "skill_table" or "skill_ref"
  tableId?: number; // Table ID for table-level connections
}

/** Connected table parsed from edges */
interface ConnectedTable {
  tableId: number;
  tableName: string;
  dbName: string;
}

interface SkillConfigPanelProps {
  skill: {
    id: number;
    name: string;
    executionType?: string;
    agentId?: number | null;
    inputs?: InputDefinition[];
    outputs?: OutputDefinition[];
  };
  agentName?: string;
  onOpenEditor: () => void;
  /** Edges connected to this skill (already filtered, from selection) */
  edges?: SelectedEdge[];
  /** Database info for connected databases */
  databases?: Array<{
    id: number;
    name: string;
    tables?: Array<{ id: number; name: string }>;
  }>;
  /** Skill info for connected skills */
  connectedSkills?: Array<{ id: number; name: string }>;
}

/** Get badge color based on execution type */
function getExecutionTypeBadgeColor(executionType?: string): string {
  const colors: Record<string, string> = {
    agentic: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
    tool: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    read: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
    write: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
    operation: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  };
  return colors[executionType || 'agentic'] || colors.agentic;
}

/**
 * ConnectedTableCard - Shows a connected table with action buttons
 */
function ConnectedTableCard({
  table,
  onAddInputs,
  onAddOutputMapping,
}: {
  table: ConnectedTable;
  onAddInputs: (fields: FieldDTO[]) => void;
  onAddOutputMapping: () => void;
}) {
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<number>>(new Set());
  const [loadingFields, setLoadingFields] = useState(false);

  // Fetch fields when picker opens
  useEffect(() => {
    if (showFieldPicker && fields.length === 0 && !loadingFields) {
      setLoadingFields(true);
      getFields(table.tableId)
        .then((fetchedFields) => {
          if (Array.isArray(fetchedFields)) {
            // Filter to readable fields (exclude system/computed fields)
            const readableFields = fetchedFields.filter(
              (f) => f.name !== 'id' && fieldTypeToInputType[f.type as FieldType] !== null
            );
            setFields(readableFields);
          }
        })
        .finally(() => setLoadingFields(false));
    }
  }, [showFieldPicker, fields.length, loadingFields, table.tableId]);

  const handleFieldToggle = (fieldId: number) => {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedFieldIds.size === fields.length) {
      setSelectedFieldIds(new Set());
    } else {
      setSelectedFieldIds(new Set(fields.map((f) => f.id)));
    }
  };

  const handleAddSelectedFields = () => {
    const selectedFields = fields.filter((f) => selectedFieldIds.has(f.id));
    onAddInputs(selectedFields);
    setShowFieldPicker(false);
    setSelectedFieldIds(new Set());
  };

  return (
    <div className="p-3 rounded-lg border bg-cyan-50/50 dark:bg-cyan-900/20">
      <div className="flex items-center gap-2 mb-2">
        <Table2 className="h-4 w-4 text-cyan-500" />
        <span className="text-sm font-medium">{table.tableName}</span>
        <span className="text-xs text-muted-foreground">({table.dbName})</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Popover open={showFieldPicker} onOpenChange={setShowFieldPicker}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Add inputs from table
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Select Fields</Label>
                {fields.length > 0 && (
                  <button
                    type="button"
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={handleSelectAll}
                  >
                    {selectedFieldIds.size === fields.length ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>
              {loadingFields ? (
                <div className="text-xs text-muted-foreground py-2">Loading fields...</div>
              ) : fields.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">No readable fields</div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                  {fields.map((field) => (
                    <label
                      key={field.id}
                      className="flex items-center gap-2 py-1 px-1 hover:bg-muted/50 rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedFieldIds.has(field.id)}
                        onCheckedChange={() => handleFieldToggle(field.id)}
                      />
                      <span className="text-xs flex-1">{field.name}</span>
                      <span className="text-[10px] text-muted-foreground">{field.type}</span>
                    </label>
                  ))}
                </div>
              )}
              {selectedFieldIds.size > 0 && (
                <Button
                  type="button"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={handleAddSelectedFields}
                >
                  Add {selectedFieldIds.size} input{selectedFieldIds.size !== 1 ? 's' : ''}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onAddOutputMapping}>
          <Plus className="h-3 w-3 mr-1" />
          Add output mapping
        </Button>
      </div>
    </div>
  );
}

export function SkillConfigPanel({
  skill,
  agentName,
  onOpenEditor,
  edges = [],
  databases = [],
  connectedSkills = [],
}: SkillConfigPanelProps) {
  const router = useRouter();
  const isOrgScoped = skill.agentId === null || skill.agentId === undefined;

  // Parse connected tables from edges (table-level connections only)
  const connectedTables = useMemo((): ConnectedTable[] => {
    if (!edges || edges.length === 0) return [];

    const tables: ConnectedTable[] = [];
    const seenTableIds = new Set<number>();

    edges.forEach((edge) => {
      // Get tableId from edge data (set by table handle connections)
      const tableId = edge.tableId;
      if (!tableId || seenTableIds.has(tableId)) return;
      seenTableIds.add(tableId);

      // Find table info from databases prop
      for (const db of databases) {
        const table = db.tables?.find(t => t.id === tableId);
        if (table) {
          tables.push({
            tableId: table.id,
            tableName: table.name,
            dbName: db.name,
          });
          break;
        }
      }
    });

    return tables;
  }, [edges, databases]);

  // Inline editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(skill.name);
  const [isSaving, setIsSaving] = useState(false);

  // Local state for inputs/outputs (for optimistic updates)
  const [localInputs, setLocalInputs] = useState<InputDefinition[]>(skill.inputs ?? []);
  const [localOutputs, setLocalOutputs] = useState<OutputDefinition[]>(skill.outputs ?? []);

  // Sync local state when skill changes
  useEffect(() => {
    setLocalInputs(skill.inputs ?? []);
    setLocalOutputs(skill.outputs ?? []);
  }, [skill.id, skill.inputs, skill.outputs]);

  // Save mappings immediately on change
  const saveMappings = useCallback(
    async (updates: { inputs?: InputDefinition[]; outputs?: OutputDefinition[] }) => {
      try {
        const result = await updateSkill(skill.id, updates);
        if (!result.success) {
          toast.error(result.error || 'Failed to save mappings');
        }
      } catch {
        toast.error('Failed to save mappings');
      }
    },
    [skill.id]
  );

  const handleInputsChange = useCallback((inputs: InputDefinition[]) => {
    setLocalInputs(inputs);
    saveMappings({ inputs });
  }, [saveMappings]);

  const handleOutputsChange = useCallback((outputs: OutputDefinition[]) => {
    setLocalOutputs(outputs);
    saveMappings({ outputs });
  }, [saveMappings]);

  // Add inputs from connected table
  const handleAddInputsFromTable = useCallback((tableId: number, fields: FieldDTO[]) => {
    const existingNames = new Set(localInputs.map(i => i.name));

    const newInputs: InputDefinition[] = fields.map(field => {
      let name = field.name;
      // Handle duplicates
      if (existingNames.has(name)) {
        let suffix = 2;
        while (existingNames.has(`${field.name}_${suffix}`)) suffix++;
        name = `${field.name}_${suffix}`;
      }
      existingNames.add(name);

      return {
        name,
        type: fieldTypeToInputType[field.type as FieldType] || 'text',
        required: false,
        // Pre-configure input mapping to read from this table
        inputMapping: {
          source: {
            tableId,
            fieldId: field.id,
            rowSource: { type: 'source_row' as const }
          }
        }
      };
    });

    handleInputsChange([...localInputs, ...newInputs]);
  }, [localInputs, handleInputsChange]);

  // Add output mapping to connected table
  const handleAddOutputMapping = useCallback((tableId: number) => {
    if (localOutputs.length === 0) {
      toast.error('Add at least one output before creating a mapping');
      return;
    }

    // Find or create outputMapping on first output
    const output = localOutputs[0];
    const currentMapping = output.outputMapping;
    const newOrder = (currentMapping?.tableMappings?.length || 0) + 1;

    const newTableMapping: TableMapping = {
      order: newOrder,
      targetTableId: tableId,
      rowAction: 'create',
      mappings: []
    };

    const updatedOutputs = localOutputs.map((o, i) =>
      i === 0 ? {
        ...o,
        outputMapping: {
          mode: currentMapping?.mode || 'single_row',
          tableMappings: [...(currentMapping?.tableMappings || []), newTableMapping]
        }
      } : o
    );

    handleOutputsChange(updatedOutputs as OutputDefinition[]);
    toast.success('Output mapping added - configure field mappings below');
  }, [localOutputs, handleOutputsChange]);

  // Handle save name
  const handleSaveName = useCallback(async () => {
    if (editName.trim() === skill.name) {
      setIsEditingName(false);
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateSkill(skill.id, { name: editName.trim() });
      if (result.success) {
        toast.success('Skill name updated');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to update name');
        setEditName(skill.name);
      }
    } catch (error) {
      toast.error('Failed to update name');
      setEditName(skill.name);
    } finally {
      setIsSaving(false);
      setIsEditingName(false);
    }
  }, [skill.id, skill.name, editName, router]);

  // Cancel editing
  const handleCancelName = () => {
    setEditName(skill.name);
    setIsEditingName(false);
  };

  // Build the correct URL for opening the skill
  const getSkillUrl = () => {
    if (skill.agentId) {
      return `/agents/${skill.agentId}/skills/${skill.id}`;
    }
    return `/skills/${skill.id}`;
  };

  return (
    <div className="space-y-5">
      {/* Header with inline editing */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30 shrink-0">
          <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Editable name */}
          {isEditingName ? (
            <div className="flex items-center gap-1">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-7 text-sm font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') handleCancelName();
                }}
                disabled={isSaving}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleSaveName}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleCancelName}
                disabled={isSaving}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <h3
              className="font-semibold text-base truncate cursor-pointer hover:text-primary transition-colors"
              onClick={() => setIsEditingName(true)}
              title="Click to edit"
            >
              {skill.name}
            </h3>
          )}

          {/* Execution type badge */}
          {skill.executionType && (
            <Badge
              variant="secondary"
              className={cn('text-xs', getExecutionTypeBadgeColor(skill.executionType))}
            >
              {skill.executionType}
            </Badge>
          )}
        </div>
      </div>

      {/* Scope badge */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Scope
        </label>
        <div className="mt-1.5">
          <div
            className={cn(
              'inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm',
              isOrgScoped
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            )}
          >
            {isOrgScoped ? (
              <>
                <Building2 className="h-4 w-4" />
                <span>Organization-level</span>
              </>
            ) : (
              <>
                <Bot className="h-4 w-4" />
                <span>{agentName || `Agent #${skill.agentId}`}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
        <p>
          {isOrgScoped
            ? 'This skill is available to all agents in the organization.'
            : 'This skill is private to its owning agent.'}
        </p>
      </div>

      {/* Inputs Section */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Inputs</Label>
          <span className="text-xs text-muted-foreground">
            {localInputs.length} input{localInputs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <InputDefinitionsSection
          inputs={localInputs}
          onInputsChange={handleInputsChange}
        />
        <p className="text-xs text-muted-foreground">
          Skill inputs available to all workflow steps
        </p>
      </div>

      {/* Input Mapping (only if inputs exist) */}
      {localInputs.length > 0 && (
        <div className="space-y-2">
          <InputMappingSection
            inputs={localInputs}
            onInputsChange={handleInputsChange}
          />
        </div>
      )}

      {/* Outputs Section */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Outputs</Label>
          <span className="text-xs text-muted-foreground">
            {localOutputs.length} output{localOutputs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <OutputDefinitionsSection
          outputs={localOutputs}
          onOutputsChange={handleOutputsChange}
        />
        <p className="text-xs text-muted-foreground">
          Define what data this skill returns
        </p>
      </div>

      {/* Output Mapping (only if outputs exist) */}
      {localOutputs.length > 0 && (
        <div className="space-y-2">
          <OutputMappingSection
            outputs={localOutputs}
            onOutputsChange={handleOutputsChange}
            executionType="agent"
            skillOutputs={localOutputs}
            skillInputs={localInputs}
          />
        </div>
      )}

      {/* Connected Tables Section (if any table connections) */}
      {connectedTables.length > 0 && (
        <div className="border-t pt-4 space-y-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Connected Tables
          </h4>
          {connectedTables.map((table) => (
            <ConnectedTableCard
              key={table.tableId}
              table={table}
              onAddInputs={(fields) => handleAddInputsFromTable(table.tableId, fields)}
              onAddOutputMapping={() => handleAddOutputMapping(table.tableId)}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 space-y-2 border-t">
        <Button onClick={onOpenEditor} className="w-full" size="sm">
          <Sparkles className="h-4 w-4 mr-2" />
          Open Skill Editor
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => window.open(getSkillUrl(), '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in New Tab
        </Button>
      </div>
    </div>
  );
}

export default SkillConfigPanel;
