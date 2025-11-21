"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle } from "lucide-react"
import type { FieldDTO } from "@/app/mappers/field-mapper"
import type { FieldType, SelectOption } from "@/ddd/domain/tables/value-objects/table-field"
import type { TableDTO } from "@/app/mappers/table-mapper"
import { SelectOptionsManager } from "@/components/tables/fields/SelectOptionsManager"
import { AutonumberCounterReset } from "@/components/tables/fields/AutonumberCounterReset"

interface EditFieldPanelProps {
  field: FieldDTO | null
  isOpen: boolean
  onClose: () => void
  onSave: (field: FieldDTO, updates: Partial<FieldDTO>) => Promise<void>
  availableTables?: TableDTO[]
  tableId: number
}

const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
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

export function EditFieldPanel({ field, isOpen, onClose, onSave, availableTables = [], tableId }: EditFieldPanelProps) {
  const [name, setName] = useState(field?.name || "")
  const [type, setType] = useState<FieldType | "">(field?.type || "")
  const [required, setRequired] = useState(field?.required || false)
  const [relatedTableId, setRelatedTableId] = useState<number | undefined>(field?.relatedTableId ?? undefined)
  const [embeddingSize, setEmbeddingSize] = useState<number | undefined>()

  // Autonumber config
  const [autonumberPrefix, setAutonumberPrefix] = useState<string>("")
  const [autonumberSuffix, setAutonumberSuffix] = useState<string>("")
  const [autonumberDigits, setAutonumberDigits] = useState<number>(1)
  const [autonumberStart, setAutonumberStart] = useState<number>(1)

  // Timestamp config (last-updated, created-at)
  const [includeTime, setIncludeTime] = useState<boolean>(true)

  // Select field config (single-select, multi-select)
  const [selectOptions, setSelectOptions] = useState<SelectOption[]>([])
  const [defaultSelectOption, setDefaultSelectOption] = useState<number | undefined>()
  const [maxSelections, setMaxSelections] = useState<number | undefined>()

  const [showTypeWarning, setShowTypeWarning] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (field) {
      setName(field.name)
      setType(field.type)
      setRequired(field.required || false)
      setRelatedTableId(field.relatedTableId ?? undefined)

      // Load existing embedding size from metadata
      if (field.type === 'embedding' && field.metadata?.embeddingSize) {
        const size = typeof field.metadata.embeddingSize === 'string'
          ? parseInt(field.metadata.embeddingSize)
          : typeof field.metadata.embeddingSize === 'number'
          ? field.metadata.embeddingSize
          : undefined
        setEmbeddingSize(size)
      } else {
        setEmbeddingSize(undefined)
      }

      // Load autonumber config from metadata
      if (field.type === 'autonumber' && field.metadata) {
        setAutonumberPrefix(typeof field.metadata.prefix === 'string' ? field.metadata.prefix : "")
        setAutonumberSuffix(typeof field.metadata.suffix === 'string' ? field.metadata.suffix : "")
        setAutonumberDigits(typeof field.metadata.digits === 'number' ? field.metadata.digits : 1)
        setAutonumberStart(typeof field.metadata.startingNumber === 'number' ? field.metadata.startingNumber : 1)
      } else {
        setAutonumberPrefix("")
        setAutonumberSuffix("")
        setAutonumberDigits(1)
        setAutonumberStart(1)
      }

      // Load timestamp config from metadata
      if ((field.type === 'last-updated' || field.type === 'created-at') && field.metadata) {
        setIncludeTime(field.metadata.includeTime !== false)
      } else {
        setIncludeTime(true)
      }

      // Load select options from metadata
      if ((field.type === 'single-select' || field.type === 'multi-select') && field.metadata) {
        setSelectOptions(Array.isArray(field.metadata.options) ? field.metadata.options : [])
        setDefaultSelectOption(typeof field.metadata.defaultOption === 'number' ? field.metadata.defaultOption : undefined)
        setMaxSelections(typeof field.metadata.maxSelections === 'number' ? field.metadata.maxSelections : undefined)
      } else {
        setSelectOptions([])
        setDefaultSelectOption(undefined)
        setMaxSelections(undefined)
      }

      setShowTypeWarning(false)
    }
  }, [field])

  const handleTypeChange = (newType: FieldType) => {
    if (field && newType !== field.type) {
      setShowTypeWarning(true)
    }
    setType(newType)

    // Clear type-specific config when switching types
    if (newType !== 'embedding') {
      setEmbeddingSize(undefined)
    }
    if (newType !== 'autonumber') {
      setAutonumberPrefix("")
      setAutonumberSuffix("")
      setAutonumberDigits(1)
      setAutonumberStart(1)
    }
    if (newType !== 'last-updated' && newType !== 'created-at') {
      setIncludeTime(true)
    }
    if (newType !== 'single-select' && newType !== 'multi-select') {
      setSelectOptions([])
      setDefaultSelectOption(undefined)
      setMaxSelections(undefined)
    }
  }

  const handleSave = async () => {
    if (!field) return

    // Validate embedding field has size selected
    if (type === 'embedding' && !embeddingSize) {
      alert("Please select an embedding size")
      return
    }

    setLoading(true)
    try {
      // Build metadata based on field type
      let metadata: Record<string, any> | undefined = undefined

      if (type === 'embedding' && embeddingSize) {
        metadata = { embeddingSize: embeddingSize.toString() }
      } else if (type === 'autonumber') {
        metadata = {
          startingNumber: autonumberStart,
          prefix: autonumberPrefix || undefined,
          suffix: autonumberSuffix || undefined,
          digits: autonumberDigits > 0 ? autonumberDigits : undefined,
        }
      } else if (type === 'last-updated' || type === 'created-at') {
        metadata = {
          includeTime,
          timezone: "UTC"
        }
      } else if (type === 'single-select') {
        metadata = {
          options: selectOptions,
          defaultOption: defaultSelectOption
        }
      } else if (type === 'multi-select') {
        metadata = {
          options: selectOptions,
          maxSelections: maxSelections
        }
      }

      await onSave(field, {
        name,
        type: type as FieldType,
        required,
        relatedTableId: type === 'relation' ? relatedTableId : undefined,
        metadata
      })

      onClose()
    } catch (error) {
      console.error("Failed to update field:", error)
      alert("Failed to update field")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Field: {field?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Field Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Field Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter field name"
            />
          </div>

          {/* Field Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Field Type</Label>
            <Select value={type} onValueChange={(val) => handleTypeChange(val as FieldType)}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {showTypeWarning && (
              <div className="flex items-start gap-2 p-2 bg-destructive/10 text-destructive rounded text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Warning: Changing field type may corrupt existing data. Proceed with caution.</span>
              </div>
            )}
          </div>

          {/* Required Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="required"
              checked={required}
              onCheckedChange={(checked) => setRequired(checked as boolean)}
            />
            <Label htmlFor="required" className="text-sm font-normal cursor-pointer">
              Required field
            </Label>
          </div>

          {/* Relation-specific: Table selector */}
          {type === 'relation' && (
            <div className="space-y-2">
              <Label htmlFor="relatedTable">Related Table</Label>
              <Select
                value={relatedTableId?.toString()}
                onValueChange={(val) => setRelatedTableId(parseInt(val))}
              >
                <SelectTrigger id="relatedTable">
                  <SelectValue placeholder="Select table" />
                </SelectTrigger>
                <SelectContent>
                  {availableTables.map((table: TableDTO) => (
                    <SelectItem key={table.id} value={table.id.toString()}>
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Embedding-specific: Size selector */}
          {type === 'embedding' && (
            <div className="space-y-2">
              <Label htmlFor="embeddingSize">Embedding Size *</Label>
              <Select
                value={embeddingSize?.toString()}
                onValueChange={(val) => setEmbeddingSize(parseInt(val))}
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

          {/* Autonumber-specific: Configuration */}
          {type === 'autonumber' && (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="autonumberStart">Starting Number</Label>
                <Input
                  id="autonumberStart"
                  type="number"
                  min="1"
                  value={autonumberStart}
                  onChange={(e) => setAutonumberStart(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="autonumberPrefix">Prefix (optional)</Label>
                  <Input
                    id="autonumberPrefix"
                    placeholder="e.g., INV-"
                    value={autonumberPrefix}
                    onChange={(e) => setAutonumberPrefix(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="autonumberSuffix">Suffix (optional)</Label>
                  <Input
                    id="autonumberSuffix"
                    placeholder="e.g., -2025"
                    value={autonumberSuffix}
                    onChange={(e) => setAutonumberSuffix(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="autonumberDigits">Zero Padding</Label>
                <Input
                  id="autonumberDigits"
                  type="number"
                  min="1"
                  max="10"
                  value={autonumberDigits}
                  onChange={(e) => setAutonumberDigits(parseInt(e.target.value) || 1)}
                />
                <p className="text-xs text-muted-foreground">
                  Number of digits (e.g., 5 → 00001)
                </p>
              </div>
              <div className="text-sm text-muted-foreground border-t pt-2 mt-2">
                <strong>Preview:</strong> {autonumberPrefix}{String(autonumberStart).padStart(autonumberDigits, '0')}{autonumberSuffix}
              </div>

              {/* Current counter value and reset */}
              {field && field.type === 'autonumber' && (
                <AutonumberCounterReset field={field} tableId={tableId} />
              )}
            </div>
          )}

          {/* Timestamp-specific: Configuration for last-updated and created-at */}
          {(type === 'last-updated' || type === 'created-at') && (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeTime"
                  checked={includeTime}
                  onCheckedChange={(checked) => setIncludeTime(checked as boolean)}
                />
                <Label htmlFor="includeTime" className="text-sm font-normal cursor-pointer">
                  Include time (not just date)
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {type === 'created-at'
                  ? "Automatically set when row is created"
                  : "Automatically updated when row is modified"}
              </p>
              <div className="text-sm text-amber-600 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>This field is read-only and automatically managed by the system</span>
              </div>
            </div>
          )}

          {/* Single-Select-specific: Options configuration */}
          {type === 'single-select' && (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <SelectOptionsManager
                options={selectOptions}
                onChange={setSelectOptions}
                defaultOption={defaultSelectOption}
                onDefaultChange={setDefaultSelectOption}
                showDefaultSelector={true}
              />
            </div>
          )}

          {/* Multi-Select-specific: Options configuration */}
          {type === 'multi-select' && (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <SelectOptionsManager
                options={selectOptions}
                onChange={setSelectOptions}
              />
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="maxSelections">Maximum Selections (optional)</Label>
                <Input
                  id="maxSelections"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={maxSelections || ""}
                  onChange={(e) => setMaxSelections(e.target.value ? parseInt(e.target.value) : undefined)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for unlimited selections
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name || !type || loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
