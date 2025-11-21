"use client"

import React, { useState, useMemo, useEffect } from "react"
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
import { Plus, Trash2, GripVertical } from "lucide-react"
import { 
  DndContext, 
  DragEndEvent, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { createField, deleteField, reorderFields } from "@/app/actions/fields"
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

// Sortable row component for drag-and-drop
function SortableFieldRow({ field, index, onDelete }: {
  field: FieldDTO
  index: number
  onDelete: (fieldName: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.name })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`flex items-center gap-3 p-3 border-b hover:bg-gray-50 ${isDragging ? 'bg-blue-50' : ''}`}
    >
      {/* Drag handle */}
      <div 
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Field info */}
      <div className="flex-1 grid grid-cols-4 gap-4 items-center">
        <div className="font-medium">{field.name}</div>
        
        <div>
          <Badge variant="outline" className="capitalize">
            {field.type}
          </Badge>
        </div>
        
        <div>
          {field.required ? (
            <Badge variant="destructive" className="text-xs">Required</Badge>
          ) : (
            <span className="text-sm text-muted-foreground">Optional</span>
          )}
        </div>
        
        <div className="text-sm text-muted-foreground">
          Order: {field.orderIndex}
        </div>
      </div>

      {/* Actions */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(field.name)}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
        title="Delete field"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  )
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email Address" },
  { value: "phone", label: "Phone Number" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
  { value: "single-select", label: "Single Select" },
  { value: "multi-select", label: "Multiple Select" },
  { value: "autonumber", label: "Auto Number" },
  { value: "last-updated", label: "Last Updated" },
  { value: "created-at", label: "Created At" },
  { value: "relation", label: "Relation" },
  { value: "file", label: "File" },
  { value: "document", label: "Document" },
  { value: "embedding", label: "Embedding" },
]

export function FieldManagerDialog({ isOpen, onClose, tableId, fields, onFieldsUpdated }: FieldManagerDialogProps) {
  const [isAddingField, setIsAddingField] = useState(false)
  const [newFieldName, setNewFieldName] = useState("")
  const [newFieldType, setNewFieldType] = useState<FieldType | "">("")
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [newFieldRelatedTableId, setNewFieldRelatedTableId] = useState<number | undefined>()
  const [embeddingSize, setEmbeddingSize] = useState<number | undefined>()
  const [loading, setLoading] = useState(false)
  const [availableTables, setAvailableTables] = useState<TableDTO[]>([])

  // Optimistic state for field reordering
  const [optimisticFields, setOptimisticFields] = useState<FieldDTO[] | null>(null)
  const [reorderError, setReorderError] = useState<string | null>(null)

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) return

    if (active.id !== over.id) {
      const oldIndex = sortedFields.findIndex((field) => field.name === active.id)
      const newIndex = sortedFields.findIndex((field) => field.name === over.id)

      if (oldIndex === -1 || newIndex === -1) return

      // Create new field order with arrayMove
      const newFields = arrayMove(sortedFields, oldIndex, newIndex)
      
      // Generate field orders for the new arrangement
      const fieldOrders = newFields.map((field, index) => ({
        fieldName: field.name,
        orderIndex: index
      }))

      // Optimistic update: update UI immediately
      setOptimisticFields(newFields)
      setReorderError(null)

      try {
        setLoading(true)
        
        const result = await reorderFields({
          tableId,
          fieldOrders
        })
        
        if (result.success) {
          onFieldsUpdated()
          setOptimisticFields(null) // Clear optimistic state on success
        } else {
          // Rollback on error
          setOptimisticFields(null)
          setReorderError(result.error || "Failed to reorder fields")
        }
      } catch (error) {
        console.error("Failed to reorder fields:", error)
        // Rollback on error
        setOptimisticFields(null)
        setReorderError("Failed to reorder fields")
      } finally {
        setLoading(false)
      }
    }
  }

  // Setup DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleAddField = async () => {
    if (!newFieldName || !newFieldType) return

    // Validate embedding field has size selected
    if (newFieldType === 'embedding' && !embeddingSize) {
      alert("Please select an embedding size")
      return
    }

    try {
      setLoading(true)

      // Build metadata for embedding fields
      const metadata = newFieldType === 'embedding' && embeddingSize ? {
        embeddingSize: embeddingSize.toString()
      } : undefined

      const result = await createField({
        tableId,
        name: newFieldName,
        type: newFieldType as FieldType,
        required: newFieldRequired,
        relatedTableId: newFieldType === 'relation' ? newFieldRelatedTableId : undefined,
        metadata
      })

      if (result.success) {
        setNewFieldName("")
        setNewFieldType("")
        setNewFieldRequired(false)
        setNewFieldRelatedTableId(undefined)
        setEmbeddingSize(undefined)
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
    if (newFieldType === 'relation') {
      try {
        console.log('[FieldManagerDialog] Loading tables for relation field...');
        const tables = await getTables()
        console.log('[FieldManagerDialog] Loaded tables:', tables.length);
        const filteredTables = tables.filter(t => t.id !== tableId); // Exclude current table
        console.log('[FieldManagerDialog] Filtered tables (excluding current):', filteredTables.length);
        setAvailableTables(filteredTables)
      } catch (error) {
        console.error("Failed to load tables:", error)
        setAvailableTables([]) // Set empty array on error
      }
    }
  }

  // Load tables when relation type is selected
  useEffect(() => {
    if (newFieldType === 'relation') {
      loadTables()
    }
  }, [newFieldType])

  const handleClose = () => {
    setIsAddingField(false)
    setNewFieldName("")
    setNewFieldType("")
    setNewFieldRequired(false)
    setNewFieldRelatedTableId(undefined)
    onClose()
  }

  // Sort fields by orderIndex, with optimistic updates
  const sortedFields = useMemo(() => {
    const baseFields = [...fields].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    return optimisticFields || baseFields
  }, [fields, optimisticFields]);

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
  ], []);

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
            <div className="text-xs text-muted-foreground mb-2">
              Drag and drop fields to reorder them
            </div>
            {reorderError && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {reorderError}
              </div>
            )}
            <div className="border rounded-md">
              {sortedFields.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={sortedFields.map(field => field.name)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="divide-y">
                      {sortedFields.map((field, index) => (
                        <SortableFieldRow
                          key={field.name}
                          field={field}
                          index={index}
                          onDelete={handleDeleteField}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="text-center text-muted-foreground py-6">
                  No fields created yet. Add your first field below.
                </div>
              )}
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
                    if (value !== 'embedding') {
                      setEmbeddingSize(undefined)
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
                      <SelectValue placeholder={
                        availableTables.length === 0
                          ? "No tables available..."
                          : "Select table to relate to..."
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTables.length === 0 ? (
                        <div className="px-2 py-1 text-sm text-muted-foreground">
                          No tables found. Create some tables first.
                        </div>
                      ) : (
                        availableTables.map((table) => (
                          <SelectItem key={table.id} value={table.id.toString()}>
                            {table.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {availableTables.length === 0 && (
                    <div className="text-xs text-muted-foreground">
                      Debug: No tables loaded. Check console for errors.
                    </div>
                  )}
                </div>
              )}

              {newFieldType === 'embedding' && (
                <div className="space-y-2">
                  <Label htmlFor="embeddingSize">Embedding Size *</Label>
                  <Select
                    value={embeddingSize?.toString()}
                    onValueChange={(value) => setEmbeddingSize(parseInt(value))}
                  >
                    <SelectTrigger id="embeddingSize">
                      <SelectValue placeholder="Select embedding size..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="384">384 dimensions (MiniLM-L6)</SelectItem>
                      <SelectItem value="768">768 dimensions (BERT/MPNet)</SelectItem>
                      <SelectItem value="1536">1536 dimensions (OpenAI ada-002)</SelectItem>
                      <SelectItem value="3072">3072 dimensions (Large models)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Choose the dimension size for embedding vectors
                  </p>
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
