/**
 * SaveToDatabaseDialog - Dialog for saving edited file content to a database table
 *
 * Used when a chat-attached file (no rowId) is edited and needs to be saved
 * to a database table. Allows user to select target table and file field.
 *
 * AIDEV-NOTE: Dialog component for saving edited files from chat artifacts
 * to database tables when they don't have an existing row context.
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2, Database, File } from 'lucide-react'
import { getTables } from '@/app/actions/tables'
import { getFields } from '@/app/actions/fields'
import { searchTableRows } from '@/app/actions/tables'
import type { TableDTO } from '@/app/mappers/table-mapper'
import type { FieldDTO } from '@/app/mappers/field-mapper'
import { createDebugLogger } from '@/lib/utils/debug-logger'

const logger = createDebugLogger('SaveToDatabaseDialog')

interface SaveToDatabaseDialogProps {
  open: boolean
  onClose: () => void
  onSave: (tableId: number, fieldId: number, rowId?: string) => Promise<void>
  fileName: string
  fileType: string
}

interface RowOption {
  id: string
  value: string
}

export function SaveToDatabaseDialog({
  open,
  onClose,
  onSave,
  fileName,
  fileType,
}: SaveToDatabaseDialogProps) {
  const [tables, setTables] = useState<TableDTO[]>([])
  const [fields, setFields] = useState<FieldDTO[]>([])
  const [rows, setRows] = useState<RowOption[]>([])

  const [selectedTableId, setSelectedTableId] = useState<string>('')
  const [selectedFieldId, setSelectedFieldId] = useState<string>('')
  const [saveMode, setSaveMode] = useState<'new' | 'existing'>('new')
  const [selectedRowId, setSelectedRowId] = useState<string>('')

  const [loadingTables, setLoadingTables] = useState(false)
  const [loadingFields, setLoadingFields] = useState(false)
  const [loadingRows, setLoadingRows] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load tables on mount
  useEffect(() => {
    if (open) {
      setLoadingTables(true)
      getTables()
        .then(tableList => {
          setTables(tableList)
          setLoadingTables(false)
        })
        .catch(err => {
          logger.error('Failed to load tables', err)
          setError('Failed to load tables')
          setLoadingTables(false)
        })
    }
  }, [open])

  // Load fields when table is selected
  useEffect(() => {
    if (selectedTableId) {
      setLoadingFields(true)
      setSelectedFieldId('')
      setFields([])

      getFields(parseInt(selectedTableId))
        .then(fieldList => {
          // Filter to only file or document fields
          const fileFields = fieldList.filter(f => f.type === 'file' || f.type === 'document')
          setFields(fileFields)
          setLoadingFields(false)
        })
        .catch(err => {
          logger.error('Failed to load fields', err)
          setError('Failed to load fields')
          setLoadingFields(false)
        })
    }
  }, [selectedTableId])

  // Load rows when table is selected and mode is "existing"
  useEffect(() => {
    if (selectedTableId && saveMode === 'existing') {
      setLoadingRows(true)
      setSelectedRowId('')
      setRows([])

      searchTableRows(parseInt(selectedTableId), '', 50)
        .then(result => {
          if (result.success && result.data) {
            setRows(result.data as RowOption[])
          }
          setLoadingRows(false)
        })
        .catch(err => {
          logger.error('Failed to load rows', err)
          setError('Failed to load rows')
          setLoadingRows(false)
        })
    }
  }, [selectedTableId, saveMode])

  // Handle save
  const handleSave = useCallback(async () => {
    if (!selectedTableId || !selectedFieldId) {
      setError('Please select a table and field')
      return
    }

    if (saveMode === 'existing' && !selectedRowId) {
      setError('Please select a row')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave(
        parseInt(selectedTableId),
        parseInt(selectedFieldId),
        saveMode === 'existing' ? selectedRowId : undefined
      )
      onClose()
    } catch (err) {
      logger.error('Failed to save file', err)
      setError(err instanceof Error ? err.message : 'Failed to save file')
    } finally {
      setSaving(false)
    }
  }, [selectedTableId, selectedFieldId, saveMode, selectedRowId, onSave, onClose])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedTableId('')
      setSelectedFieldId('')
      setSaveMode('new')
      setSelectedRowId('')
      setError(null)
      setFields([])
      setRows([])
    }
  }, [open])

  const canSave = selectedTableId && selectedFieldId && (saveMode === 'new' || selectedRowId)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Save to Database
          </DialogTitle>
          <DialogDescription>
            Save "{fileName}" to a table in your database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Table Selection */}
          <div className="space-y-2">
            <Label htmlFor="table">Table</Label>
            <Select
              value={selectedTableId}
              onValueChange={setSelectedTableId}
              disabled={loadingTables}
            >
              <SelectTrigger id="table">
                <SelectValue placeholder={loadingTables ? 'Loading tables...' : 'Select a table'} />
              </SelectTrigger>
              <SelectContent>
                {tables.map(table => (
                  <SelectItem key={table.id} value={table.id.toString()}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Field Selection */}
          <div className="space-y-2">
            <Label htmlFor="field">File Field</Label>
            <Select
              value={selectedFieldId}
              onValueChange={setSelectedFieldId}
              disabled={!selectedTableId || loadingFields}
            >
              <SelectTrigger id="field">
                <SelectValue
                  placeholder={
                    !selectedTableId
                      ? 'Select a table first'
                      : loadingFields
                        ? 'Loading fields...'
                        : fields.length === 0
                          ? 'No file fields available'
                          : 'Select a file field'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {fields.map(field => (
                  <SelectItem key={field.id} value={field.id.toString()}>
                    <div className="flex items-center gap-2">
                      <File className="w-3 h-3" />
                      {field.name}
                      <span className="text-xs text-muted-foreground">({field.type})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTableId && !loadingFields && fields.length === 0 && (
              <p className="text-xs text-muted-foreground">
                This table has no file or document fields. Add a file field to the table first.
              </p>
            )}
          </div>

          {/* Save Mode Selection */}
          <div className="space-y-2">
            <Label>Save as</Label>
            <RadioGroup value={saveMode} onValueChange={(v: string) => setSaveMode(v as 'new' | 'existing')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="new" />
                <Label htmlFor="new" className="font-normal">Create new row</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="existing" />
                <Label htmlFor="existing" className="font-normal">Add to existing row</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Row Selection (for existing mode) */}
          {saveMode === 'existing' && (
            <div className="space-y-2">
              <Label htmlFor="row">Row</Label>
              <Select
                value={selectedRowId}
                onValueChange={setSelectedRowId}
                disabled={!selectedTableId || loadingRows}
              >
                <SelectTrigger id="row">
                  <SelectValue
                    placeholder={
                      !selectedTableId
                        ? 'Select a table first'
                        : loadingRows
                          ? 'Loading rows...'
                          : rows.length === 0
                            ? 'No rows available'
                            : 'Select a row'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {rows.map(row => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.value || `Row ${row.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save to Database'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
