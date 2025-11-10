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
import type { FieldType } from "@/ddd/domain/tables/value-objects/table-field"
import type { TableDTO } from "@/app/mappers/table-mapper"

interface EditFieldPanelProps {
  field: FieldDTO | null
  isOpen: boolean
  onClose: () => void
  onSave: (field: FieldDTO, updates: Partial<FieldDTO>) => Promise<void>
  availableTables?: TableDTO[]
}

const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
  { value: "relation", label: "Relation" },
  { value: "file", label: "File" },
  { value: "document", label: "Document" },
  { value: "embedding", label: "Embedding" },
]

export function EditFieldPanel({ field, isOpen, onClose, onSave, availableTables = [] }: EditFieldPanelProps) {
  const [name, setName] = useState(field?.name || "")
  const [type, setType] = useState<FieldType | "">(field?.type || "")
  const [required, setRequired] = useState(field?.required || false)
  const [relatedTableId, setRelatedTableId] = useState<number | undefined>(field?.relatedTableId ?? undefined)
  const [embeddingSize, setEmbeddingSize] = useState<number | undefined>()
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

      setShowTypeWarning(false)
    }
  }, [field])

  const handleTypeChange = (newType: FieldType) => {
    if (field && newType !== field.type) {
      setShowTypeWarning(true)
    }
    setType(newType)

    // Clear embedding size if switching away from embedding type
    if (newType !== 'embedding') {
      setEmbeddingSize(undefined)
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
      // Build metadata for embedding fields
      const metadata = type === 'embedding' && embeddingSize ? {
        embeddingSize: embeddingSize.toString()
      } : undefined

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
