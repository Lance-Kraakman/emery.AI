'use client'

import { useState, useTransition } from 'react';
import type { FieldDTO } from '@/src/app/mappers/field-mapper';
import type { Row } from '@/src/ddd/domain/tables/value-objects/row';
import { createRowAction, updateRowAction, deleteRowAction } from '@/src/app/actions/rows';

interface UseRowManagerProps {
  tableId: number;
  fields: FieldDTO[];
  onRowUpdate: () => void;
}

export function useRowManager({ tableId, fields, onRowUpdate }: UseRowManagerProps) {
  const [showNewRow, setShowNewRow] = useState(false);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});
  const [editRowData, setEditRowData] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  async function handleCreateRow(formData: FormData) {
    startTransition(async () => {
      try {
        console.log('[SIMPLE-SUBMIT] Using newRowData state:', newRowData);
        
        const data = JSON.stringify(newRowData);
        formData.append('data', data);
        await createRowAction(formData);
        setNewRowData({});
        setShowNewRow(false);
        onRowUpdate();
      } catch (error) {
        console.error('Error creating row:', error);
        alert('Failed to create row');
      }
    });
  }

  async function handleUpdateRow(rowId: string) {
    startTransition(async () => {
      try {
        console.log('[ROW-EDIT-DEBUG] handleUpdateRow sending data:', {
          rowId,
          tableId,
          fieldsBeingSent: Object.keys(editRowData),
          dataBeingSent: editRowData
        });
        
        const formData = new FormData();
        formData.append('tableId', tableId.toString());
        formData.append('rowId', rowId);
        formData.append('data', JSON.stringify(editRowData));
        await updateRowAction(formData);
        setEditingRow(null);
        setEditRowData({});
        onRowUpdate();
      } catch (error) {
        console.error('[ROW-EDIT-DEBUG] Error updating row:', error);
        alert('Failed to update row');
      }
    });
  }

  async function handleDeleteRow(rowId: string) {
    if (!confirm('Are you sure you want to delete this row?')) return;
    
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('tableId', tableId.toString());
        formData.append('rowId', rowId);
        await deleteRowAction(formData);
        onRowUpdate();
      } catch (error) {
        console.error('Error deleting row:', error);
        alert('Failed to delete row');
      }
    });
  }

  const startEditRow = (row: Row) => {
    console.log('[ROW-EDIT-DEBUG] startEditRow called for row:', row.id.value);
    setEditingRow(row.id.value);
    const rowData: Record<string, any> = {};
    fields.forEach(field => {
      const fieldValue = row.getFieldValue(field.name);
      rowData[field.name] = fieldValue?.value;
      console.log('[ROW-EDIT-DEBUG] Field loaded:', field.name, '=', fieldValue?.value);
    });
    console.log('[ROW-EDIT-DEBUG] Total fields loaded into edit form:', Object.keys(rowData).length, rowData);
    setEditRowData(rowData);
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditRowData({});
  };

  const cancelNewRow = () => {
    setShowNewRow(false);
    setNewRowData({});
  };

  const updateNewRowField = (fieldSlug: string, value: any) => {
    setNewRowData(prev => ({ ...prev, [fieldSlug]: value }));
  };

  const updateEditRowField = (fieldSlug: string, value: any) => {
    setEditRowData(prev => ({ ...prev, [fieldSlug]: value }));
  };

  return {
    // State
    showNewRow,
    editingRow,
    newRowData,
    editRowData,
    validationErrors,
    isPending,
    
    // Actions
    setShowNewRow,
    startEditRow,
    cancelEdit,
    cancelNewRow,
    updateNewRowField,
    updateEditRowField,
    handleCreateRow,
    handleUpdateRow,
    handleDeleteRow,
  };
}
