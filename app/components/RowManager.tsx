'use client'

// AIDEV-NOTE: Client component for row data management - refactored with extracted components
// AIDEV-QUESTION: Should we implement virtual scrolling for large datasets?

import { Plus } from 'lucide-react';
import { Field, Row } from '@/app/actions/types';
import { useRowManager } from '@/hooks/useRowManager';
import RowForm from './RowForm';
import RowTable from './RowTable';

interface RowManagerProps {
  tableId: number;
  organizationId: number;
  fields: Field[];
  rows: Row[];
  onRowUpdate: () => void;
}

export default function RowManager({ tableId, organizationId, fields, rows, onRowUpdate }: RowManagerProps) {
  const {
    showNewRow,
    editingRow,
    newRowData,
    editRowData,
    isPending,
    setShowNewRow,
    startEditRow,
    cancelEdit,
    cancelNewRow,
    updateNewRowField,
    updateEditRowField,
    handleCreateRow,
    handleUpdateRow,
    handleDeleteRow,
  } = useRowManager({ tableId, fields, onRowUpdate });


  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Data</h3>
        <button
          onClick={() => setShowNewRow(true)}
          disabled={isPending || fields.length === 0}
          className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          <Plus size={16} />
          Add Row
        </button>
      </div>

      {showNewRow && (
        <RowForm
          fields={fields}
          rowData={newRowData}
          onFieldChange={updateNewRowField}
          onSubmit={handleCreateRow}
          onCancel={cancelNewRow}
          isPending={isPending}
          title="Create New Row"
          tableId={tableId}
          organizationId={organizationId}
          submitLabel="Create Row"
        />
      )}

      <RowTable
        fields={fields}
        rows={rows}
        editingRow={editingRow}
        editRowData={editRowData}
        onStartEdit={startEditRow}
        onCancelEdit={cancelEdit}
        onUpdateRow={handleUpdateRow}
        onDeleteRow={handleDeleteRow}
        onFieldChange={updateEditRowField}
        isPending={isPending}
        tableId={tableId}
        organizationId={organizationId}
      />
    </div>
  );
}