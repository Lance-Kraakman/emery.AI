"use client"

import { useForm } from '@tanstack/react-form'
import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { createDatabase } from "@/app/actions/databases"

interface CreateDatabaseDialogProps {
  isOpen: boolean
  onClose: () => void
  onDatabaseCreated: () => void
}

export function CreateDatabaseDialog({ isOpen, onClose, onDatabaseCreated }: CreateDatabaseDialogProps) {
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
    },
    onSubmit: async ({ value }) => {
      try {
        setError(null)
        
        const result = await createDatabase({
          name: value.name.trim(),
          description: value.description.trim() || undefined,
        })

        if (result.success) {
          form.reset()
          onDatabaseCreated()
          onClose()
        } else {
          setError(result.error || "Failed to create database")
        }
      } catch (err) {
        setError("Failed to create database")
      }
    }
  })

  const handleClose = () => {
    if (!form.state.isSubmitting) {
      form.reset()
      setError(null)
      onClose()
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Database</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }} className="space-y-4">
          <form.Field 
            name="name"
            validators={{
              onChange: ({ value }) => !value.trim() ? 'Database name is required' : undefined,
            }}
          >
            {(field) => (
              <div>
                <Label htmlFor="name">Database Name *</Label>
                <Input
                  id="name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Enter database name..."
                  disabled={form.state.isSubmitting}
                  autoFocus
                />
                {field.state.meta.errors.length > 0 && (
                  <div className="text-sm text-destructive mt-1">
                    {field.state.meta.errors[0]}
                  </div>
                )}
              </div>
            )}
          </form.Field>
          
          <form.Field name="description">
            {(field) => (
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Describe what this database will contain..."
                  disabled={form.state.isSubmitting}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This description will be indexed for AI search and understanding.
                </p>
              </div>
            )}
          </form.Field>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={form.state.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.state.isSubmitting}>
              {form.state.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Database
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}