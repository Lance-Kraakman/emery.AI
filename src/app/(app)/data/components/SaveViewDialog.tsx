"use client"

/**
 * SaveViewDialog - Quick save current filter/sort state as a view
 *
 * AIDEV-NOTE: Lightweight dialog for creating views from current grid state.
 * Captures filters and sorting from props, only asks user for name.
 */

import { useForm } from '@tanstack/react-form'
import React, { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, Filter, ArrowUpDown } from "lucide-react"
import { createView } from "@/app/actions/views"
import { ViewType } from "@/ddd/domain/views/value-objects/view-type"
import { ViewConfig } from "@/ddd/domain/views/value-objects/view-config"
import { toast } from "sonner"
import type { FieldDTO } from "@/app/mappers/field-mapper"
import type { ViewDTO } from "@/app/mappers/view-mapper"
import type { FilterConfig } from "@/lib/types/filters"

interface SaveViewDialogProps {
  isOpen: boolean
  onClose: () => void
  tableId: number
  fields: FieldDTO[]
  activeFilters: FilterConfig[]
  sortState?: { field?: string; order?: 'asc' | 'desc' }
  onSuccess?: (view: ViewDTO) => void
}

export function SaveViewDialog({
  isOpen,
  onClose,
  tableId,
  fields,
  activeFilters,
  sortState,
  onSuccess,
}: SaveViewDialogProps) {
  const [error, setError] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)

  const form = useForm({
    defaultValues: {
      viewName: '',
      description: '',
    },
    onSubmit: async ({ value }) => {
      try {
        setError('')

        // Build sorting configuration
        const sorting = sortState?.field && sortState?.order ? [{
          fieldId: fields.find(f => f.name === sortState.field)?.id || 0,
          direction: sortState.order,
          priority: 0
        }] : []

        const result = await createView({
          tableId,
          name: value.viewName.trim(),
          description: value.description.trim() || undefined,
          filters: activeFilters as Array<{
            field: string;
            operator: string;
            value: string | number | boolean | null;
          }>,
          sorting,
          viewType: ViewType.grid(),
          viewConfig: ViewConfig.createGrid({ defaultPageSize: 50 })
        }, '/data') // Revalidate to refresh data page views

        if (result.success && result.data) {
          toast.success("View created successfully")
          form.reset()
          onClose()
          onSuccess?.(result.data)
        } else {
          setError(result.error || "Failed to create view")
        }
      } catch (error) {
        console.error("Failed to create view:", error)
        setError("Failed to create view")
      }
    }
  })

  const handleClose = () => {
    if (!form.state.isSubmitting) {
      form.reset()
      setError("")
      setShowAdvanced(false)
      onClose()
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose()
    }
  }

  // Count what will be saved
  const filterCount = activeFilters.length
  const hasSorting = !!(sortState?.field && sortState?.order)

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Current View</DialogTitle>
          <DialogDescription>
            Save the current filter and sorting configuration as a view
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          {/* View Name */}
          <form.Field name="viewName">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="viewName">
                  View Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="viewName"
                  placeholder="My Filtered View"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={form.state.isSubmitting}
                  autoFocus
                />
              </div>
            )}
          </form.Field>

          {/* Preview of what will be saved */}
          <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
            <div className="text-sm font-medium">What will be saved:</div>
            <div className="space-y-1 text-sm">
              {filterCount > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Filter className="h-3 w-3" />
                  <span>{filterCount} filter{filterCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {hasSorting && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ArrowUpDown className="h-3 w-3" />
                  <span>Sort by {sortState.field} ({sortState.order})</span>
                </div>
              )}
              {!filterCount && !hasSorting && (
                <div className="text-muted-foreground">No filters or sorting applied</div>
              )}
            </div>
          </div>

          {/* Advanced: Description */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
              <span>Advanced options</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <form.Field name="description">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe this view..."
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      disabled={form.state.isSubmitting}
                      rows={3}
                    />
                  </div>
                )}
              </form.Field>
            </CollapsibleContent>
          </Collapsible>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={form.state.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.state.isSubmitting || !form.state.values.viewName.trim()}
            >
              {form.state.isSubmitting ? "Saving..." : "Save View"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
