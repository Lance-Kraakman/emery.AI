'use client';

import React, { useState, useMemo } from 'react';
import { Zap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Add from Automation
        </Label>
        <Badge variant="outline" className="text-xs">
          {selectedVariables.size} selected
        </Badge>
      </div>

      {/* Trigger Type Selector */}
      <div className="space-y-2">
        <Label className="text-xs">Trigger Type</Label>
        <Select value={triggerType} onValueChange={(v) => setTriggerType(v as TriggerType)}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DATABASE_EVENT">Database Event</SelectItem>
            <SelectItem value="CALENDAR">Calendar</SelectItem>
            <SelectItem value="WEBHOOK">Webhook</SelectItem>
            <SelectItem value="PIPEDREAM_EVENT">External Event</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table Selector for DATABASE_EVENT */}
      {triggerType === 'DATABASE_EVENT' && (
        <div className="space-y-2">
          <Label className="text-xs">Table (for row fields)</Label>
          <TableSelector
            value={selectedTableId}
            onValueChange={handleTableSelect}
            placeholder="Select table to see row fields..."
          />
        </div>
      )}

      {/* Available Variables */}
      <div className="space-y-2">
        <Label className="text-xs">Available Variables</Label>
        <div className="max-h-[200px] overflow-y-auto space-y-1">
          {allVariables.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              {triggerType === 'DATABASE_EVENT' && !localSampleData
                ? 'Select a table to see row fields'
                : 'No variables available'}
            </p>
          ) : (
            allVariables.map(v => (
              <div
                key={v.name}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted transition-colors ${
                  selectedVariables.has(v.name) ? 'bg-primary/10' : ''
                }`}
                onClick={() => toggleVariable(v.name)}
              >
                <Checkbox
                  checked={selectedVariables.has(v.name)}
                  onCheckedChange={() => toggleVariable(v.name)}
                  className="h-3.5 w-3.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <code className="text-xs font-mono text-primary">${v.name}</code>
                    {v.isDynamic && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">row</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {v.description}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Button */}
      <Button
        onClick={handleAddSelected}
        disabled={selectedVariables.size === 0}
        className="w-full"
        size="sm"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add {selectedVariables.size > 0 ? `${selectedVariables.size} ` : ''}Selected as Inputs
      </Button>
    </div>
  );
}
