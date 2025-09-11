"use client"

import { useState, useMemo } from "react"
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  createColumnHelper,
  flexRender,
  type ColumnDef
} from '@tanstack/react-table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2 } from "lucide-react"
import { createField, deleteField } from "@/app/actions/fields"
import { getTables } from "@/app/actions/tables"
import type { FieldType } from "@/ddd/domain/tables/value-objects/table-field"
import type { TableDTO } from "@/app/mappers/table-mapper"
import type { FieldDTO } from "@/app/mappers/field-mapper"

interface FieldManagerDialogProps {
  isOpen: boolean
  onClose: () => void
  tableId: number
  fields: FieldDTO[]
  onFieldsUpdated: () => void
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "date", label: "Date" },
  { value: "relation", label: "Relation" },
  { value: "file", label: "File" },
  { value: "document", label: "Document" },
]

export function FieldManagerDialog({ isOpen, onClose, tableId, fields, onFieldsUpdated }: FieldManagerDialogProps) {
  const [isAddingField, setIsAddingField] = useState(false)
  const [newFieldName, setNewFieldName] = useState("")
  const [newFieldType, setNewFieldType] = useState<FieldType | "">("")
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [newFieldRelatedTableId, setNewFieldRelatedTableId] = useState<number | undefined>()
  const [loading, setLoading] = useState(false)
  const [availableTables, setAvailableTables] = useState<TableDTO[]>([])

  const handleAddField = async () => {
    if (!newFieldName || !newFieldType) return

    try {
      setLoading(true)
      const result = await createField({
        tableId,
        name: newFieldName,
        type: newFieldType as FieldType,
        required: newFieldRequired,
        relatedTableId: newFieldType === 'relation' ? newFieldRelatedTableId : undefined
      })

      if (result.success) {
        setNewFieldName("")
        setNewFieldType("")
        setNewFieldRequired(false)
        setNewFieldRelatedTableId(undefined)
        setIsAddingField(false)
        onFieldsUpdated()
      } else {
        alert(result.error || "Failed to create field")
      }
    } catch (error) {
      console.error("Failed to create field:", error)
      alert("Failed to create field")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteField = async (fieldName: string) => {
    if (!confirm("Are you sure you want to delete this field? All data in this field will be lost.")) {
      return
    }

    try {
      setLoading(true)
      const result = await deleteField(tableId, fieldName)

      if (result.success) {
        onFieldsUpdated()
      } else {
        alert(result.error || "Failed to delete field")
      }
    } catch (error) {
      console.error("Failed to delete field:", error)
      alert("Failed to delete field")
    } finally {
      setLoading(false)
    }
  }

  const loadTables = async () => {
    if (newFieldType === 'relation' && availableTables.length === 0) {
      try {
        const tables = await getTables()
        setAvailableTables(tables.filter(t => t.id !== tableId)) // Exclude current table
      } catch (error) {
        console.error("Failed to load tables:", error)
      }
    }
  }

  const handleClose = () => {
    setIsAddingField(false)
    setNewFieldName("")
    setNewFieldType("")
    setNewFieldRequired(false)
    setNewFieldRelatedTableId(undefined)
    onClose()
  }

  // Sort fields by orderIndex
  const sortedFields = useMemo(() => 
    [...fields].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)), 
    [fields]
  );

  const columnHelper = createColumnHelper<FieldDTO>();

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue()}</span>
      ),
    }),
    columnHelper.accessor('type', {
      header: 'Type',
      cell: ({ getValue }) => (
        <Badge variant="outline" className="capitalize">
          {getValue()}
        </Badge>
      ),
    }),
    columnHelper.accessor('required', {
      header: 'Required',
      cell: ({ getValue }) => (
        getValue() ? <Badge variant="destructive" className="text-xs">Required</Badge> : null
      ),
    }),
    columnHelper.accessor('orderIndex', {
      header: 'Order',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">{getValue()}</span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDeleteField(row.original.name)}
          disabled={loading}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
      maxSize: 80,
    }),
  ], [handleDeleteField, loading]);

  const table = useReactTable({
    data: sortedFields,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Fields</DialogTitle>
          <DialogDescription>
            Add, edit, and delete fields for this table. Changes will affect the table structure.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing Fields */}
          <div>
            <h3 className="text-sm font-medium mb-2">Current Fields</h3>
            <div className="border rounded-md">
              <UITable>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className={header.id === 'actions' ? "w-20" : ""}>
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
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-6">
                        No fields created yet. Add your first field below.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </UITable>
            </div>
          </div>

          {/* Add New Field */}
          {!isAddingField ? (
            <Button onClick={() => setIsAddingField(true)} variant="outline" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Field
            </Button>
          ) : (
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-medium">Add New Field</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fieldName">Field Name</Label>
                  <Input
                    id="fieldName"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="Enter field name..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fieldType">Field Type</Label>
                  <Select value={newFieldType} onValueChange={(value) => {
                    setNewFieldType(value as FieldType)
                    if (value !== 'relation') {
                      setNewFieldRelatedTableId(undefined)
                    } else {
                      loadTables()
                    }
                  }}>
                    <SelectTrigger id="fieldType">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newFieldType === 'relation' && (
                <div className="space-y-2">
                  <Label htmlFor="relatedTable">Related Table</Label>
                  <Select 
                    value={newFieldRelatedTableId?.toString()} 
                    onValueChange={(value) => setNewFieldRelatedTableId(parseInt(value))}
                  >
                    <SelectTrigger id="relatedTable">
                      <SelectValue placeholder="Select table to relate to..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTables.map((table) => (
                        <SelectItem key={table.id} value={table.id.toString()}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="fieldRequired"
                  checked={newFieldRequired}
                  onCheckedChange={(checked) => setNewFieldRequired(!!checked)}
                />
                <Label htmlFor="fieldRequired" className="text-sm">
                  Required field
                </Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddField} disabled={loading || !newFieldName || !newFieldType}>
                  {loading ? "Adding..." : "Add Field"}
                </Button>
                <Button variant="outline" onClick={() => setIsAddingField(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
