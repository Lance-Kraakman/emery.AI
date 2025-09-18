'use client'

// AIDEV-NOTE: Client component for row data management - refactored with extracted components
// AIDEV-QUESTION: Should we implement virtual scrolling for large datasets?

import { Plus } from 'lucide-react';
import type { FieldDTO } from '@/src/app/mappers/field-mapper';
import type { Row } from '@/src/ddd/domain/tables/value-objects/row';
import { useRowManager } from '@/src/hooks/useRowManager';
import { Button } from '@/src/components/ui/button';
import RowForm from './RowForm';
import RowTable from './RowTable';

interface RowManagerProps {
  tableId: number;
  organizationId: number;
  fields: FieldDTO[];
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
        <h3 className="text-lg font-semibold">Data</h3>
        <Button
          onClick={() => setShowNewRow(true)}
          disabled={isPending || fields.length === 0}
          variant="success"
          size="sm"
        >
          <Plus size={16} />
          Add Row
        </Button>
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
