'use client';

import { useEffect, useState, useCallback } from 'react';
import { Database, Plus, X, ArrowRight, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkflowVariableInput } from '@/components/workflow-canvas/WorkflowVariableInput';
import { getTables } from '@/app/actions/tables';
import { getFields } from '@/app/actions/fields';
import type { TableDTO } from '@/app/mappers/table-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { ReadFieldMapping } from '@/ddd/domain/skills/entities/skill';
import type { ConfigWithWorkflowVariables, ReadNodeData } from './types';

/**
 * Read node config - database read configuration with table selector and row ID source
 */
export function ReadConfig({
  data,
  onUpdate,
  workflowVariables = [],
  disabled,
}: ConfigWithWorkflowVariables<ReadNodeData>) {
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);

  // Load tables on mount
  useEffect(() => {
    getTables().then(setTables).finally(() => setLoadingTables(false));
  }, []);

  const readConfig = data.readConfig || {
    mode: 'single_row' as const,
    sourceTableId: 0,
    fieldMappings: [],
  };

  const updateReadConfig = (updates: Partial<typeof readConfig>) => {
    onUpdate({ readConfig: { ...readConfig, ...updates } });
  };

  const selectedTable = tables.find(t => t.id === readConfig.sourceTableId);

  // Load fields when table changes
  useEffect(() => {
    async function loadFields() {
      if (!readConfig.sourceTableId) {
        setFields([]);
        return;
      }
      setLoadingFields(true);
      try {
        const fieldsData = await getFields(readConfig.sourceTableId);
        // Filter out the synthetic 'id' field
        setFields(fieldsData.filter(f => f.name !== 'id'));
      } catch {
        setFields([]);
      }
      setLoadingFields(false);
    }
    loadFields();
  }, [readConfig.sourceTableId]);

  // Field mapping helpers
  const addFieldMapping = useCallback(() => {
    const newMappings: ReadFieldMapping[] = [
      ...(readConfig.fieldMappings || []),
      { sourceFieldId: 0, targetVariable: '' },
    ];
    updateReadConfig({ fieldMappings: newMappings });
  }, [readConfig.fieldMappings]);

  const removeFieldMapping = useCallback((index: number) => {
    const newMappings = (readConfig.fieldMappings || []).filter((_, i) => i !== index);
    updateReadConfig({ fieldMappings: newMappings });
  }, [readConfig.fieldMappings]);

  const updateFieldMapping = useCallback((index: number, updates: Partial<ReadFieldMapping>) => {
    const newMappings = [...(readConfig.fieldMappings || [])];
    newMappings[index] = { ...newMappings[index], ...updates };
    updateReadConfig({ fieldMappings: newMappings });
  }, [readConfig.fieldMappings]);

  const autoAddAllFields = useCallback(() => {
    if (!fields.length) return;
    const mappings: ReadFieldMapping[] = fields.map(field => ({
      sourceFieldId: field.id,
      targetVariable: field.name.toLowerCase().replace(/\s+/g, '_'),
    }));
    updateReadConfig({ fieldMappings: mappings });
  }, [fields]);

  // Get field name by ID for display
  const getFieldName = (fieldId: number) => {
    const field = fields.find(f => f.id === fieldId);
    return field?.name || `Field #${fieldId}`;
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Read Mode</Label>
        <Select
          value={readConfig.mode}
          onValueChange={(value: 'single_row' | 'query') =>
            updateReadConfig({ mode: value })
          }
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single_row">Single Row</SelectItem>
            <SelectItem value="query">Query (Multiple Rows)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Source Table</Label>
        <Select
          value={readConfig.sourceTableId?.toString() || ''}
          onValueChange={(v) => updateReadConfig({ sourceTableId: parseInt(v) || 0 })}
          disabled={disabled || loadingTables}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder={loadingTables ? "Loading..." : "Select table..."} />
          </SelectTrigger>
          <SelectContent>
            {tables.map((table) => (
              <SelectItem key={table.id} value={table.id.toString()}>
                <div className="flex items-center gap-1.5">
                  <Database className="h-3 w-3 text-muted-foreground" />
                  {table.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedTable && (
          <p className="text-[10px] text-muted-foreground">
            Reading from: {selectedTable.name}
          </p>
        )}
      </div>

      {/* Row ID Source - only for single_row mode */}
      {readConfig.mode === 'single_row' && (
        <div className="space-y-1">
          <Label className="text-xs">Row ID Source</Label>
          <Select
            value={readConfig.rowIdSource?.type || 'skill_input'}
            onValueChange={(type: 'skill_input' | 'static') =>
              updateReadConfig({
                rowIdSource: type === 'static'
                  ? { type: 'static', staticId: '' }
                  : { type: 'skill_input', skillInput: '' }
              })
            }
            disabled={disabled}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skill_input">From Variable</SelectItem>
              <SelectItem value="static">Static ID</SelectItem>
            </SelectContent>
          </Select>

          {readConfig.rowIdSource?.type === 'skill_input' && (
            <WorkflowVariableInput
              value={readConfig.rowIdSource.skillInput || ''}
              onChange={(v) => updateReadConfig({
                rowIdSource: { type: 'skill_input', skillInput: v }
              })}
              variables={workflowVariables}
              placeholder="e.g., {{rowId}}"
              disabled={disabled}
              className="h-8"
            />
          )}

          {readConfig.rowIdSource?.type === 'static' && (
            <Input
              value={readConfig.rowIdSource.staticId || ''}
              onChange={(e) => updateReadConfig({
                rowIdSource: { type: 'static', staticId: e.target.value }
              })}
              placeholder="Row ID"
              disabled={disabled}
              className="h-8 text-sm"
            />
          )}
        </div>
      )}

      {readConfig.mode === 'query' && (
        <div className="space-y-1">
          <Label className="text-xs">Max Results</Label>
          <Input
            type="number"
            value={readConfig.queryLimit || 100}
            onChange={(e) =>
              updateReadConfig({ queryLimit: parseInt(e.target.value) || 100 })
            }
            placeholder="100"
            disabled={disabled}
            className="h-8 text-sm"
          />
        </div>
      )}

      {/* Field Mappings */}
      {readConfig.sourceTableId > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <Label className="text-xs">
              Field Mappings ({readConfig.fieldMappings?.length || 0})
            </Label>
            {fields.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={autoAddAllFields}
                disabled={disabled || loadingFields}
                className="h-6 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Add all fields
              </Button>
            )}
          </div>

          {loadingFields ? (
            <p className="text-xs text-muted-foreground">Loading fields...</p>
          ) : fields.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No fields found in this table.
            </p>
          ) : (
            <>
              <p className="text-[10px] text-muted-foreground">
                Map table fields to output variables that downstream nodes can use.
              </p>

              {/* Existing mappings */}
              {(readConfig.fieldMappings || []).map((mapping, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  {/* Source field selector */}
                  <Select
                    value={mapping.sourceFieldId?.toString() || ''}
                    onValueChange={(v) =>
                      updateFieldMapping(index, {
                        sourceFieldId: parseInt(v) || 0,
                        // Auto-generate variable name from field name
                        targetVariable: mapping.targetVariable ||
                          (fields.find(f => f.id === parseInt(v))?.name || '')
                            .toLowerCase()
                            .replace(/\s+/g, '_'),
                      })
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((field) => (
                        <SelectItem key={field.id} value={field.id.toString()}>
                          {field.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />

                  {/* Output variable name */}
                  <Input
                    value={mapping.targetVariable || ''}
                    onChange={(e) =>
                      updateFieldMapping(index, { targetVariable: e.target.value })
                    }
                    placeholder="variable_name"
                    disabled={disabled}
                    className="h-7 text-xs flex-1 font-mono"
                  />

                  {/* Remove button */}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeFieldMapping(index)}
                    disabled={disabled}
                    className="h-7 w-7 p-0 flex-shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}

              {/* Add field button */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addFieldMapping}
                disabled={disabled}
                className="h-7 text-xs w-full"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add field mapping
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
