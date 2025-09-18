"use client"

import { useForm } from '@tanstack/react-form'
import React, { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog"
import { Button } from "@/src/components/ui/button"
import { Input } from "@/src/components/ui/input"
import { Label } from "@/src/components/ui/label"
import { Textarea } from "@/src/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select"
import { createTable } from "@/src/app/actions/tables"
import { useEmery } from "@/src/contexts/EmeryStoreProvider"

interface CreateTableDialogProps {
  isOpen: boolean
  onClose: () => void
  onTableCreated: () => void
  selectedDatabaseId?: number
}

export function CreateTableDialog({ isOpen, onClose, onTableCreated, selectedDatabaseId }: CreateTableDialogProps) {
  const { data } = useEmery()
  const [error, setError] = useState("")

  const form = useForm({
    defaultValues: {
      tableName: '',
      description: '',
      databaseId: selectedDatabaseId?.toString() || '',
    },
    onSubmit: async ({ value }) => {
      try {
        setError('')
        
        const result = await createTable({ 
          name: value.tableName.trim(),
          databaseId: parseInt(value.databaseId),
          description: value.description.trim() || undefined
        })
        
        if (result.success) {
          form.reset()
          onTableCreated()
          onClose()
        } else {
          setError(result.error || "Failed to create table")
        }
      } catch (error) {
        console.error("Failed to create table:", error)
        setError("Failed to create table")
      }
    }
  })

  const handleClose = () => {
    if (!form.state.isSubmitting) {
      form.reset()
      setError("")
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Table</DialogTitle>
          <DialogDescription>
            Create a new table within a database. Tables must belong to a database to organize your data structure.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}>
          <div className="space-y-4 py-4">
            <form.Field 
              name="databaseId"
              validators={{
                onChange: ({ value }) => {
                  if (!value) {
                    return data.databases.length === 0 ? 'Please create a database first' : 'Please select a database'
                  }
                  return undefined
                }
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="databaseId">Database *</Label>
                  <Select value={field.state.value} onValueChange={field.handleChange} disabled={form.state.isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder={data.databases.length === 0 ? "No databases available - create one first" : "Select a database..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {data.databases.map((db) => (
                        <SelectItem key={db.id} value={db.id.toString()}>
                          {db.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.state.meta.errors.length > 0 && (
                    <div className="text-sm text-destructive">
                      {field.state.meta.errors[0]}
                    </div>
                  )}
                </div>
              )}
            </form.Field>
            
            <form.Field 
              name="tableName"
              validators={{
                onChange: ({ value }) => !value.trim() ? 'Table name is required' : undefined,
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="tableName">Table Name *</Label>
                  <Input
                    id="tableName"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter table name..."
                    disabled={form.state.isSubmitting}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <div className="text-sm text-destructive">
                      {field.state.meta.errors[0]}
                    </div>
                  )}
                </div>
              )}
            </form.Field>
            
            <form.Field name="description">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Describe what this table will store..."
                    disabled={form.state.isSubmitting}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    This description will be indexed for AI search and understanding.
                  </p>
                </div>
              )}
            </form.Field>
            
            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}
          </div>

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
              disabled={form.state.isSubmitting}
            >
              {form.state.isSubmitting ? "Creating..." : "Create Table"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}