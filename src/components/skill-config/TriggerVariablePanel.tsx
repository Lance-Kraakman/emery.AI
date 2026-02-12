'use client';

import React, { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { InstructionTemplateService } from '@/ddd/domain/tasks/services/instruction-template-service';
import type { TriggerType } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import type { InputDefinition } from '@/ddd/domain/skills/entities/skill';
import { TableSelector } from '@/app/(app)/agents/components/TableSelector';
import { getSampleRow } from '@/app/actions/rows';

interface TriggerVariablePanelProps {
  onAddInputs: (inputs: InputDefinition[]) => void;
  existingInputNames: Set<string>;
  defaultTriggerType?: TriggerType;
  defaultTableId?: string;
  sampleRowData?: Record<string, any> | null;
}

interface VariableOption {
  name: string;
  description: string;
  isDynamic?: boolean;  // For row.* fields that come from table
}

/**
 * Panel for selecting trigger context variables to add as skill inputs.
 * Similar to "Add from table" but for automation trigger variables.
 */
export function TriggerVariablePanel({
  onAddInputs,
  existingInputNames,
  defaultTriggerType,
  defaultTableId,
  sampleRowData
}: TriggerVariablePanelProps) {
  const [triggerType, setTriggerType] = useState<TriggerType>(defaultTriggerType || 'DATABASE_EVENT');
  const [selectedTableId, setSelectedTableId] = useState<string | undefined>(defaultTableId);
  const [selectedVariables, setSelectedVariables] = useState<Set<string>>(new Set());
  const [localSampleData, setLocalSampleData] = useState<Record<string, any> | null>(sampleRowData || null);

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
    <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
      {/* Inline selectors row */}
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

        <Badge variant="outline" className="text-[9px] ml-auto">
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
