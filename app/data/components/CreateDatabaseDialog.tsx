"use client"

import { useState } from "react"
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
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError("Database name is required")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await createDatabase({
        name: name.trim(),
        description: description.trim() || undefined,
      })

      if (result.success) {
        setName("")
        setDescription("")
        onDatabaseCreated()
        onClose()
      } else {
        setError(result.error || "Failed to create database")
      }
    } catch (err) {
      setError("Failed to create database")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setName("")
      setDescription("")
      setError(null)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Database</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Database Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter database name..."
              disabled={isLoading}
              autoFocus
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this database will contain..."
              disabled={isLoading}
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              This description will be indexed for AI search and understanding.
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Database
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}