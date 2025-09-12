"use client"

import { useState, useMemo } from "react"
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2 } from "lucide-react"
import { EditableCell } from "./EditableCell"
import type { FieldDTO } from "@/app/mappers/field-mapper"
import type { RowDTO, FieldValueDTO } from "@/app/mappers/row-mapper"

interface DynamicDataTableProps {
  fields: FieldDTO[];
  rows: RowDTO[];
  organizationId: number;
  tableId: number;
  onUpdateRow: (rowId: string, fieldId: number, value: FieldValueDTO) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: string) => void;
}

export function DynamicDataTable({ fields, rows, organizationId, tableId, onUpdateRow, onAddRow, onDeleteRow }: DynamicDataTableProps) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const columnHelper = createColumnHelper<RowDTO>();

  // Sort fields by orderIndex
  const sortedFields = useMemo(() => 
    [...fields].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)), 
    [fields]
  );

  const columns = useMemo<ColumnDef<RowDTO>[]>(() => [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    }),
    ...sortedFields.map((field) =>
      columnHelper.accessor((row) => row.fieldValues.find(fv => fv.fieldSlug === field.name)?.value as unknown, {
        id: field.id.toString(),
        header: () => (
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{field.name}</span>
            {field.required && <span className="text-red-500">*</span>}
            <span className="text-muted-foreground font-mono text-[10px] capitalize">
              {field.type}
            </span>
          </div>
        ),
        cell: ({ row }) => {
          const rowData = row.original;
          return (
            <EditableCell
              field={field}
              value={rowData.fieldValues.find(fv => fv.fieldSlug === field.name)?.value}
              organizationId={organizationId}
              tableId={tableId}
              onSave={(value) => onUpdateRow(rowData.id, field.id, value)}
            />
          );
        },
        minSize: 120,
      })
    ),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDeleteRow(row.original.id)}
          className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 w-7 h-7"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    }),
  ], [sortedFields, organizationId, tableId, onUpdateRow, onDeleteRow]);

  const table = useReactTable({
    data: rows,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
  });

  const selectedRowIds = Object.keys(rowSelection).filter(key => rowSelection[key]);
  const selectedRowCount = selectedRowIds.length;

  const handleDeleteSelected = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    for (const row of selectedRows) {
      await onDeleteRow(row.original.id);
    }
    setRowSelection({});
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={onAddRow} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add Row
          </Button>
          {selectedRowCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete ({selectedRowCount})
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
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className={header.id === 'select' || header.id === 'actions' ? "w-10 px-2" : "min-w-[120px] p-2"}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={`hover:bg-muted/30 ${row.getIsSelected() ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cell.column.id === 'select' ? "px-2" : cell.column.id === 'actions' ? "p-0" : "p-1"}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center h-24 text-muted-foreground">
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
