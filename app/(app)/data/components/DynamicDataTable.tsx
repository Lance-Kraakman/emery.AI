"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2 } from "lucide-react"
import { EditableCell } from "./EditableCell"
import type { FieldDTO } from "@/app/mappers/field-mapper"
import type { RowDTO } from "@/app/mappers/row-mapper"

interface DynamicDataTableProps {
  fields: FieldDTO[];
  rows: RowDTO[];
  organizationId: number;
  tableId: number;
  onUpdateRow: (rowId: string, fieldId: number, value: any) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: string) => void;
}

export function DynamicDataTable({ fields, rows, organizationId, tableId, onUpdateRow, onAddRow, onDeleteRow }: DynamicDataTableProps) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  const handleSelectRow = (rowId: string, selected: boolean) => {
    const newSelected = new Set(selectedRows)
    if (selected) {
      newSelected.add(rowId)
    } else {
      newSelected.delete(rowId)
    }
    setSelectedRows(newSelected)
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedRows(new Set(rows.map((row) => row.id)))
    } else {
      setSelectedRows(new Set())
    }
  }

  const handleDeleteSelected = async () => {
    for (const rowId of Array.from(selectedRows)) {
      await onDeleteRow(rowId)
    }
    setSelectedRows(new Set())
  }

  // Sort fields by orderIndex
  const sortedFields = [...fields].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={onAddRow} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add Row
          </Button>
          {selectedRows.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete ({selectedRows.size})
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {rows.length} row{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="border rounded-md overflow-auto max-h-[calc(100vh-15rem)]">
        <Table className="text-sm">
          <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
            <TableRow>
              <TableHead className="w-10 px-2">
                <Checkbox
                  checked={selectedRows.size === rows.length && rows.length > 0}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                />
              </TableHead>
              {sortedFields.map((field) => (
                <TableHead key={field.id} className="min-w-[120px] p-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{field.name}</span>
                    {field.required && <span className="text-red-500">*</span>}
                    <span className="text-muted-foreground font-mono text-[10px] capitalize">
                      {field.type}
                    </span>
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-10 p-0"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className={`hover:bg-muted/30 ${selectedRows.has(row.id) ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}>
                <TableCell className="px-2">
                  <Checkbox
                    checked={selectedRows.has(row.id)}
                    onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)}
                  />
                </TableCell>
                {sortedFields.map((field) => (
                  <TableCell key={field.id} className="p-1">
                    <EditableCell
                      field={field}
                      value={row.fieldValues.find(fv => fv.fieldSlug === field.name)?.value}
                      organizationId={organizationId}
                      tableId={tableId}
                      onSave={(value) => onUpdateRow(row.id, field.id, value)}
                    />
                  </TableCell>
                ))}
                <TableCell className="p-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeleteRow(row.id)}
                    className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 w-7 h-7"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={sortedFields.length + 2} className="text-center h-24 text-muted-foreground">
                  No data available. Click "Add Row" to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
