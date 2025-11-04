"use client"

import { useState } from "react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus } from "lucide-react"
import type { FieldType } from "@/ddd/domain/tables/value-objects/table-field"
import type { TableDTO } from "@/app/mappers/table-mapper"

interface AddColumnButtonProps {
  onAddColumn: (data: { name: string; type: FieldType; required: boolean; relatedTableId?: number }) => Promise<void>
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
]

export function AddColumnButton({ onAddColumn, availableTables = [] }: AddColumnButtonProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState<FieldType | "">("")
  const [required, setRequired] = useState(false)
  const [relatedTableId, setRelatedTableId] = useState<number>()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!name || !type) return

    setLoading(true)
    try {
      await onAddColumn({
        name,
        type: type as FieldType,
        required,
        relatedTableId: type === 'relation' ? relatedTableId : undefined
      })

      // Reset form
      setName("")
      setType("")
      setRequired(false)
      setRelatedTableId(undefined)
      setOpen(false)
    } catch (error) {
      console.error("Failed to add column:", error)
      alert("Failed to add column")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="h-full w-full flex items-center justify-center hover:bg-accent/50 transition-colors">
          <Plus className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-4">
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Add Column</h3>

          <div className="space-y-2">
            <Label htmlFor="add-name">Field Name</Label>
            <Input
              id="add-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter field name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-type">Field Type</Label>
            <Select value={type} onValueChange={(val) => setType(val as FieldType)}>
              <SelectTrigger id="add-type">
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
          </div>

          {type === 'relation' && (
            <div className="space-y-2">
              <Label htmlFor="add-related-table">Related Table</Label>
              <Select
                value={relatedTableId?.toString()}
                onValueChange={(val) => setRelatedTableId(parseInt(val))}
              >
                <SelectTrigger id="add-related-table">
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

          <div className="flex items-center space-x-2">
            <Checkbox
              id="add-required"
              checked={required}
              onCheckedChange={(checked) => setRequired(checked as boolean)}
            />
            <Label htmlFor="add-required" className="text-sm font-normal cursor-pointer">
              Required field
            </Label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1" onClick={handleSubmit} disabled={!name || !type || loading}>
              {loading ? "Adding..." : "Add Column"}
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
