'use client'

// AIDEV-NOTE: Client component for TableEditor - uses Server Actions for data operations
// AIDEV-TODO: Add optimistic updates and error boundaries

import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getFields } from '@/src/app/actions/fields';
import { getRowsData } from '@/src/app/actions/rows';
import { getTables } from '@/src/app/actions/tables';
import type { FieldDTO } from '@/src/app/mappers/field-mapper';
import type { Row } from '@/src/ddd/domain/tables/value-objects/row';
import FieldManager from './FieldManager';
import RowManager from './RowManager';

interface TableEditorClientProps {
  tableId: number;
  tableName: string;
  organizationId: number;
  onBack: () => void;
}

export default function TableEditorClient({ tableId, tableName, organizationId, onBack }: TableEditorClientProps) {
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [availableTables, setAvailableTables] = useState<Array<{ id: number; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [tableId]);

  const loadData = async () => {
    try {
      console.log('[TABLE-EDITOR-DEBUG] loadData started for tableId:', tableId, 'tableName:', tableName);
      setIsLoading(true);
      
      const [fieldsData, rowsData, tablesData] = await Promise.all([
        getFields(tableId),
        getRowsData(tableId),
        getTables()
      ]);
      
      console.log('[TABLE-EDITOR-DEBUG] loadData results:', {
        fieldsCount: fieldsData.length,
        rowsCount: rowsData.length,
        tablesCount: tablesData.length,
        fields: fieldsData.map(f => ({ id: f.id, name: f.name, type: f.type }))
      });
      
      setFields(fieldsData);
      setRows(Array.from(rowsData) as unknown as Row[]);
      setAvailableTables(tablesData.map(t => ({ id: t.id, name: t.name })));
      
      console.log('[TABLE-EDITOR-DEBUG] State updated after loadData');
    } catch (error) {
      console.error('[TABLE-EDITOR-DEBUG] Error loading table data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldUpdate = async () => {
    try {
      console.log('[TABLE-EDITOR-DEBUG] handleFieldUpdate started for tableId:', tableId);
      console.log('[TABLE-EDITOR-DEBUG] Previous fields state:', fields.map(f => ({ id: f.id, name: f.name, type: f.type })));
      
      // Reload both fields and rows since field changes affect row structure
      const [fieldsData, rowsData, tablesData] = await Promise.all([
        getFields(tableId),
        getRowsData(tableId),
        getTables()
      ]);
      
      console.log('[TABLE-EDITOR-DEBUG] handleFieldUpdate results:', {
        fieldsCount: fieldsData.length,
        rowsCount: rowsData.length,
        tablesCount: tablesData.length,
        newFields: fieldsData.map(f => ({ id: f.id, name: f.name, type: f.type })),
        fieldChanges: {
          added: fieldsData.filter(newF => !fields.find(oldF => oldF.id === newF.id)),
          removed: fields.filter(oldF => !fieldsData.find(newF => newF.id === oldF.id)),
          modified: fieldsData.filter(newF => {
            const oldF = fields.find(oldF => oldF.id === newF.id);
            return oldF && (oldF.name !== newF.name || oldF.type !== newF.type);
          })
        }
      });
      
      setFields(fieldsData);
      setRows(Array.from(rowsData) as unknown as Row[]);
      setAvailableTables(tablesData.map(t => ({ id: t.id, name: t.name })));
      
      console.log('[TABLE-EDITOR-DEBUG] State updated after handleFieldUpdate');
    } catch (error) {
      console.error('[TABLE-EDITOR-DEBUG] Error refreshing fields:', error);
    }
  };

  const handleRowUpdate = async () => {
    try {
      const rowsData = await getRowsData(tableId);
      setRows(Array.from(rowsData) as unknown as Row[]);
    } catch (error) {
      console.error('Error refreshing rows:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading table data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tableName}</h1>
            <p className="text-sm text-gray-500">
              {fields.length} fields, {rows.length} rows
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <FieldManager
          tableId={tableId}
          organizationId={organizationId}
          fields={fields}
          availableTables={availableTables}
          onFieldUpdate={handleFieldUpdate}
        />

        <RowManager
          tableId={tableId}
          organizationId={organizationId}
          fields={fields}
          rows={rows}
          onRowUpdate={handleRowUpdate}
        />
      </div>
    </div>
  );
}
