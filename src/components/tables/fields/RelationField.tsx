'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FieldBadgeList } from './FieldBadgeList';
import type { FieldBadgeItem } from './FieldBadgeList';
import type { RelationArrayFieldValue } from '@/ddd/domain/tables/value-objects/field-values';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getRowsData } from '@/app/actions/rows';
import { getFields } from '@/app/actions/fields';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { RowDTO } from '@/app/mappers/row-mapper';

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
  required
}: RelationFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tableData, setTableData] = useState<{ fields: FieldDTO[]; rows: RowDTO[] } | null>(null);
  const [tableDataLoading, setTableDataLoading] = useState(false);

  const relations = Array.isArray(value) ? value : [];

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
      const [fields, rows] = await Promise.all([
        getFields(relatedTableId),
        getRowsData(relatedTableId, 100, 0)
      ]);

      setTableData({ fields, rows });
    } catch (error) {
      console.error('[RelationField] Error loading table data:', error);
      setTableData({ fields: [], rows: [] });
    } finally {
      setTableDataLoading(false);
    }
  };

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

    // Resolve display value from row data
    const textField = rowData.fieldValues?.find((fv: any) => fv.fieldType === 'text' && fv.value);
    const displayValue = textField?.value ||
      rowData.fieldValues?.find((fv: any) => fv.value)?.value ||
      `Record ${rowId}`;

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
      setIsOpen(false);
    }
  }, [relations, onChange, multiple]);

  // Handle add button click (edit mode)
  const handleAddClick = useCallback(() => {
    if (relatedTableId) {
      setIsOpen(true);
    }
  }, [relatedTableId]);

  // Filter rows based on search term
  const filteredRows = searchTerm && tableData
    ? tableData.rows.filter(row =>
        row.fieldValues.some(fv =>
          fv.value &&
          String(fv.value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    : tableData?.rows || [];

  return (
    <div>
      <FieldBadgeList
        items={badgeItems}
        isEditMode={isEditMode}
        compact={compact}
        maxVisible={compact ? 2 : 3}
        showAddButton={isEditMode}
        onAdd={handleAddClick}
        onRemove={isEditMode ? handleRemoveRelation : undefined}
        onItemClick={!isEditMode ? handleRelationClick : undefined}
        disabled={disabled || !relatedTableId}
        emptyMessage={compact ? undefined : `No ${fieldName?.toLowerCase() || 'relations'}`}
      />

      {/* Relation selector dialog (edit mode only) */}
      {isEditMode && (
        <Dialog open={isOpen && !!relatedTableId} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select Related Record</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Currently selected relations */}
              {relations.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Currently Selected:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {badgeItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-muted-foreground rounded-md text-sm"
                      >
                        <span>{item.label}</span>
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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>

              {/* Table data */}
              <div className="border rounded-md overflow-auto max-h-[500px]">
                {tableDataLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading table data...</span>
                  </div>
                )}

                {!tableDataLoading && tableData && (
                  <>
                    <div className="sticky top-0 left-2 z-10 bg-blue-600 text-white px-3 py-1 rounded-md text-sm mb-2">
                      Click any row to select it
                    </div>

                    <Table className="text-sm">
                      <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
                        <TableRow>
                          <TableHead className="w-20 px-2">ID</TableHead>
                          {tableData.fields.slice(0, 8).map((field) => (
                            <TableHead key={field.id} className="min-w-[120px] p-2">
                              {field.name}
                            </TableHead>
                          ))}
                          <TableHead className="w-24 px-2">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={tableData.fields.slice(0, 8).length + 2} className="text-center h-24 text-muted-foreground">
                              {searchTerm ? `No records found for "${searchTerm}"` : 'No records found'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredRows.map((row) => (
                            <TableRow
                              key={row.id}
                              className={`hover:bg-muted/30 cursor-pointer ${
                                relations.some(r => r.id.toString() === row.id.toString())
                                  ? "bg-blue-50 dark:bg-blue-950/20"
                                  : ""
                              }`}
                              onClick={() => handleRowSelect(row.id, row)}
                            >
                              <TableCell className="px-2 font-medium text-xs text-muted-foreground">
                                {row.id}
                              </TableCell>
                              {tableData.fields.slice(0, 8).map((field) => {
                                const fieldValue = row.fieldValues.find(fv => fv.fieldSlug === field.name)?.value;
                                const displayValue = fieldValue ?
                                  (typeof fieldValue === 'object' && fieldValue !== null ?
                                    JSON.stringify(fieldValue) :
                                    String(fieldValue)) :
                                  null;

                                return (
                                  <TableCell key={field.id} className="p-2 truncate">
                                    {displayValue || <span className="text-muted-foreground italic">—</span>}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="px-2">
                                {relations.some(r => r.id.toString() === row.id.toString()) && (
                                  <Badge variant="secondary" className="text-xs">Selected</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </>
                )}

                {!tableDataLoading && (!tableData || tableData.rows.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No records found in this table
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>
                  {tableData ? `${tableData.rows.length} record${tableData.rows.length === 1 ? '' : 's'} available` : 'Loading...'}
                </span>
                <div className="flex items-center gap-2">
                  {multiple && (
                    <span>{relations.length} selected</span>
                  )}
                  {multiple && relations.length > 0 && (
                    <Button type="button" size="sm" onClick={() => setIsOpen(false)}>
                      Done
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
