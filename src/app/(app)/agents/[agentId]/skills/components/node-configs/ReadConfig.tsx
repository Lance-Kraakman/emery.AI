'use client';

import { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkflowVariableInput } from '@/components/workflow-canvas/WorkflowVariableInput';
import { getTables } from '@/app/actions/tables';
import type { TableDTO } from '@/app/mappers/table-mapper';
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
  const [loading, setLoading] = useState(true);

  // Load tables on mount
  useEffect(() => {
    getTables().then(setTables).finally(() => setLoading(false));
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
          disabled={disabled || loading}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder={loading ? "Loading..." : "Select table..."} />
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

      <div className="space-y-1">
        <Label className="text-xs">
          Field Mappings ({readConfig.fieldMappings?.length || 0})
        </Label>
        <p className="text-[10px] text-muted-foreground">
          Configure which table fields map to output variables in the Output
          section below
        </p>
      </div>
    </div>
  );
}
