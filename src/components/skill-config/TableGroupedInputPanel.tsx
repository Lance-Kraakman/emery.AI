'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Table2, ArrowLeft, Plus, X, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldPickerPopover } from './FieldPickerPopover';
import { ManualInputItem } from './ManualInputItem';
import { fieldTypeToInputType } from './field-type-maps';
import { serializeRowIdSource, deserializeRowIdSource } from './mapping-serializers';
import { useTableFields } from './hooks/useTableFields';
import { TriggerVariablePanel } from './TriggerVariablePanel';
import { getTables } from '@/app/actions/tables';
import { getDatabases } from '@/app/actions/databases';
import type { InputDefinition } from '@/app/mappers/skill-mapper';
import type { TableDTO } from '@/app/mappers/table-mapper';
import type { DatabaseDTO } from '@/app/dtos/database.dto';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import type { AutomationConfigurationDTO } from '@/app/dtos/automation.dto';

interface TableGroupedInputPanelProps {
  inputs: InputDefinition[];
  onInputsChange: (inputs: InputDefinition[]) => void;
  isReadOnly?: boolean;
  /** Optional list of agent automations for "From Automation" feature */
  automations?: AutomationConfigurationDTO[];
}

export function TableGroupedInputPanel({
  inputs,
  onInputsChange,
  isReadOnly = false,
  automations = [],
}: TableGroupedInputPanelProps) {
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [databases, setDatabases] = useState<DatabaseDTO[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [showAddManual, setShowAddManual] = useState(false);
  const [newInputName, setNewInputName] = useState('');
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set());
  const [showTriggerPanel, setShowTriggerPanel] = useState(false);

  // Load tables and databases for selectors
  useEffect(() => {
    Promise.all([getTables(), getDatabases()])
      .then(([tablesData, databasesData]) => {
        setTables(tablesData);
        setDatabases(databasesData);
      })
      .finally(() => setTablesLoading(false));
  }, []);

  // Group inputs by source table (only table_field mappings, not trigger_variable)
  const { byTable, manual } = useMemo(() => {
    const byTable = new Map<number, InputDefinition[]>();
    const manual: InputDefinition[] = [];
    inputs.forEach((input) => {
      const source = input.inputMapping?.source;
      if (source && source.type === 'table_field') {
        const list = byTable.get(source.tableId) || [];
        list.push(input);
        byTable.set(source.tableId, list);
      } else {
        manual.push(input);
      }
    });
    return { byTable, manual };
  }, [inputs]);

  // Collect all table IDs referenced by inputs
  const tableIds = useMemo(() => Array.from(byTable.keys()), [byTable]);
  const { tableFieldsMap, fetchFieldsForTable } = useTableFields(tableIds);

  // --- Handlers ---

  const handleAddInputsFromTable = (tableId: number, fields: FieldDTO[]) => {
    const existingNames = new Set(inputs.map((i) => i.name));
    const newInputs: InputDefinition[] = [];

    fields.forEach((field) => {
      const inputType = fieldTypeToInputType[field.type as FieldType];
      if (inputType === null) return; // Skip system fields

      let name = field.name.toLowerCase().replace(/\s+/g, '_');
      // Deduplicate names
      if (existingNames.has(name)) {
        let suffix = 2;
        while (existingNames.has(`${name}_${suffix}`)) suffix++;
        name = `${name}_${suffix}`;
      }
      existingNames.add(name);

      newInputs.push({
        name,
        required: false,
        type: inputType || 'text',
        inputMapping: {
          source: {
            type: 'table_field',
            tableId,
            fieldId: field.id,
            rowSource: { type: 'source_row' },
          },
        },
      });
    });

    if (newInputs.length > 0) {
      onInputsChange([...inputs, ...newInputs]);
      setExpandedTables((prev) => new Set(prev).add(tableId));
    }
  };

  const handleUpdateInput = (inputName: string, updated: InputDefinition) => {
    const source = updated.inputMapping?.source;
    if (source && source.type === 'table_field') {
      fetchFieldsForTable(source.tableId);
    }
    onInputsChange(inputs.map((i) => (i.name === inputName ? updated : i)));
  };

  const handleRemoveInput = (inputName: string) => {
    onInputsChange(inputs.filter((i) => i.name !== inputName));
  };

  const handleAddManualInput = () => {
    const name = newInputName.trim();
    if (!name || inputs.some((i) => i.name === name)) return;
    onInputsChange([...inputs, { name, required: false, type: 'text' }]);
    setNewInputName('');
    setShowAddManual(false);
  };

  const toggleTableCollapse = (tableId: number) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  };

  const handleRemoveTableGroup = (tableId: number) => {
    onInputsChange(inputs.filter((i) => {
      const source = i.inputMapping?.source;
      return !(source && source.type === 'table_field' && source.tableId === tableId);
    }));
  };

  const handleClearAll = () => {
    onInputsChange([]);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Inputs</Label>
        <span className="text-[10px] text-muted-foreground">{inputs.length} total</span>
      </div>

      {/* Table-grouped inputs */}
      {Array.from(byTable.entries()).map(([tableId, tableInputs]) => {
        const table = tables.find((t) => t.id === tableId);
        const tableName = table?.name || `Table #${tableId}`;
        const fields = tableFieldsMap.get(tableId) || [];
        const isCollapsed = !expandedTables.has(tableId);

        return (
          <div
            key={tableId}
            className="rounded-lg border bg-emerald-50/30 dark:bg-emerald-900/10 p-2.5"
          >
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleTableCollapse(tableId)}
            >
              <div className="flex items-center gap-1.5 flex-nowrap min-w-0">
                <Table2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 truncate max-w-[160px]"
                  title={tableName}
                >
                  From: {tableName}
                </span>
                {isCollapsed && (
                  <span className="text-[10px] text-muted-foreground">
                    ({tableInputs.length} field{tableInputs.length !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!isReadOnly && (
                  <button
                    type="button"
                    className="h-5 w-5 rounded text-muted-foreground hover:text-destructive hover:bg-muted flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTableGroup(tableId);
                    }}
                    title="Remove table group"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {!isCollapsed && (
              <>
                <div className="space-y-1 mt-2">
                  {tableInputs.map((input) => (
                    <InputMappingRow
                      key={input.name}
                      input={input}
                      fields={fields}
                      otherInputs={inputs.filter((i) => i.name !== input.name)}
                      onUpdate={(updated) => handleUpdateInput(input.name, updated)}
                      onRemove={() => handleRemoveInput(input.name)}
                      isReadOnly={isReadOnly}
                    />
                  ))}
                </div>

                {!isReadOnly && (
                  <FieldPickerPopover
                    tableId={tableId}
                    buttonLabel="+ Add fields"
                    onSelectFields={(selectedFields) =>
                      handleAddInputsFromTable(tableId, selectedFields)
                    }
                  />
                )}
              </>
            )}
          </div>
        );
      })}

      {/* Manual inputs */}
      {(manual.length > 0 || showAddManual) && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {manual.map((input) => (
              <ManualInputItem
                key={input.name}
                input={input}
                onRemove={() => handleRemoveInput(input.name)}
                onToggleRequired={() => handleUpdateInput(input.name, { ...input, required: !input.required })}
              />
            ))}
          </div>
          {showAddManual && (
            <div className="flex items-center gap-1.5">
              <Input
                value={newInputName}
                onChange={(e) => setNewInputName(e.target.value)}
                placeholder="input_name"
                className="h-7 text-xs w-32"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddManualInput();
                  if (e.key === 'Escape') setShowAddManual(false);
                }}
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddManualInput}
                className="h-6 px-2 text-[11px]"
                disabled={!newInputName.trim()}
              >
                Add
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddManual(false)}
                className="h-6 px-1 text-[11px]"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {!isReadOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          {!showAddManual && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAddManual(true)}
              className="h-6 px-2 text-[10px] text-muted-foreground"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add input
            </Button>
          )}
          {!tablesLoading && tables.length > 0 && (
            <FromTableButton
              tables={tables}
              databases={databases}
              onSelectTable={(tableId) => fetchFieldsForTable(tableId)}
              onAddFields={(tableId, fields) => handleAddInputsFromTable(tableId, fields)}
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowTriggerPanel(!showTriggerPanel)}
            className={`h-6 px-2 text-[10px] ${showTriggerPanel ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
          >
            <Zap className="h-3 w-3 mr-1" />
            From Automation
          </Button>
          {inputs.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive ml-auto"
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* Trigger Variable Panel */}
      {showTriggerPanel && !isReadOnly && (
        <TriggerVariablePanel
          onAddInputs={(newInputs) => {
            onInputsChange([...inputs, ...newInputs]);
            setShowTriggerPanel(false);
          }}
          existingInputNames={new Set(inputs.map(i => i.name))}
          automations={automations}
        />
      )}
    </div>
  );
}

// --- Internal sub-components ---

/** Single input row within a table group, showing field + row source selectors */
function InputMappingRow({
  input,
  fields,
  otherInputs,
  onUpdate,
  onRemove,
  isReadOnly,
}: {
  input: InputDefinition;
  fields: FieldDTO[];
  otherInputs: InputDefinition[];
  onUpdate: (input: InputDefinition) => void;
  onRemove: () => void;
  isReadOnly?: boolean;
}) {
  const mapping = input.inputMapping;
  const source = mapping?.source;
  const isTableField = source && source.type === 'table_field';
  const selectedFieldId = isTableField ? source.fieldId : undefined;
  const rowSource = isTableField ? source.rowSource : undefined;

  const handleFieldChange = (fieldId: number) => {
    if (!mapping || !isTableField) return;
    onUpdate({
      ...input,
      inputMapping: {
        source: { ...source, fieldId },
      },
    });
  };

  const handleRowSourceChange = (value: string) => {
    if (!mapping || !isTableField) return;
    const newRowSource = deserializeRowIdSource(value);
    if (newRowSource) {
      onUpdate({
        ...input,
        inputMapping: {
          source: { ...source, rowSource: newRowSource },
        },
      });
    }
  };

  return (
    <div className="flex items-center gap-1.5 py-1 px-2 bg-background/60 rounded group flex-wrap">
      <code className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
        {input.name}
      </code>
      <button
        type="button"
        className="text-[9px] hover:opacity-70"
        onClick={() => onUpdate({ ...input, required: !input.required })}
        disabled={isReadOnly}
      >
        {input.required
          ? <span className="text-orange-600">req</span>
          : <span className="text-muted-foreground">opt</span>}
      </button>

      <ArrowLeft className="h-3 w-3 text-muted-foreground shrink-0" />

      {/* Field selector */}
      <Select
        value={selectedFieldId?.toString() || ''}
        onValueChange={(v) => handleFieldChange(parseInt(v))}
        disabled={isReadOnly || fields.length === 0}
      >
        <SelectTrigger className="h-6 w-[110px] text-[10px]">
          <SelectValue placeholder="Field..." />
        </SelectTrigger>
        <SelectContent>
          {fields.map((field) => (
            <SelectItem key={field.id} value={field.id.toString()}>
              <span>{field.name}</span>
              <span className="text-[9px] text-muted-foreground ml-1">({field.type})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Row source selector */}
      <Select
        value={serializeRowIdSource(rowSource)}
        onValueChange={handleRowSourceChange}
        disabled={isReadOnly}
      >
        <SelectTrigger className="h-6 w-[110px] text-[10px]">
          <SelectValue placeholder="Row..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="source_row">Source Row</SelectItem>
          {otherInputs.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[10px]">From Skill Input</SelectLabel>
              {otherInputs.map((inp) => (
                <SelectItem key={`input:${inp.name}`} value={`input:${inp.name}`}>
                  Input: {inp.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      {/* Remove */}
      {!isReadOnly && (
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded text-muted-foreground hover:text-destructive flex items-center justify-center ml-auto"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/** Button to add inputs from a table - dropdown opens on first click */
function FromTableButton({
  tables,
  databases,
  onSelectTable,
  onAddFields,
}: {
  tables: TableDTO[];
  databases: DatabaseDTO[];
  onSelectTable: (tableId: number) => void;
  onAddFields: (tableId: number, fields: FieldDTO[]) => void;
}) {
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

  // Group tables by database
  const tablesByDatabase = useMemo(() => {
    const grouped = new Map<number, TableDTO[]>();
    tables.forEach((table) => {
      const list = grouped.get(table.databaseId) || [];
      list.push(table);
      grouped.set(table.databaseId, list);
    });
    return grouped;
  }, [tables]);

  // Show field picker after table selected
  if (selectedTableId) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">
          {tables.find((t) => t.id === selectedTableId)?.name}:
        </span>
        <FieldPickerPopover
          tableId={selectedTableId}
          buttonLabel="Pick fields"
          onSelectFields={(fields) => {
            onAddFields(selectedTableId, fields);
            setSelectedTableId(null);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSelectedTableId(null)}
          className="h-5 px-1"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Default: show dropdown directly
  return (
    <Select
      onValueChange={(v) => {
        const id = parseInt(v);
        onSelectTable(id);
        setSelectedTableId(id);
      }}
    >
      <SelectTrigger className="h-6 w-auto min-w-0 px-2 text-[10px] text-muted-foreground border-0 bg-transparent hover:bg-accent">
        <Table2 className="h-3 w-3 mr-1" />
        <span>From Table</span>
      </SelectTrigger>
      <SelectContent>
        {Array.from(tablesByDatabase.entries()).map(([dbId, dbTables]) => {
          const db = databases.find((d) => d.id === dbId);
          return (
            <SelectGroup key={dbId}>
              <SelectLabel className="text-[10px] text-muted-foreground">{db?.name || 'Unknown'}</SelectLabel>
              {dbTables.map((table) => (
                <SelectItem key={table.id} value={table.id.toString()}>
                  {table.name}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
