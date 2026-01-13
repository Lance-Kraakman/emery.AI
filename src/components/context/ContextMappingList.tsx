'use client'

import { useState } from 'react'
import { Database, Trash2, Lock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AccessModeToggle } from './AccessModeToggle'
import { SyncModeSelector } from './SyncModeSelector'
import type { ContextMappingDTO } from '@/app/actions/context-mappings'
import type { ContextMappingAccessMode, ContextMappingSyncMode } from '@/ddd/domain/context/entities/context-mapping'

interface ContextMappingListProps {
  mappings: ContextMappingDTO[]
  onUpdate: (id: number, data: { accessMode?: ContextMappingAccessMode; syncMode?: ContextMappingSyncMode }) => Promise<void>
  onRemove: (id: number) => Promise<void>
  isLoading?: boolean
}

export function ContextMappingList({
  mappings,
  onUpdate,
  onRemove,
  isLoading = false
}: ContextMappingListProps) {
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)

  const handleUpdate = async (
    id: number,
    data: { accessMode?: ContextMappingAccessMode; syncMode?: ContextMappingSyncMode }
  ) => {
    setUpdatingId(id)
    try {
      await onUpdate(id, data)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleRemove = async (id: number) => {
    setRemovingId(id)
    try {
      await onRemove(id)
    } finally {
      setRemovingId(null)
    }
  }

  if (mappings.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        <Database className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p>No context tables attached</p>
        <p className="text-xs mt-1">Add tables to provide data context for this agent</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {mappings.map((mapping) => (
        <div
          key={mapping.id}
          className={cn(
            'flex items-center gap-3 p-3 rounded-lg border bg-white',
            mapping.isSystem ? 'border-purple-200 bg-purple-50/30' : 'border-gray-200'
          )}
        >
          {/* Table Info */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Database className={cn(
              'h-4 w-4 shrink-0',
              mapping.isSystem ? 'text-purple-500' : 'text-gray-400'
            )} />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-gray-700 truncate">
                  {mapping.tableName}
                </span>
                {mapping.isSystem && (
                  <span title="System table">
                    <Lock className="h-3 w-3 text-purple-500" />
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400">
                {mapping.targetType}
              </div>
            </div>
          </div>

          {/* Access Mode */}
          <div className="shrink-0">
            <AccessModeToggle
              value={mapping.accessMode}
              onChange={(mode) => handleUpdate(mapping.id, { accessMode: mode })}
              disabled={isLoading || updatingId === mapping.id || mapping.isSystem}
              size="sm"
            />
          </div>

          {/* Sync Mode */}
          <div className="w-24 shrink-0">
            <SyncModeSelector
              value={mapping.syncMode}
              onChange={(mode) => handleUpdate(mapping.id, { syncMode: mode })}
              disabled={isLoading || updatingId === mapping.id || mapping.isSystem}
            />
          </div>

          {/* Remove Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRemove(mapping.id)}
            disabled={isLoading || removingId === mapping.id || mapping.isSystem}
            className="shrink-0 h-8 w-8 p-0 text-gray-400 hover:text-red-500"
            title={mapping.isSystem ? 'System tables cannot be removed' : 'Remove table'}
          >
            {removingId === mapping.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      ))}
    </div>
  )
}
