'use client'

import { cn } from '@/lib/utils'
import type { ContextMappingSyncMode } from '@/ddd/domain/context/entities/context-mapping'

interface SyncModeSelectorProps {
  value: ContextMappingSyncMode
  onChange: (mode: ContextMappingSyncMode) => void
  disabled?: boolean
}

const modes: { value: ContextMappingSyncMode; label: string; description: string }[] = [
  { value: 'on_access', label: 'On Access', description: 'Sync when agent starts execution' },
  { value: 'on_save', label: 'On Save', description: 'Sync when agent finishes execution' },
  { value: 'realtime', label: 'Realtime', description: 'Real-time sync (coming soon)' }
]

export function SyncModeSelector({
  value,
  onChange,
  disabled = false
}: SyncModeSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ContextMappingSyncMode)}
      disabled={disabled}
      className={cn(
        'block w-full rounded-md border border-gray-200 px-2 py-1 text-xs',
        'bg-white text-gray-700',
        'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {modes.map((mode) => (
        <option
          key={mode.value}
          value={mode.value}
          disabled={mode.value === 'realtime'}
        >
          {mode.label}
        </option>
      ))}
    </select>
  )
}
