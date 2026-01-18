'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, X, AlertCircle, Play, Database } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getPipedreamToolById, type PipedreamToolMetadata } from '@/app/actions/tools';
import { getTables } from '@/app/actions/tables';
import { getFields } from '@/app/actions/fields';
import type { TableDTO } from '@/app/mappers/table-mapper';
import type { ToolExecutionConfig, ToolInputMapping, InputDefinition } from '@/ddd/domain/skills/entities/skill';
import { SkillToolDropdown } from './SkillToolDropdown';

interface DiscoveredOutput {
  name: string;
  type: string;
  tableName?: string;
}

interface ToolExecutionConfigFormProps {
  value: ToolExecutionConfig | undefined;
  onChange: (config: ToolExecutionConfig | undefined) => void;
  skillInputs: InputDefinition[];
  onInputDefinitionsChange: (inputs: InputDefinition[]) => void;
  onDiscoveredOutputsChange?: (outputs: DiscoveredOutput[]) => void;
  disabled?: boolean;
}

/**
 * Form for configuring direct tool execution (executionType='tool').
 * Uses paginated search with infinite scroll for performance with large tool sets.
 */
export function ToolExecutionConfigForm({
  value,
  onChange,
  skillInputs,
  onInputDefinitionsChange,
  onDiscoveredOutputsChange,
  disabled
}: ToolExecutionConfigFormProps) {
  const [selectedTool, setSelectedTool] = useState<PipedreamToolMetadata | null>(null);

  // Output table state
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testRunError, setTestRunError] = useState<string | null>(null);
  const [discoveredOutputs, setDiscoveredOutputs] = useState<DiscoveredOutput[]>([]);

  // Load tables when tool is selected
  useEffect(() => {
    async function loadTables() {
      if (!selectedTool) return;
      setIsLoadingTables(true);
      try {
        const tablesData = await getTables();
        setTables(tablesData || []);
      } catch (err) {
        console.error('Error loading tables:', err);
      }
      setIsLoadingTables(false);
    }
    loadTables();
  }, [selectedTool]);

  // Load selected tool details when value changes
  useEffect(() => {
    async function loadSelectedTool() {
      if (value?.toolId) {
        const result = await getPipedreamToolById(value.toolId);
        if (result.success && result.data) {
          setSelectedTool(result.data);
        }
      } else {
        setSelectedTool(null);
      }
    }
    loadSelectedTool();
  }, [value?.toolId]);

  // Handle tool selection
  const handleSelectTool = (tool: PipedreamToolMetadata) => {
    setSelectedTool(tool);

    // Auto-create skill inputs from tool parameters
    const newInputs: InputDefinition[] = Object.entries(tool.inputs).map(([paramName, param]) => ({
      name: paramName,
      type: mapToolTypeToSkillType(param.type),
      required: param.required
    }));

    // Update skill inputs
    onInputDefinitionsChange(newInputs);

    // Create input mappings (skill input name = tool param name)
    const mappings: ToolInputMapping[] = Object.keys(tool.inputs).map(paramName => ({
      toolParam: paramName,
      skillInputName: paramName
    }));

    // Update config
    onChange({
      toolId: tool.id,
      inputMappings: mappings
    });
  };

  // Map tool parameter type to skill input type
  const mapToolTypeToSkillType = (toolType: string): InputDefinition['type'] => {
    switch (toolType.toLowerCase()) {
      case 'string':
        return 'text';
      case 'number':
      case 'integer':
        return 'text'; // We'll handle as text, validation can happen later
      case 'boolean':
        return 'text';
      case 'object':
      case 'array':
        return 'text'; // JSON as text
      default:
        return 'text';
    }
  };

  // Handle mapping change
  const handleMappingChange = (toolParam: string, skillInputName: string | undefined, staticValue?: string) => {
    if (!value) return;

    const newMappings = value.inputMappings.map(m => {
      if (m.toolParam === toolParam) {
        return {
          toolParam,
          skillInputName: skillInputName || undefined,
          staticValue: staticValue !== undefined ? staticValue : undefined
        };
      }
      return m;
    });

    onChange({
      ...value,
      inputMappings: newMappings
    });
  };

  // Clear tool selection
  const handleClearTool = () => {
    setSelectedTool(null);
    onChange(undefined);
    onInputDefinitionsChange([]);
    setDiscoveredOutputs([]);
    onDiscoveredOutputsChange?.([]);
  };

  // Handle output table selection
  const handleOutputTableChange = async (tableId: number | null) => {
    if (!value) return;

    onChange({
      ...value,
      outputTableId: tableId || undefined
    });

    // If table selected, load its columns as discovered outputs
    if (tableId) {
      const selectedTable = tables.find(t => t.id === tableId);
      if (selectedTable) {
        try {
          const fields = await getFields(tableId);
          // Filter out system fields (id, etc.)
          const writableFields = fields.filter(f => f.name !== 'id' && f.type !== 'autonumber');
          const outputs: DiscoveredOutput[] = writableFields.map(f => ({
            name: f.name,
            type: f.type,
            tableName: selectedTable.name
          }));
          setDiscoveredOutputs(outputs);
          onDiscoveredOutputsChange?.(outputs);
        } catch (err) {
          console.error('Error loading table fields:', err);
        }
      }
    } else {
      setDiscoveredOutputs([]);
      onDiscoveredOutputsChange?.([]);
    }
  };

  // Handle test run to discover output schema
  const handleTestRun = async () => {
    if (!value?.toolId || !value?.outputTableId) {
      setTestRunError('Select a tool and output table first');
      return;
    }

    setIsTestRunning(true);
    setTestRunError(null);

    try {
      const response = await fetch('/api/tools/test-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: value.toolId,
          tableId: value.outputTableId,
          // Use empty/default values for required inputs
          inputs: {}
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Test run failed');
      }

      // Update discovered outputs from response
      if (result.discoveredColumns) {
        const outputs: DiscoveredOutput[] = result.discoveredColumns.map((col: { name: string; type: string }) => ({
          name: col.name,
          type: col.type,
          tableName: tables.find(t => t.id === value.outputTableId)?.name
        }));
        setDiscoveredOutputs(outputs);
        onDiscoveredOutputsChange?.(outputs);
      }
    } catch (err) {
      setTestRunError(err instanceof Error ? err.message : 'Test run failed');
    } finally {
      setIsTestRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Selected Tool Display */}
      {selectedTool ? (
        <div className="border rounded-lg p-4 bg-primary/5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{selectedTool.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {selectedTool.app}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedTool.description}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearTool}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Input Mappings */}
          {value && value.inputMappings.length > 0 && (
            <div className="mt-4 space-y-3">
              <Label className="text-sm font-medium">Input Mappings</Label>
              <div className="space-y-2">
                {value.inputMappings.map((mapping) => {
                  const toolInput = selectedTool.inputs[mapping.toolParam];
                  return (
                    <div key={mapping.toolParam} className="flex items-center gap-2">
                      <div className="flex-1">
                        <Select
                          value={mapping.skillInputName || '__static__'}
                          onValueChange={(val) => {
                            if (val === '__static__') {
                              handleMappingChange(mapping.toolParam, undefined, '');
                            } else {
                              handleMappingChange(mapping.toolParam, val);
                            }
                          }}
                          disabled={disabled}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select input..." />
                          </SelectTrigger>
                          <SelectContent>
                            {skillInputs.map(input => (
                              <SelectItem key={input.name} value={input.name}>
                                {input.name}
                              </SelectItem>
                            ))}
                            <SelectItem value="__static__">
                              Static value
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <span className="text-muted-foreground">→</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{mapping.toolParam}</span>
                          {toolInput?.required && (
                            <Badge variant="outline" className="text-xs">required</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {toolInput?.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Output Table Connection */}
          <div className="mt-4 space-y-3 pt-3 border-t">
            <div>
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                Output Table
              </Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Connect a table to store outputs. Run test to auto-discover columns.
              </p>
            </div>
            <div className="flex gap-2">
              <Select
                value={value?.outputTableId?.toString() || '__none__'}
                onValueChange={(val) => {
                  if (val === '__none__') {
                    handleOutputTableChange(null);
                  } else {
                    handleOutputTableChange(parseInt(val));
                  }
                }}
                disabled={disabled || isLoadingTables}
              >
                <SelectTrigger className="flex-1 h-8 text-sm">
                  <SelectValue placeholder="Select table..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No output table</SelectItem>
                  {tables.map(table => (
                    <SelectItem key={table.id} value={table.id.toString()}>
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestRun}
                disabled={disabled || !value?.outputTableId || isTestRunning}
                className="h-8 px-3"
              >
                {isTestRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Play className="h-3 w-3 mr-1" />
                    Test
                  </>
                )}
              </Button>
            </div>

            {/* Test run error */}
            {testRunError && (
              <div className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {testRunError}
              </div>
            )}

            {/* Discovered outputs */}
            {discoveredOutputs.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Discovered Outputs</Label>
                <div className="flex flex-wrap gap-1">
                  {discoveredOutputs.map((output) => (
                    <Badge key={output.name} variant="secondary" className="text-[10px]">
                      {output.name}
                      <span className="text-muted-foreground ml-1">({output.type})</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Tool Selector with infinite scroll and filters - reuses chat dropdown components */
        <SkillToolDropdown
          onSelectTool={handleSelectTool}
          disabled={disabled}
        />
      )}
    </div>
  );
}
