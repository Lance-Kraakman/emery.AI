"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createTable } from "@/app/actions/tables"
import { useEmeryData } from "@/hooks/useEmeryData"

interface CreateTableDialogProps {
  isOpen: boolean
  onClose: () => void
  onTableCreated: () => void
  selectedDatabaseId?: number
}

export function CreateTableDialog({ isOpen, onClose, onTableCreated, selectedDatabaseId }: CreateTableDialogProps) {
  const { data } = useEmeryData()
  const [tableName, setTableName] = useState("")
  const [description, setDescription] = useState("")
  const [databaseId, setDatabaseId] = useState<string>(selectedDatabaseId?.toString() || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!tableName.trim()) {
      setError("Table name is required")
      return
    }

    if (!databaseId && data.databases.length === 0) {
      setError("Please create a database first")
      return
    }

    try {
      setLoading(true)
      setError("")
      
      const result = await createTable({ 
        name: tableName.trim(),
        databaseId: databaseId ? parseInt(databaseId) : undefined,
        description: description.trim() || undefined
      })
      
      if (result.success) {
        setTableName("")
        setDescription("")
        setDatabaseId("")
        onTableCreated()
        onClose()
      } else {
        setError(result.error || "Failed to create table")
      }
    } catch (error) {
      console.error("Failed to create table:", error)
      setError("Failed to create table")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setTableName("")
      setDescription("")
      setDatabaseId("")
      setError("")
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Table</DialogTitle>
          <DialogDescription>
            Create a new table to store your data. You can add fields after creation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="databaseId">Database</Label>
              <Select value={databaseId} onValueChange={setDatabaseId} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder={data.databases.length === 0 ? "No databases available" : "Select a database..."} />
                </SelectTrigger>
                <SelectContent>
                  {data.databases.map((db) => (
                    <SelectItem key={db.id} value={db.id.toString()}>
                      {db.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tableName">Table Name *</Label>
              <Input
                id="tableName"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="Enter table name..."
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this table will store..."
                disabled={loading}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                This description will be indexed for AI search and understanding.
              </p>
            </div>
            
            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !tableName.trim()}
            >
              {loading ? "Creating..." : "Create Table"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}