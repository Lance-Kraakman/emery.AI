'use client';

/**
 * PageVariablesField
 *
 * Editor field for defining page variables (expected query parameters).
 * These variables appear in the autocomplete dropdown and can be used
 * for navigation actions and DataBlock filtering.
 */

import React, { useState, useCallback } from 'react';
import { FieldLabel } from '@measured/puck';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, X, Variable } from 'lucide-react';
import type { PageVariable } from '@/components/puck/types';

interface PageVariablesFieldProps {
  value?: PageVariable[];
  onChange: (value: PageVariable[]) => void;
  readOnly?: boolean;
}

export function PageVariablesFieldRenderer({
  value = [],
  onChange,
  readOnly = false,
}: PageVariablesFieldProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newVariable, setNewVariable] = useState<PageVariable>({
    name: '',
    type: 'string',
    required: false,
    description: '',
  });

  const handleAddVariable = useCallback(() => {
    if (!newVariable.name.trim()) return;

    // Validate name format (alphanumeric and underscores only)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newVariable.name)) {
      return;
    }

    // Check for duplicates
    if (value.some(v => v.name === newVariable.name)) {
      return;
    }

    onChange([...value, { ...newVariable, name: newVariable.name.trim() }]);
    setNewVariable({ name: '', type: 'string', required: false, description: '' });
    setIsAdding(false);
  }, [newVariable, value, onChange]);

  const handleRemoveVariable = useCallback((name: string) => {
    onChange(value.filter(v => v.name !== name));
  }, [value, onChange]);

  const handleUpdateVariable = useCallback((index: number, updates: Partial<PageVariable>) => {
    const newVariables = [...value];
    newVariables[index] = { ...newVariables[index], ...updates };
    onChange(newVariables);
  }, [value, onChange]);

  return (
    <FieldLabel label="Page Variables">
      <div className="space-y-3">
        {/* Existing Variables */}
        {value.length > 0 && (
          <div className="space-y-2">
            {value.map((variable, index) => (
              <div
                key={variable.name}
                className="flex items-center gap-2 p-2 border rounded-md bg-muted/30"
              >
                <Variable className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-1 rounded">
                      {`{params.${variable.name}}`}
                    </code>
                    <Badge variant="outline" className="text-xs">
                      {variable.type}
                    </Badge>
                    {variable.required && (
                      <Badge variant="secondary" className="text-xs">
                        required
                      </Badge>
                    )}
                  </div>
                  {variable.description && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {variable.description}
                    </p>
                  )}
                </div>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleRemoveVariable(variable.name)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {value.length === 0 && !isAdding && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No page variables defined
          </div>
        )}

        {/* Add Variable Form */}
        {isAdding && (
          <div className="space-y-3 p-3 border rounded-md bg-muted/20">
            <div className="space-y-2">
              <Label className="text-xs">Variable Name</Label>
              <Input
                placeholder="e.g., user_id"
                value={newVariable.name}
                onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Letters, numbers, and underscores only
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">Type</Label>
                <Select
                  value={newVariable.type}
                  onValueChange={(val) => setNewVariable({ ...newVariable, type: val as 'string' | 'number' })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Required</Label>
                <div className="flex items-center h-8">
                  <Switch
                    checked={newVariable.required}
                    onCheckedChange={(checked) => setNewVariable({ ...newVariable, required: checked })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Description (optional)</Label>
              <Input
                placeholder="What is this variable for?"
                value={newVariable.description || ''}
                onChange={(e) => setNewVariable({ ...newVariable, description: e.target.value })}
                className="h-8 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={handleAddVariable}
                disabled={!newVariable.name.trim()}
              >
                Add Variable
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setIsAdding(false);
                  setNewVariable({ name: '', type: 'string', required: false, description: '' });
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Add Button */}
        {!isAdding && !readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Variable
          </Button>
        )}

        {/* Help Text */}
        <p className="text-xs text-muted-foreground">
          Define expected URL parameters for this page. Use them in DataBlock filters
          or navigation actions with {'{params.variable_name}'} syntax.
        </p>
      </div>
    </FieldLabel>
  );
}

export default PageVariablesFieldRenderer;
