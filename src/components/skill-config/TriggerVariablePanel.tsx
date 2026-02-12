'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Zap, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { InstructionTemplateService } from '@/ddd/domain/tasks/services/instruction-template-service';
import type { TriggerType } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import type { InputDefinition } from '@/ddd/domain/skills/entities/skill';
import type { AutomationConfigurationDTO } from '@/app/dtos/automation.dto';
import { TableSelector } from '@/app/(app)/agents/components/TableSelector';
import { getSampleRow } from '@/app/actions/rows';

type SelectionMode = 'automation' | 'trigger';

interface TriggerVariablePanelProps {
  onAddInputs: (inputs: InputDefinition[]) => void;
  existingInputNames: Set<string>;
  defaultTriggerType?: TriggerType;
  defaultTableId?: string;
  sampleRowData?: Record<string, any> | null;
  /** Optional list of agent automations to select from */
  automations?: AutomationConfigurationDTO[];
}

interface VariableOption {
  name: string;
  description: string;
  isDynamic?: boolean;  // For row.* fields that come from table
}

/**
 * Panel for selecting trigger context variables to add as skill inputs.
 * Similar to "Add from table" but for automation trigger variables.
 *
 * Supports two modes:
 * 1. "From Existing Automation" - Select an automation and auto-populate its trigger variables
 * 2. "From Trigger Type" - Manually select a trigger type and configure
 */
export function TriggerVariablePanel({
  onAddInputs,
  existingInputNames,
  defaultTriggerType,
  defaultTableId,
  sampleRowData,
  automations = [],
}: TriggerVariablePanelProps) {
  // Mode toggle - only show if automations are available
  const hasAutomations = automations.length > 0;
  const [mode, setMode] = useState<SelectionMode>(hasAutomations ? 'automation' : 'trigger');

  // Automation selection state
  const [selectedAutomationIndex, setSelectedAutomationIndex] = useState<number | null>(null);

  // Trigger configuration state
  const [triggerType, setTriggerType] = useState<TriggerType>(defaultTriggerType || 'DATABASE_EVENT');
  const [selectedTableId, setSelectedTableId] = useState<string | undefined>(defaultTableId);
  const [selectedVariables, setSelectedVariables] = useState<Set<string>>(new Set());
  const [localSampleData, setLocalSampleData] = useState<Record<string, any> | null>(sampleRowData || null);

  // When an automation is selected, auto-populate trigger type and table
  useEffect(() => {
    if (mode === 'automation' && selectedAutomationIndex !== null && automations[selectedAutomationIndex]) {
      const automation = automations[selectedAutomationIndex];
      const trigger = automation.trigger;

      setTriggerType(trigger.type);

      // For DATABASE_EVENT, also set the table and fetch sample data
      if (trigger.type === 'DATABASE_EVENT' && trigger.tableId) {
        setSelectedTableId(trigger.tableId);
        // Fetch sample data for this table
        getSampleRow(parseInt(trigger.tableId))
          .then(result => {
            if (result.success && result.data) {
              setLocalSampleData(result.data.sampleData);
            }
          })
          .catch(err => console.error('Error fetching sample row:', err));
      } else {
        setSelectedTableId(undefined);
        setLocalSampleData(null);
      }

      // Clear selections when switching automations
      setSelectedVariables(new Set());
    }
  }, [mode, selectedAutomationIndex, automations]);

  // Get base variables for the trigger type (without row fields)
  const baseVariables = useMemo(() => {
    return InstructionTemplateService.getAvailableVariables(triggerType)
      .filter(v => !v.name.includes('{'))  // Filter out template variables like row.{fieldName}
      .map(v => ({ ...v, isDynamic: false }));
  }, [triggerType]);

  // Get row field variables from sample data (for DATABASE_EVENT)
  const rowFieldVariables = useMemo((): VariableOption[] => {
    if (triggerType !== 'DATABASE_EVENT' || !localSampleData) return [];

    return Object.keys(localSampleData).map(fieldName => ({
      name: `row.${fieldName}`,
      description: `Value of ${fieldName} field`,
      isDynamic: true
    }));
  }, [triggerType, localSampleData]);

  // Combine all variables
  const allVariables = useMemo(() => {
    return [...baseVariables, ...rowFieldVariables];
  }, [baseVariables, rowFieldVariables]);

  // Toggle variable selection
  const toggleVariable = (varName: string) => {
    setSelectedVariables(prev => {
      const next = new Set(prev);
      if (next.has(varName)) {
        next.delete(varName);
      } else {
        next.add(varName);
      }
      return next;
    });
  };

  // Add selected variables as inputs
  const handleAddSelected = () => {
    if (selectedVariables.size === 0) return;

    const newInputs: InputDefinition[] = [];
    const usedNames = new Set(existingInputNames);

    selectedVariables.forEach(varName => {
      // Convert variable name to input name (e.g., "row.email" -> "row_email")
      let inputName = varName.replace(/\./g, '_').replace(/\$/g, '');

      // Deduplicate names
      if (usedNames.has(inputName)) {
        let suffix = 2;
        while (usedNames.has(`${inputName}_${suffix}`)) suffix++;
        inputName = `${inputName}_${suffix}`;
      }
      usedNames.add(inputName);

      newInputs.push({
        name: inputName,
        required: false,
        type: 'text',
        inputMapping: {
          source: {
            type: 'trigger_variable',
            variable: `$${varName}`  // Store with $ prefix
          }
        }
      });
    });

    onAddInputs(newInputs);
    setSelectedVariables(new Set());
  };

  // Handle table selection for DATABASE_EVENT
  const handleTableSelect = async (tableId: string | undefined) => {
    setSelectedTableId(tableId);
    if (tableId) {
      try {
        const result = await getSampleRow(parseInt(tableId));
        if (result.success && result.data) {
          setLocalSampleData(result.data.sampleData);
        } else {
          setLocalSampleData(null);
        }
      } catch (err) {
        console.error('Error fetching sample row:', err);
        setLocalSampleData(null);
      }
    } else {
      setLocalSampleData(null);
    }
  };

  return (
    <div className="space-y-2 p-3 border rounded-lg">
      {/* Mode toggle - only show if automations available */}
      {hasAutomations && (
        <div className="flex items-center gap-1 mb-2">
          <button
            type="button"
            onClick={() => setMode('automation')}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md transition-colors ${
              mode === 'automation'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Zap className="h-3 w-3" />
            From Automation
          </button>
          <button
            type="button"
            onClick={() => setMode('trigger')}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md transition-colors ${
              mode === 'trigger'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Settings2 className="h-3 w-3" />
            From Trigger Type
          </button>
        </div>
      )}

      {/* Automation selector (when in automation mode) */}
      {mode === 'automation' && hasAutomations && (
        <div className="flex items-center gap-2">
          <Select
            value={selectedAutomationIndex?.toString() ?? ''}
            onValueChange={(v) => setSelectedAutomationIndex(v ? parseInt(v) : null)}
          >
            <SelectTrigger className="h-6 text-[10px] flex-1">
              <SelectValue placeholder="Select automation..." />
            </SelectTrigger>
            <SelectContent>
              {automations.map((automation, index) => (
                <SelectItem key={index} value={index.toString()}>
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3" />
                    <span>{automation.name || `Automation ${index + 1}`}</span>
                    <Badge variant="outline" className="text-[8px] px-1 py-0">
                      {automation.trigger.type.replace('_', ' ').toLowerCase()}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Trigger type selector (when in trigger mode or no automations) */}
      {(mode === 'trigger' || !hasAutomations) && (
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={triggerType} onValueChange={(v) => setTriggerType(v as TriggerType)}>
            <SelectTrigger className="h-6 w-[130px] text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DATABASE_EVENT">Database Event</SelectItem>
              <SelectItem value="CALENDAR">Calendar</SelectItem>
              <SelectItem value="WEBHOOK">Webhook</SelectItem>
              <SelectItem value="PIPEDREAM_EVENT">External Event</SelectItem>
            </SelectContent>
          </Select>

          {triggerType === 'DATABASE_EVENT' && (
            <TableSelector
              value={selectedTableId}
              onValueChange={handleTableSelect}
              placeholder="Select table..."
              className="h-6 text-[10px] w-[140px]"
            />
          )}
        </div>
      )}

      {/* Show selected trigger info when in automation mode */}
      {mode === 'automation' && selectedAutomationIndex !== null && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>Trigger:</span>
          <Badge variant="secondary" className="text-[9px]">
            {triggerType.replace('_', ' ')}
          </Badge>
          {triggerType === 'DATABASE_EVENT' && selectedTableId && (
            <Badge variant="outline" className="text-[9px]">
              Table #{selectedTableId}
            </Badge>
          )}
        </div>
      )}

      {/* Selection count badge */}
      <div className="flex justify-end">
        <Badge variant="outline" className="text-[9px]">
          {selectedVariables.size} selected
        </Badge>
      </div>

      {/* Compact variable list */}
      <div className="max-h-[160px] overflow-y-auto space-y-0.5">
        {allVariables.length === 0 ? (
          <p className="text-[10px] text-muted-foreground py-1">
            {triggerType === 'DATABASE_EVENT' && !localSampleData
              ? 'Select a table to see row fields'
              : 'No variables available'}
          </p>
        ) : (
          allVariables.map(v => (
            <div
              key={v.name}
              className={`flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer hover:bg-muted transition-colors ${
                selectedVariables.has(v.name) ? 'bg-primary/10' : ''
              }`}
              onClick={() => toggleVariable(v.name)}
            >
              <Checkbox
                checked={selectedVariables.has(v.name)}
                onCheckedChange={() => toggleVariable(v.name)}
                className="h-3 w-3"
              />
              <code className="text-[10px] font-mono text-primary">${v.name}</code>
              {v.isDynamic && (
                <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">row</Badge>
              )}
              <span className="text-[9px] text-muted-foreground truncate flex-1">
                {v.description}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Compact add button */}
      <Button
        onClick={handleAddSelected}
        disabled={selectedVariables.size === 0}
        className="w-full h-7 text-[11px]"
        size="sm"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add {selectedVariables.size > 0 ? `${selectedVariables.size} ` : ''}Selected
      </Button>
    </div>
  );
}
