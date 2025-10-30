'use client';

import React, { useState, useEffect } from 'react';
import type { DataSourceDTO } from '@/app/mappers/data-source-mapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createDataSource, updateDataSource } from '@/app/actions/data-sources';
import { getTables } from '@/app/actions/tables';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface DataSourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataSource?: DataSourceDTO;
  onSuccess?: () => void;
}

export function DataSourceFormDialog({ open, onOpenChange, dataSource, onSuccess }: DataSourceFormDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tables, setTables] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const isEditMode = !!dataSource;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tableId, setTableId] = useState<number | undefined>();

  // Load tables on mount
  useEffect(() => {
    if (open) {
      loadTables();
    }
  }, [open]);

  // Reset form when dataSource changes
  useEffect(() => {
    if (dataSource) {
      setName(dataSource.name);
      setDescription(dataSource.description || '');
      setTableId(dataSource.tableId);
    } else {
      setName('');
      setDescription('');
      setTableId(undefined);
    }
  }, [dataSource]);

  const loadTables = async () => {
    try {
      setLoadingTables(true);
      const tablesData = await getTables();
      setTables(tablesData);
    } catch (error) {
      console.error('Error loading tables:', error);
      toast.error('Failed to load tables');
    } finally {
      setLoadingTables(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!tableId) {
      setError('Table selection is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const result = isEditMode
        ? await updateDataSource({
            id: dataSource!.id,
            name: name.trim(),
            description: description.trim() || undefined
          })
        : await createDataSource({
            tableId,
            name: name.trim(),
            description: description.trim() || undefined
          });

      if (!result.success) {
        setError(result.error || 'Failed to save data source');
        toast.error(result.error || "Failed to save data source");
        return;
      }

      toast.success(isEditMode ? "Data source updated successfully" : "Data source created successfully");

      if (onSuccess) {
        onSuccess();
      }

      onOpenChange(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Data Source' : 'Create Data Source'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the data source name and description. Filters and sorting can be configured later.'
              : 'Create a filtered and sorted view of a table. You can configure filters and sorting after creation.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 p-1">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Active Customers"
                  disabled={isSubmitting}
                />
              </div>

              {/* Description Field */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this data source shows..."
                  rows={3}
                  disabled={isSubmitting}
                />
              </div>

              {/* Table Selection (only for new data sources) */}
              {!isEditMode && (
                <div className="space-y-2">
                  <Label htmlFor="table">
                    Table <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={tableId?.toString()}
                    onValueChange={(value) => setTableId(parseInt(value))}
                    disabled={isSubmitting || loadingTables}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingTables ? "Loading tables..." : "Select a table"} />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((table) => (
                        <SelectItem key={table.id} value={table.id.toString()}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Show current table in edit mode */}
              {isEditMode && dataSource && (
                <div className="space-y-2">
                  <Label>Table</Label>
                  <div className="text-sm text-muted-foreground">
                    Table ID: {dataSource.tableId}
                  </div>
                </div>
              )}

              {/* Info about filters/sorting */}
              {!isEditMode && (
                <div className="bg-secondary/50 p-3 rounded-md text-sm text-muted-foreground">
                  Note: After creating the data source, you can configure filters and sorting in a future update.
                </div>
              )}

              {error && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                  {error}
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditMode ? 'Save Changes' : 'Create Data Source'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
