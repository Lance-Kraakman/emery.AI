'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { OutputDefinition } from '@/app/mappers/skill-mapper';
import type { TableDTO } from '@/app/mappers/table-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import { getTables } from '@/app/actions/tables';
import { getFields } from '@/app/actions/fields';
import { fieldTypeToOutputType } from '@/components/skill-config/field-type-maps';

interface OutputDefinitionsSectionProps {
  outputs: OutputDefinition[];
  onOutputsChange: (outputs: OutputDefinition[]) => void;
  isReadOnly?: boolean;
}

export function OutputDefinitionsSection({
  outputs,
  onOutputsChange,
  isReadOnly = false
}: OutputDefinitionsSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<OutputDefinition>({ name: '', type: 'text' });
  const formRef = useRef<HTMLDivElement>(null);

  // Table picker state
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<number>>(new Set());
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);

  // Fetch tables when popover opens
  useEffect(() => {
    if (showTablePicker && tables.length === 0 && !loadingTables) {
      setLoadingTables(true);
      getTables()
        .then(setTables)
        .finally(() => setLoadingTables(false));
    }
  }, [showTablePicker, tables.length, loadingTables]);

  // Fetch fields when table is selected
  useEffect(() => {
    if (selectedTableId) {
      setLoadingFields(true);
      setFields([]);
      setSelectedFieldIds(new Set());
      getFields(selectedTableId)
        .then((fetchedFields) => {
          if (Array.isArray(fetchedFields)) {
            // Filter to only writeable fields (those with non-null output type mapping)
            // Also exclude the system 'id' field
            const writeableFields = fetchedFields.filter(
              (f) => f.name !== 'id' && fieldTypeToOutputType[f.type as FieldType] !== null
            );
            setFields(writeableFields);
          }
        })
        .finally(() => setLoadingFields(false));
    }
  }, [selectedTableId]);

  // Handle adding selected fields as outputs
  const handleAddFromTable = () => {
    if (selectedFieldIds.size === 0) return;

    const existingNames = new Set(outputs.map((o) => o.name));
    const newOutputs: OutputDefinition[] = [];

    fields
      .filter((f) => selectedFieldIds.has(f.id))
      .forEach((field) => {
        let name = field.name;
        // Handle duplicates by adding suffix
        if (existingNames.has(name)) {
          let suffix = 2;
          while (existingNames.has(`${field.name}_${suffix}`)) {
            suffix++;
          }
          name = `${field.name}_${suffix}`;
        }
        existingNames.add(name);

        const outputType = fieldTypeToOutputType[field.type as FieldType] || 'text';
        newOutputs.push({
          name,
          type: outputType,
          description: field.type === 'relation' ? `Relation from ${field.name}` : undefined,
        });
      });

    onOutputsChange([...outputs, ...newOutputs]);

    // Reset picker state
    setShowTablePicker(false);
    setSelectedTableId(null);
    setFields([]);
    setSelectedFieldIds(new Set());
  };

  // Toggle field selection
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

  // Select/deselect all fields
  const handleSelectAll = () => {
    if (selectedFieldIds.size === fields.length) {
      setSelectedFieldIds(new Set());
    } else {
      setSelectedFieldIds(new Set(fields.map((f) => f.id)));
    }
  };

  const handleAdd = () => {
    if (!formData.name.trim()) return;

    if (editingIndex !== null) {
      // Update existing output
      const newOutputs = [...outputs];
      newOutputs[editingIndex] = formData;
      onOutputsChange(newOutputs);
    } else {
      // Add new output
      onOutputsChange([...outputs, formData]);
    }

    // Reset form
    setFormData({ name: '', type: 'text' });
    setShowAddForm(false);
    setEditingIndex(null);
  };

  const handleRemove = (index: number) => {
    onOutputsChange(outputs.filter((_, i) => i !== index));
  };

  const handleEdit = (index: number) => {
    setFormData(outputs[index]);
    setEditingIndex(index);
    setShowAddForm(true);
  };

  const handleCancel = () => {
    setFormData({ name: '', type: 'text' });
    setShowAddForm(false);
    setEditingIndex(null);
  };

  // Close form when clicking outside (but not on Select dropdown portals)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Radix Select renders dropdown in a portal outside the form
      const isSelectPortal = target.closest('[role="listbox"]') || target.closest('[data-radix-popper-content-wrapper]');
      if (
        showAddForm &&
        formRef.current &&
        !formRef.current.contains(target) &&
        !isSelectPortal
      ) {
        handleCancel();
      }
    };

    if (showAddForm) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAddForm]);

  return (
    <div className="flex items-start gap-1.5 flex-wrap">
      {/* Selected Outputs */}
      {outputs.map((output, index) => (
        <div key={index} className="relative flex items-center group">
          {isReadOnly ? (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-md border text-xs
                transition-colors duration-150 flex-shrink-0 max-w-xs
                border-border bg-muted/50"
              title={output.description || `${output.name} (type: ${output.type || 'text'})`}
            >
              <span className="truncate font-medium font-mono text-[11px]">
                {output.name}
              </span>
              {output.type && output.type !== 'text' && (
                <span className="text-[9px] text-blue-600 bg-blue-50 px-0.5 rounded">
                  {output.type}
                </span>
              )}
              {output.description && (
                <span className="text-[9px] text-green-600">✓</span>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={() => handleEdit(index)}
                className="flex items-center gap-1 px-2 py-1 rounded-md border text-xs
                  transition-colors duration-150 flex-shrink-0 max-w-xs
                  border-border bg-background hover:bg-muted/50 cursor-pointer"
                title={output.description || `${output.name} (type: ${output.type || 'text'})`}
              >
                <span className="truncate font-medium font-mono text-[11px]">
                  {output.name}
                </span>
                {output.type && output.type !== 'text' && (
                  <span className="text-[9px] text-blue-600 bg-blue-50 px-0.5 rounded">
                    {output.type}
                  </span>
                )}
                {output.description && (
                  <span className="text-[9px] text-green-600">✓</span>
                )}
              </button>

              {/* Remove button */}
              <button
                onClick={() => handleRemove(index)}
                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove output"
              >
                <X className="w-2 h-2" />
              </button>
            </>
          )}
        </div>
      ))}

      {/* Add Output Button or Form (hide when read-only) */}
      {!isReadOnly && (
        showAddForm ? (
          <div
            ref={formRef}
            className="flex flex-col gap-1.5 p-2 border rounded-md bg-background shadow-sm min-w-[260px]"
          >
            <div className="flex items-center gap-1.5">
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="output_name"
                className="w-28 h-7 font-mono text-[11px]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formData.name.trim()) handleAdd();
                  if (e.key === 'Escape') handleCancel();
                }}
              />
              <Select
                value={formData.type || 'text'}
                onValueChange={(v) => setFormData({ ...formData, type: v as any })}
              >
                <SelectTrigger className="w-20 h-7 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Basic types */}
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  {/* Format-specific */}
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="email-thread">Email Thread</SelectItem>
                  {/* Select types */}
                  <SelectItem value="single-select">Single Select</SelectItem>
                  <SelectItem value="multi-select">Multi Select</SelectItem>
                  {/* Media types */}
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="file">File</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={handleAdd}
                disabled={!formData.name.trim()}
              >
                {editingIndex !== null ? 'Save' : 'Add'}
              </Button>
            </div>
            <Input
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description (optional)"
              className="h-7 text-[11px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && formData.name.trim()) handleAdd();
                if (e.key === 'Escape') handleCancel();
              }}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-[26px] text-[11px] px-2"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
            <Popover open={showTablePicker} onOpenChange={setShowTablePicker}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-[26px] text-[11px] px-2"
                >
                  <Database className="h-3 w-3 mr-1" />
                  From Table
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3" align="start">
                <div className="space-y-3">
                  {/* Table selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Select Table</Label>
                    {loadingTables ? (
                      <div className="text-xs text-muted-foreground py-2">Loading tables...</div>
                    ) : tables.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-2">No tables available</div>
                    ) : (
                      <Select
                        value={selectedTableId?.toString() || ''}
                        onValueChange={(v) => setSelectedTableId(parseInt(v))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select a table..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tables.map((table) => (
                            <SelectItem key={table.id} value={table.id.toString()}>
                              {table.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Field checkboxes */}
                  {selectedTableId && (
                    <div className="space-y-1.5">
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
                        <div className="text-xs text-muted-foreground py-2">No writeable fields</div>
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
                              <span className="text-[10px] text-muted-foreground">
                                {field.type}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add button */}
                  {selectedFieldIds.size > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={handleAddFromTable}
                    >
                      Add {selectedFieldIds.size} output{selectedFieldIds.size !== 1 ? 's' : ''}
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )
      )}
    </div>
  );
}
