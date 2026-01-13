'use client';

/**
 * SkillConfigPanel Component
 *
 * Table-centric configuration panel for skill nodes in the org chart.
 * Groups inputs/outputs by their connected tables for clear data flow visualization.
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
  ArrowRight,
  ArrowLeft,
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
import type { InputDefinition, OutputDefinition, TableMapping, FieldMapping } from '@/app/mappers/skill-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';

// Map table field types to skill input types
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
  'embedding': null,
  'autonumber': null,
  'last-updated': null,
  'created-at': null,
};

// Map table field types to skill output types
const fieldTypeToOutputType: Record<FieldType, OutputDefinition['type'] | null> = {
  'text': 'text',
  'number': 'number',
  'boolean': 'boolean',
  'date': 'date',
  'single-select': 'single-select',
  'multi-select': 'multi-select',
  'file': 'file',
  'document': 'document',
  'email': 'email',
  'phone': 'phone',
  'json': 'json',
  'relation': 'text',
  'embedding': null,
  'autonumber': null,
  'last-updated': null,
  'created-at': null,
};

/** Edge passed from selection */
interface SelectedEdge {
  id: string;
  target: string;
  edgeType: string;
  tableId?: number;
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
  edges?: SelectedEdge[];
  databases?: Array<{
    id: number;
    name: string;
    tables?: Array<{ id: number; name: string }>;
  }>;
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
 * FieldPickerPopover - Reusable field picker for tables
 */
function FieldPickerPopover({
  tableId,
  buttonLabel,
  buttonIcon,
  onSelectFields,
}: {
  tableId: number;
  buttonLabel: string;
  buttonIcon?: React.ReactNode;
  onSelectFields: (fields: FieldDTO[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && fields.length === 0 && !loading) {
      setLoading(true);
      getFields(tableId)
        .then((fetched) => {
          if (Array.isArray(fetched)) {
            const readable = fetched.filter(
              (f) => f.name !== 'id' && fieldTypeToInputType[f.type as FieldType] !== null
            );
            setFields(readable);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [open, fields.length, loading, tableId]);

  const handleToggle = (id: number) => {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  const handleAdd = () => {
    const selected = fields.filter((f) => selectedFieldIds.has(f.id));
    onSelectFields(selected);
    setOpen(false);
    setSelectedFieldIds(new Set());
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 text-[11px] text-muted-foreground hover:text-foreground">
          {buttonIcon}
          {buttonLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-2">
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
          {loading ? (
            <div className="text-xs text-muted-foreground py-2">Loading...</div>
          ) : fields.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">No fields available</div>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-0.5 border rounded-md p-1.5">
              {fields.map((field) => (
                <label
                  key={field.id}
                  className="flex items-center gap-2 py-1 px-1.5 hover:bg-muted/50 rounded cursor-pointer"
                >
                  <Checkbox
                    checked={selectedFieldIds.has(field.id)}
                    onCheckedChange={() => handleToggle(field.id)}
                  />
                  <span className="text-[11px] flex-1 truncate">{field.name}</span>
                  <span className="text-[9px] text-muted-foreground">{field.type}</span>
                </label>
              ))}
            </div>
          )}
          {selectedFieldIds.size > 0 && (
            <Button type="button" size="sm" className="w-full h-7 text-xs" onClick={handleAdd}>
              Add {selectedFieldIds.size} field{selectedFieldIds.size !== 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * TableInputGroup - Shows inputs from a specific table
 */
function TableInputGroup({
  table,
  inputs,
  onAddFields,
  onRemoveInput,
}: {
  table: ConnectedTable;
  inputs: InputDefinition[];
  onAddFields: (fields: FieldDTO[]) => void;
  onRemoveInput: (inputName: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-emerald-50/30 dark:bg-emerald-900/10 p-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Table2 className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
          From: {table.tableName}
        </span>
        <span className="text-[10px] text-muted-foreground">({table.dbName})</span>
      </div>
      <div className="space-y-1">
        {inputs.map((input) => (
          <div
            key={input.name}
            className="flex items-center gap-2 text-[11px] py-1 px-2 bg-background/60 rounded group"
          >
            <code className="font-mono text-emerald-700 dark:text-emerald-300">{input.name}</code>
            {input.type && input.type !== 'text' && (
              <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/50 px-1 rounded">
                {input.type}
              </span>
            )}
            <ArrowLeft className="h-3 w-3 text-muted-foreground ml-auto" />
            <span className="text-muted-foreground truncate max-w-[80px]">
              {input.inputMapping?.source?.fieldId ? `field #${input.inputMapping.source.fieldId}` : 'mapped'}
            </span>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              onClick={() => onRemoveInput(input.name)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <FieldPickerPopover
        tableId={table.tableId}
        buttonLabel="+ Add fields"
        onSelectFields={onAddFields}
      />
    </div>
  );
}

/**
 * TableOutputGroup - Shows outputs to a specific table
 */
function TableOutputGroup({
  table,
  outputs,
  onAddFields,
  onRemoveOutput,
}: {
  table: ConnectedTable;
  outputs: OutputDefinition[];
  onAddFields: (fields: FieldDTO[]) => void;
  onRemoveOutput: (outputName: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-blue-50/30 dark:bg-blue-900/10 p-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Table2 className="h-3.5 w-3.5 text-blue-600" />
        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
          To: {table.tableName}
        </span>
        <span className="text-[10px] text-muted-foreground">({table.dbName})</span>
      </div>
      <div className="space-y-1">
        {outputs.length === 0 ? (
          <div className="text-[11px] text-muted-foreground py-1 px-2">
            No outputs mapped yet
          </div>
        ) : (
          outputs.map((output) => (
            <div
              key={output.name}
              className="flex items-center gap-2 text-[11px] py-1 px-2 bg-background/60 rounded group"
            >
              <code className="font-mono text-blue-700 dark:text-blue-300">{output.name}</code>
              {output.type && output.type !== 'text' && (
                <span className="text-[9px] bg-blue-100 dark:bg-blue-900/50 px-1 rounded">
                  {output.type}
                </span>
              )}
              <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto" />
              <span className="text-muted-foreground">table</span>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                onClick={() => onRemoveOutput(output.name)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
      <FieldPickerPopover
        tableId={table.tableId}
        buttonLabel="+ Define output fields"
        onSelectFields={onAddFields}
      />
    </div>
  );
}

/**
 * ManualInputItem - Simple input chip with remove
 */
function ManualInputItem({
  input,
  onRemove,
}: {
  input: InputDefinition;
  onRemove: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-muted/30 text-[11px] group">
      <code className="font-mono">{input.name}</code>
      {input.type && input.type !== 'text' && (
        <span className="text-[9px] bg-muted px-1 rounded">{input.type}</span>
      )}
      {input.required && <span className="text-[9px] text-orange-600">req</span>}
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive ml-1"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/**
 * ManualOutputItem - Simple output chip with remove
 */
function ManualOutputItem({
  output,
  onRemove,
}: {
  output: OutputDefinition;
  onRemove: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-muted/30 text-[11px] group">
      <code className="font-mono">{output.name}</code>
      {output.type && output.type !== 'text' && (
        <span className="text-[9px] bg-muted px-1 rounded">{output.type}</span>
      )}
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive ml-1"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function SkillConfigPanel({
  skill,
  agentName,
  onOpenEditor,
  edges = [],
  databases = [],
}: SkillConfigPanelProps) {
  const router = useRouter();
  const isOrgScoped = skill.agentId === null || skill.agentId === undefined;

  // State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(skill.name);
  const [isSaving, setIsSaving] = useState(false);
  const [localInputs, setLocalInputs] = useState<InputDefinition[]>(skill.inputs ?? []);
  const [localOutputs, setLocalOutputs] = useState<OutputDefinition[]>(skill.outputs ?? []);

  // Sync local state when skill changes
  useEffect(() => {
    setLocalInputs(skill.inputs ?? []);
    setLocalOutputs(skill.outputs ?? []);
  }, [skill.id, skill.inputs, skill.outputs]);

  // Parse connected tables from edges + input/output mappings
  const connectedTables = useMemo((): ConnectedTable[] => {
    const tableIds = new Set<number>();

    // 1. From edges (visual connections)
    edges.forEach((edge) => {
      if (edge.tableId) tableIds.add(edge.tableId);
    });

    // 2. From input mappings (skill reads from)
    localInputs.forEach((input) => {
      const tid = input.inputMapping?.source?.tableId;
      if (tid) tableIds.add(tid);
    });

    // 3. From output mappings (skill writes to)
    localOutputs.forEach((output) => {
      output.outputMapping?.tableMappings?.forEach((m) => {
        if (m.targetTableId) tableIds.add(m.targetTableId);
      });
    });

    // Look up table info from databases
    const tables: ConnectedTable[] = [];
    tableIds.forEach((tableId) => {
      for (const db of databases) {
        const table = db.tables?.find((t) => t.id === tableId);
        if (table) {
          tables.push({ tableId: table.id, tableName: table.name, dbName: db.name });
          break;
        }
      }
    });

    return tables;
  }, [edges, databases, localInputs, localOutputs]);

  // Group inputs by source table
  const inputsByTable = useMemo(() => {
    const byTable = new Map<number, InputDefinition[]>();
    const manual: InputDefinition[] = [];

    localInputs.forEach((input) => {
      const tableId = input.inputMapping?.source?.tableId;
      if (tableId) {
        const existing = byTable.get(tableId) || [];
        byTable.set(tableId, [...existing, input]);
      } else {
        manual.push(input);
      }
    });

    return { byTable, manual };
  }, [localInputs]);

  // Group outputs by target table
  const outputsByTable = useMemo(() => {
    const byTable = new Map<number, OutputDefinition[]>();
    const manual: OutputDefinition[] = [];

    localOutputs.forEach((output) => {
      const targetTableIds =
        output.outputMapping?.tableMappings?.map((m) => m.targetTableId) || [];
      if (targetTableIds.length > 0) {
        targetTableIds.forEach((tableId) => {
          const existing = byTable.get(tableId) || [];
          if (!existing.find((o) => o.name === output.name)) {
            byTable.set(tableId, [...existing, output]);
          }
        });
      } else {
        manual.push(output);
      }
    });

    return { byTable, manual };
  }, [localOutputs]);

  // Tables with mappings (for inputs OR outputs)
  const tablesWithInputMappings = useMemo(() => {
    return connectedTables.filter((t) => inputsByTable.byTable.has(t.tableId));
  }, [connectedTables, inputsByTable]);

  const tablesWithOutputMappings = useMemo(() => {
    return connectedTables.filter((t) => outputsByTable.byTable.has(t.tableId));
  }, [connectedTables, outputsByTable]);

  // Save helpers
  const saveMappings = useCallback(
    async (updates: { inputs?: InputDefinition[]; outputs?: OutputDefinition[] }) => {
      try {
        const result = await updateSkill(skill.id, updates);
        if (!result.success) {
          toast.error(result.error || 'Failed to save');
        }
      } catch {
        toast.error('Failed to save');
      }
    },
    [skill.id]
  );

  const handleInputsChange = useCallback(
    (inputs: InputDefinition[]) => {
      setLocalInputs(inputs);
      saveMappings({ inputs });
    },
    [saveMappings]
  );

  const handleOutputsChange = useCallback(
    (outputs: OutputDefinition[]) => {
      setLocalOutputs(outputs);
      saveMappings({ outputs });
    },
    [saveMappings]
  );

  // Add inputs from table
  const handleAddInputsFromTable = useCallback(
    (tableId: number, fields: FieldDTO[]) => {
      const existingNames = new Set(localInputs.map((i) => i.name));

      const newInputs: InputDefinition[] = fields.map((field) => {
        let name = field.name;
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
          inputMapping: {
            source: {
              tableId,
              fieldId: field.id,
              rowSource: { type: 'source_row' as const },
            },
          },
        };
      });

      handleInputsChange([...localInputs, ...newInputs]);
      toast.success(`Added ${fields.length} input${fields.length !== 1 ? 's' : ''}`);
    },
    [localInputs, handleInputsChange]
  );

  // Add outputs to table (creates outputs AND mapping)
  const handleAddOutputsToTable = useCallback(
    (tableId: number, fields: FieldDTO[]) => {
      const existingNames = new Set(localOutputs.map((o) => o.name));

      // Create new output definitions
      const newOutputs: OutputDefinition[] = fields.map((field) => {
        let name = field.name;
        if (existingNames.has(name)) {
          let suffix = 2;
          while (existingNames.has(`${field.name}_${suffix}`)) suffix++;
          name = `${field.name}_${suffix}`;
        }
        existingNames.add(name);

        return {
          name,
          type: fieldTypeToOutputType[field.type as FieldType] || 'text',
        };
      });

      // Create field mappings for the new outputs
      const newMappings: FieldMapping[] = fields.map((field, idx) => ({
        targetFieldId: field.id,
        source: {
          type: 'skill_output' as const,
          name: newOutputs[idx].name,
        },
      }));

      // Merge with existing outputs and update mapping
      const allOutputs = [...localOutputs, ...newOutputs];

      // Find or create table mapping
      const firstOutput = allOutputs[0];
      const existingTableMappings = firstOutput?.outputMapping?.tableMappings || [];
      const existingTableMapping = existingTableMappings.find(
        (m) => m.targetTableId === tableId
      );

      let updatedTableMappings: TableMapping[];
      if (existingTableMapping) {
        // Add to existing table mapping
        updatedTableMappings = existingTableMappings.map((m) =>
          m.targetTableId === tableId
            ? { ...m, mappings: [...(m.mappings || []), ...newMappings] }
            : m
        );
      } else {
        // Create new table mapping
        const newTableMapping: TableMapping = {
          order: existingTableMappings.length + 1,
          targetTableId: tableId,
          rowAction: 'create',
          mappings: newMappings,
        };
        updatedTableMappings = [...existingTableMappings, newTableMapping];
      }

      // Update first output with mapping
      const updatedOutputs = allOutputs.map((o, i) =>
        i === 0
          ? {
              ...o,
              outputMapping: {
                mode: (firstOutput?.outputMapping?.mode || 'single_row') as 'single_row' | 'multi_row',
                tableMappings: updatedTableMappings,
              },
            }
          : o
      );

      handleOutputsChange(updatedOutputs);
      toast.success(`Added ${fields.length} output${fields.length !== 1 ? 's' : ''} with mapping`);
    },
    [localOutputs, handleOutputsChange]
  );

  // Remove input
  const handleRemoveInput = useCallback(
    (inputName: string) => {
      handleInputsChange(localInputs.filter((i) => i.name !== inputName));
    },
    [localInputs, handleInputsChange]
  );

  // Remove output
  const handleRemoveOutput = useCallback(
    (outputName: string) => {
      handleOutputsChange(localOutputs.filter((o) => o.name !== outputName));
    },
    [localOutputs, handleOutputsChange]
  );

  // Add manual input
  const [showAddInput, setShowAddInput] = useState(false);
  const [newInputName, setNewInputName] = useState('');

  const handleAddManualInput = () => {
    if (!newInputName.trim()) return;
    const name = newInputName.trim();
    if (localInputs.some((i) => i.name === name)) {
      toast.error('Input name already exists');
      return;
    }
    handleInputsChange([...localInputs, { name, type: 'text', required: false }]);
    setNewInputName('');
    setShowAddInput(false);
  };

  // Add manual output
  const [showAddOutput, setShowAddOutput] = useState(false);
  const [newOutputName, setNewOutputName] = useState('');

  const handleAddManualOutput = () => {
    if (!newOutputName.trim()) return;
    const name = newOutputName.trim();
    if (localOutputs.some((o) => o.name === name)) {
      toast.error('Output name already exists');
      return;
    }
    handleOutputsChange([...localOutputs, { name, type: 'text' }]);
    setNewOutputName('');
    setShowAddOutput(false);
  };

  // Name editing
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
    } catch {
      toast.error('Failed to update name');
      setEditName(skill.name);
    } finally {
      setIsSaving(false);
      setIsEditingName(false);
    }
  }, [skill.id, skill.name, editName, router]);

  const handleCancelName = () => {
    setEditName(skill.name);
    setIsEditingName(false);
  };

  const getSkillUrl = () => {
    if (skill.agentId) {
      return `/agents/${skill.agentId}/skills/${skill.id}`;
    }
    return `/skills/${skill.id}`;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30 shrink-0">
          <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
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
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveName} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-600" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelName} disabled={isSaving}>
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
          {skill.executionType && (
            <Badge variant="secondary" className={cn('text-xs', getExecutionTypeBadgeColor(skill.executionType))}>
              {skill.executionType}
            </Badge>
          )}
        </div>
      </div>

      {/* Scope */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
            isOrgScoped
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          )}
        >
          {isOrgScoped ? (
            <>
              <Building2 className="h-3.5 w-3.5" />
              <span>Organization</span>
            </>
          ) : (
            <>
              <Bot className="h-3.5 w-3.5" />
              <span>{agentName || `Agent #${skill.agentId}`}</span>
            </>
          )}
        </div>
      </div>

      {/* Connected Tables (always visible at top) */}
      {connectedTables.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Connected Tables
          </Label>
          {connectedTables.map((table) => (
            <div
              key={table.tableId}
              className="flex items-center justify-between p-2 rounded-lg border bg-cyan-50/30 dark:bg-cyan-900/10"
            >
              <div className="flex items-center gap-1.5">
                <Table2 className="h-3.5 w-3.5 text-cyan-500" />
                <span className="text-xs font-medium">{table.tableName}</span>
                <span className="text-[10px] text-muted-foreground">({table.dbName})</span>
              </div>
              <div className="flex gap-1">
                <FieldPickerPopover
                  tableId={table.tableId}
                  buttonLabel="+ Inputs ↓"
                  onSelectFields={(fields) => handleAddInputsFromTable(table.tableId, fields)}
                />
                <FieldPickerPopover
                  tableId={table.tableId}
                  buttonLabel="+ Outputs ↓"
                  onSelectFields={(fields) => handleAddOutputsToTable(table.tableId, fields)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* INPUTS Section */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Inputs
          </Label>
          <span className="text-[10px] text-muted-foreground">
            {localInputs.length} total
          </span>
        </div>

        {/* Inputs from connected tables */}
        {tablesWithInputMappings.map((table) => (
          <TableInputGroup
            key={table.tableId}
            table={table}
            inputs={inputsByTable.byTable.get(table.tableId) || []}
            onAddFields={(fields) => handleAddInputsFromTable(table.tableId, fields)}
            onRemoveInput={handleRemoveInput}
          />
        ))}

        {/* Manual inputs (always show) */}
        <div className="rounded-lg border bg-muted/20 p-2.5">
          <div className="text-[10px] font-medium text-muted-foreground mb-2">
            Manual inputs
          </div>
            <div className="flex flex-wrap gap-1.5">
              {inputsByTable.manual.map((input) => (
                <ManualInputItem
                  key={input.name}
                  input={input}
                  onRemove={() => handleRemoveInput(input.name)}
                />
              ))}
              {showAddInput ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={newInputName}
                    onChange={(e) => setNewInputName(e.target.value)}
                    placeholder="input_name"
                    className="h-6 w-24 text-[11px] font-mono"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddManualInput();
                      if (e.key === 'Escape') {
                        setShowAddInput(false);
                        setNewInputName('');
                      }
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={handleAddManualInput}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5"
                    onClick={() => {
                      setShowAddInput(false);
                      setNewInputName('');
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-muted-foreground"
                  onClick={() => setShowAddInput(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add input
                </Button>
              )}
            </div>
          </div>
      </div>

      {/* OUTPUTS Section */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Outputs
          </Label>
          <span className="text-[10px] text-muted-foreground">
            {localOutputs.length} total
          </span>
        </div>

        {/* Outputs to connected tables */}
        {tablesWithOutputMappings.map((table) => (
          <TableOutputGroup
            key={table.tableId}
            table={table}
            outputs={outputsByTable.byTable.get(table.tableId) || []}
            onAddFields={(fields) => handleAddOutputsToTable(table.tableId, fields)}
            onRemoveOutput={handleRemoveOutput}
          />
        ))}

        {/* Manual outputs (always show) */}
        <div className="rounded-lg border bg-muted/20 p-2.5">
          <div className="text-[10px] font-medium text-muted-foreground mb-2">
            Manual outputs
          </div>
            <div className="flex flex-wrap gap-1.5">
              {outputsByTable.manual.map((output) => (
                <ManualOutputItem
                  key={output.name}
                  output={output}
                  onRemove={() => handleRemoveOutput(output.name)}
                />
              ))}
              {showAddOutput ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={newOutputName}
                    onChange={(e) => setNewOutputName(e.target.value)}
                    placeholder="output_name"
                    className="h-6 w-24 text-[11px] font-mono"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddManualOutput();
                      if (e.key === 'Escape') {
                        setShowAddOutput(false);
                        setNewOutputName('');
                      }
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={handleAddManualOutput}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5"
                    onClick={() => {
                      setShowAddOutput(false);
                      setNewOutputName('');
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-muted-foreground"
                  onClick={() => setShowAddOutput(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add output
                </Button>
              )}
            </div>
          </div>
      </div>

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
