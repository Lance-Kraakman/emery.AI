'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FieldBadgeList } from './FieldBadgeList';
import type { FieldBadgeItem } from './FieldBadgeList';
import type { RelationArrayFieldValue } from '@/ddd/domain/tables/value-objects/field-values';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getRowsDSG } from '@/app/actions/rows';
import { getFields } from '@/app/actions/fields';
import type { FieldDTO } from '@/app/mappers/field-mapper';

interface RelationFieldProps {
  value: RelationArrayFieldValue;
  onChange?: (value: RelationArrayFieldValue) => void;
  isEditMode?: boolean;
  onRelationClick?: (relation: any) => void;
  relatedTableId?: number;
  multiple?: boolean;
  compact?: boolean;
  disabled?: boolean;
  fieldName?: string;
  required?: boolean;
  readOnly?: boolean;
  // DSG cell focus state - when true, show expanded dialog
  focus?: boolean;
  onClose?: () => void;
}

/**
 * RelationField - Unified component for relation fields
 *
 * Display Mode (isEditMode=false):
 * - Shows relations as compact badges with link icon
 * - Click badge → Navigate to related record (future)
 *
 * Edit Mode (isEditMode=true):
 * - Shows relations as badges with remove buttons
 * - Click + button → Opens relation selector dialog
 * - Searchable table of related records
 * - Click row to select (multiple if configured)
 *
 * Usage:
 * - Table cells: compact={true}
 * - Forms: compact={false}
 */
export function RelationField({
  value,
  onChange,
  isEditMode = false,
  onRelationClick,
  relatedTableId,
  multiple = false,
  compact = false,
  disabled = false,
  fieldName,
  required,
  readOnly = false,
  focus = false,
  onClose
}: RelationFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tableData, setTableData] = useState<{ fields: FieldDTO[]; rows: any[] } | null>(null);
  const [tableDataLoading, setTableDataLoading] = useState(false);
  const hasOpenedForFocus = useRef(false);

  const relations = Array.isArray(value) ? value : [];

  // Listen for Cmd+Enter when focused (DSG integration)
  useEffect(() => {
    if (!focus) {
      hasOpenedForFocus.current = false;
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && relatedTableId) {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focus, isOpen, relatedTableId]);

  // Handle dialog close - also notify DSG
  const handleDialogClose = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  // Convert relations to badge items
  const badgeItems: FieldBadgeItem[] = relations.map((relation) => ({
    id: relation.id,
    label: relation.value || `Record ${relation.id}`,
    type: 'relation' as const,
    metadata: relation
  }));

  // Load table data when dialog opens
  useEffect(() => {
    if (isOpen && relatedTableId) {
      loadTableData();
    }
  }, [isOpen, relatedTableId]);

  const loadTableData = async () => {
    if (!relatedTableId) return;

    setTableDataLoading(true);
    try {
      const [fields, rowsResponse] = await Promise.all([
        getFields(relatedTableId),
        getRowsDSG(relatedTableId, 100, 0)
      ]);

      setTableData({ fields, rows: rowsResponse.rows });
    } catch (error) {
      console.error('[RelationField] Error loading table data:', error);
      setTableData({ fields: [], rows: [] });
    } finally {
      setTableDataLoading(false);
    }
  };

  // Simple inline renderer for dialog table cells
  const renderCellValue = useCallback((field: FieldDTO, value: any) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-muted-foreground text-xs">—</span>;
    }

    switch (field.type) {
      case 'boolean':
        return <span>{value ? '✓' : '✗'}</span>;
      case 'date':
        return <span className="text-xs">{new Date(value).toLocaleDateString()}</span>;
      case 'number':
        return <span>{typeof value === 'number' ? value.toLocaleString() : value}</span>;
      case 'text':
        const str = String(value);
        return <span className="truncate" title={str}>
          {str.length > 50 ? str.substring(0, 50) + '...' : str}
        </span>;
      case 'relation':
      case 'file':
      case 'document':
        return <span className="text-xs text-muted-foreground">
          {Array.isArray(value) ? `${value.length} item(s)` : '—'}
        </span>;
      default:
        return <span className="text-xs">{String(value)}</span>;
    }
  }, []);

  // Handle relation click (display mode)
  const handleRelationClick = useCallback((item: FieldBadgeItem) => {
    if (onRelationClick && item.metadata) {
      onRelationClick(item.metadata);
    }
  }, [onRelationClick]);

  // Handle relation removal (edit mode)
  const handleRemoveRelation = useCallback((index: number) => {
    if (!onChange) return;
    const newRelations = relations.filter((_, i) => i !== index);
    onChange(newRelations);
  }, [relations, onChange]);

  // Handle row selection from dialog
  const handleRowSelect = useCallback((rowId: string, rowData: any) => {
    if (!onChange) return;

    // DSG format: { id: 'xxx', Name: 'value', AGE: 123, ... }
    // Find first text field value to use as display
    const textFields = tableData?.fields.filter(f => f.type === 'text') || [];
    let displayValue = `Record ${rowId}`;

    for (const field of textFields) {
      const fieldValue = rowData[field.name];
      if (fieldValue && typeof fieldValue === 'string' && fieldValue.trim()) {
        displayValue = fieldValue;
        break;
      }
    }

    const newRelation = {
      id: rowId,
      value: String(displayValue)
    };

    if (multiple) {
      // Check if relation already exists
      const exists = relations.some(r => r.id.toString() === rowId.toString());
      if (!exists) {
        onChange([...relations, newRelation]);
      }
    } else {
      onChange([newRelation]);
      handleDialogClose();
    }
  }, [relations, onChange, multiple, tableData]);

  // Handle add button click (edit mode)
  const handleAddClick = useCallback(() => {
    if (relatedTableId) {
      setIsOpen(true);
    }
  }, [relatedTableId]);

  // Filter rows based on search term - updated for DSG format
  const filteredRows = searchTerm && tableData
    ? tableData.rows.filter(row =>
        Object.keys(row)
          .filter(key => key !== 'id') // Exclude id field
          .some(key => {
            const value = row[key];
            return value && String(value).toLowerCase().includes(searchTerm.toLowerCase());
          })
      )
    : tableData?.rows || [];

  return (
    <div>
      <FieldBadgeList
        items={badgeItems}
        isEditMode={isEditMode}
        compact={compact}
        maxVisible={compact ? 2 : 3}
        showAddButton={!readOnly}
        onAdd={onChange && relatedTableId && !readOnly ? handleAddClick : undefined}
        onRemove={isEditMode ? handleRemoveRelation : undefined}
        onItemClick={!isEditMode ? handleRelationClick : undefined}
        disabled={disabled || !relatedTableId}
        emptyMessage={compact ? undefined : `No ${fieldName?.toLowerCase() || 'relations'}`}
      />

      {/* Relation selector popover */}
      <Popover open={isOpen && !!relatedTableId} onOpenChange={(open) => !open && handleDialogClose()}>
        <PopoverAnchor />
        <PopoverContent
          className="w-[450px] p-3"
          align="start"
          side="bottom"
        >
          <div className="space-y-3">
            {/* Currently selected relations */}
            {relations.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">
                  Selected:
                </div>
                <div className="flex flex-wrap gap-1">
                  {badgeItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs"
                    >
                      <span className="truncate max-w-[100px]">{item.label}</span>
                      <button
                        onClick={() => handleRemoveRelation(index)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-sm"
                autoFocus
              />
            </div>

            {/* Table data */}
            <div className="border rounded overflow-auto max-h-[250px]">
              {tableDataLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm">Loading...</span>
                </div>
              )}

              {!tableDataLoading && tableData && (
                <Table className="text-xs">
                  <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <TableRow>
                      <TableHead className="w-12 px-2 py-1.5">ID</TableHead>
                      {tableData.fields.slice(0, 3).map((field) => (
                        <TableHead key={field.id} className="min-w-[80px] px-2 py-1.5">
                          {field.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={tableData.fields.slice(0, 3).length + 1} className="text-center h-16 text-muted-foreground">
                          {searchTerm ? `No records for "${searchTerm}"` : 'No records'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.slice(0, 20).map((row) => (
                        <TableRow
                          key={row.id}
                          className={`hover:bg-muted/30 cursor-pointer ${
                            relations.some(r => r.id.toString() === row.id.toString())
                              ? "bg-blue-50 dark:bg-blue-950/20"
                              : ""
                          }`}
                          onClick={() => handleRowSelect(row.id, row)}
                        >
                          <TableCell className="px-2 py-1.5 font-medium text-muted-foreground">
                            {row.id}
                          </TableCell>
                          {tableData.fields.slice(0, 3).map((field) => {
                            const fieldValue = row[field.name];
                            return (
                              <TableCell key={field.id} className="px-2 py-1.5 truncate max-w-[100px]">
                                {renderCellValue(field, fieldValue)}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}

              {!tableDataLoading && (!tableData || tableData.rows.length === 0) && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No records found
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
              <span>
                {tableData ? `${Math.min(filteredRows.length, 20)} of ${tableData.rows.length}` : '...'}
              </span>
              {multiple && relations.length > 0 && (
                <Button type="button" size="sm" className="h-7 text-xs" onClick={handleDialogClose}>
                  Done
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
