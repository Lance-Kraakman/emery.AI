'use client'

// AIDEV-NOTE: Client component for field management - needs interactivity for CRUD operations

import { useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createFieldAction, deleteFieldAction } from '@/app/actions/fields';
import type { Field } from '@/app/actions/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FormField } from '@/components/ui/form-field';
import { EmptyState } from '@/components/ui/empty-state';

interface FieldManagerProps {
  tableId: number;
  organizationId: number;
  fields: Field[];
  availableTables: Array<{ id: number; name: string }>;
  onFieldUpdate: () => void;
}

export default function FieldManager({ tableId, organizationId, fields, availableTables, onFieldUpdate }: FieldManagerProps) {
  const [showNewField, setShowNewField] = useState(false);
  const [selectedFieldType, setSelectedFieldType] = useState('text');
  const [isPending, startTransition] = useTransition();

  async function handleCreateField(formData: FormData) {
    startTransition(async () => {
      try {
        await createFieldAction(formData);
        setShowNewField(false);
        onFieldUpdate();
      } catch (error) {
        console.error('Error creating field:', error);
        alert('Failed to create field');
      }
    });
  }

  async function handleDeleteField(fieldId: number) {
    if (!confirm('Are you sure you want to delete this field?')) return;
    
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('fieldId', fieldId.toString());
        await deleteFieldAction(formData);
        onFieldUpdate();
      } catch (error) {
        console.error('Error deleting field:', error);
        alert('Failed to delete field');
      }
    });
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Fields</h3>
        <Button
          onClick={() => setShowNewField(true)}
          disabled={isPending}
          variant="default"
          size="sm"
        >
          <Plus size={16} />
          Add Field
        </Button>
      </div>

      {showNewField && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Create New Field</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleCreateField} className="space-y-4">
              <input type="hidden" name="tableId" value={tableId} />
              
              <FormField label="Field Name" required>
                <Input
                  name="name"
                  required
                  disabled={isPending}
                  placeholder="Enter field name"
                />
              </FormField>

              <FormField label="Field Type">
                <Select
                  name="type"
                  value={selectedFieldType}
                  onValueChange={setSelectedFieldType}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="relation">Relation</SelectItem>
                    <SelectItem value="file">File</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              {selectedFieldType === 'relation' && (
                <FormField label="Related Table" required>
                  <Select name="relatedTableId" disabled={isPending}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a table..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTables
                        .filter(table => table.id !== tableId)
                        .map(table => (
                          <SelectItem key={table.id} value={table.id.toString()}>
                            {table.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="required"
                  id="required"
                  disabled={isPending}
                  className="rounded border-input"
                />
                <label htmlFor="required" className="text-sm font-medium leading-none">
                  Required field
                </label>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isPending}
                  variant="default"
                >
                  {isPending ? 'Creating...' : 'Create Field'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowNewField(false);
                    setSelectedFieldType('text');
                  }}
                  disabled={isPending}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}


      {fields.length === 0 ? (
        <EmptyState
          title="No fields yet"
          description="Add your first field to get started with data management."
          action={{
            label: "Add Field",
            onClick: () => setShowNewField(true)
          }}
        />
      ) : (
        <div className="space-y-2">
          {fields.map((field) => (
            <Card key={field.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{field.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {field.type}
                    </Badge>
                    {field.required && (
                      <Badge variant="destructive" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                  <Button
                    onClick={() => handleDeleteField(field.id)}
                    disabled={isPending}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
