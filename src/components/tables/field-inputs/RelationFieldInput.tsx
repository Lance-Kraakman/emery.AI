'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FieldInput } from '@/components/tables/FieldInput';
import { relationsToLabelItems } from '@/components/tables/LabelDisplay';
import type { RelationArrayFieldValue } from '@/ddd/domain/tables/value-objects/field-values';
import { getRowsData } from '@/app/actions/rows';
import { getFields } from '@/app/actions/fields';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { RowDTO, TypedFieldValueDTO } from '@/app/mappers/row-mapper';

interface RelationFieldInputProps {
  value: RelationArrayFieldValue;
  onChange: (value: RelationArrayFieldValue) => void;
  relatedTableId?: number;
  required?: boolean;
  multiple?: boolean;
  error?: string;
  isEditMode?: boolean; // New prop to control PlusCircle visibility
}

export function RelationFieldInput({
  value,
  onChange,
  relatedTableId,
  required,
  multiple = false, // Default to single relations
  error,
  isEditMode = true // Default to edit mode for backward compatibility
}: RelationFieldInputProps) {
  const relations = Array.isArray(value) ? value : [];
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tableData, setTableData] = useState<{ fields: FieldDTO[]; rows: RowDTO[] } | null>(null);
  const [tableDataLoading, setTableDataLoading] = useState(false);

  // Debug logging
  console.log('[RelationFieldInput] Props:', { relatedTableId, relations, multiple });

  // Load table data when popup opens
  useEffect(() => {
    if (isOpen && relatedTableId) {
      loadTableData();
    }
  }, [isOpen, relatedTableId]);

  const loadTableData = async () => {
    if (!relatedTableId) return;
    
    setTableDataLoading(true);
    try {
      console.log('[RelationFieldInput] Loading table data for:', relatedTableId);
      
      // Load both fields and rows in parallel
      const [fields, rows] = await Promise.all([
        getFields(relatedTableId),
        getRowsData(relatedTableId, 100, 0)
      ]);
      
      console.log('[RelationFieldInput] Loaded:', { fields: fields.length, rows: rows.length });
      setTableData({ fields, rows });
    } catch (error) {
      console.error('[RelationFieldInput] Error loading table data:', error);
      setTableData({ fields: [], rows: [] });
    } finally {
      setTableDataLoading(false);
    }
  };

  const handleRemoveRelation = (index: number) => {
    const updatedRelations = relations.filter((_, i) => i !== index);
    onChange(updatedRelations);
  };

  const handleRowSelect = (rowId: string, rowData: any) => {
    console.log('[RelationFieldInput] Row selected:', { rowId, rowData });
    
    // Convert row data to relation format
    const newRelation = {
      id: rowId,
      value: resolveDisplayValue(rowData)
    };

    if (multiple) {
      // Check if relation already exists
      const exists = relations.some(r => 
        r.id.toString() === rowId.toString()
      );
      if (!exists) {
        onChange([...relations, newRelation]);
      }
      // Don't close dialog for multiple relations - let user select more
    } else {
      onChange([newRelation]);
      setIsOpen(false); // Only close for single relations
    }
  };

  // Helper function to resolve display value from row data
  const resolveDisplayValue = (rowData: any): string => {
    // Try to find a text field to use as display value
    const textField = rowData.fieldValues?.find((fv: any) => fv.fieldType === 'text' && fv.value);
    if (textField && textField.value) {
      return textField.value as string;
    }
    
    // Fallback to first non-null field
    const firstField = rowData.fieldValues?.find((fv: any) => fv.value !== null && fv.value !== undefined);
    if (firstField && firstField.value) {
      return String(firstField.value);
    }
    
    // Final fallback
    return `Record ${rowData.id}`;
  };

  return (
    <FieldInput
      items={relationsToLabelItems(relations)}
      onAdd={() => setIsOpen(true)}
      onRemove={handleRemoveRelation}
      error={error}
      isEditMode={isEditMode}
      disabled={!relatedTableId}
      showPlusButton={isEditMode}
      requiredMessage={required ? `At least one ${relatedTableId ? 'relation' : 'field'} is required` : undefined}
    >
      {/* Table Selection Popup Dialog */}
      <Dialog open={isOpen && !!relatedTableId} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Related Record</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Currently Selected Relations - Using same UI as table cells */}
            {relations.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Currently Selected:
                </div>
                <div className="flex flex-wrap gap-1">
                  {relationsToLabelItems(relations).map((item, index) => (
                    <div
                      key={item.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-muted-foreground rounded-md text-sm"
                    >
                      <span>{item.value}</span>
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

            {/* Search Input */}
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

            {/* Table Data */}
            <div className="border rounded-md overflow-auto max-h-[500px]">
              {tableDataLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading table data...</span>
                </div>
              )}
              
              {!tableDataLoading && tableData && (
                <>
                  {/* Selection overlay indicator */}
                  <div className="sticky top-0 left-2 z-10 bg-blue-600 text-white px-3 py-1 rounded-md text-sm mb-2">
                    Click any row to select it
                  </div>
                  
                  {/* Filter rows based on search term */}
                  {(() => {
                    const filteredRows = searchTerm 
                      ? tableData.rows.filter(row => 
                          row.fieldValues.some(fv => 
                            fv.value && 
                            String(fv.value).toLowerCase().includes(searchTerm.toLowerCase())
                          )
                        )
                      : tableData.rows;
                    
                    return (
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
                    );
                  })()}
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
                  <span>
                    {relations.length} selected
                  </span>
                )}
                {multiple && relations.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                  >
                    Done
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </FieldInput>
  );
}