'use client'

import { cn } from '@/lib/utils'
import type { ContextMappingAccessMode } from '@/ddd/domain/context/entities/context-mapping'

interface AccessModeToggleProps {
  value: ContextMappingAccessMode
  onChange: (mode: ContextMappingAccessMode) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

const modes: { value: ContextMappingAccessMode; label: string; description: string }[] = [
  { value: 'read', label: 'Read', description: 'Can read from table' },
  { value: 'write', label: 'Write', description: 'Can write to table' },
  { value: 'readwrite', label: 'Read/Write', description: 'Full access' }
]

export function AccessModeToggle({
  value,
  onChange,
  disabled = false,
  size = 'sm'
}: AccessModeToggleProps) {
  return (
    <div className="flex rounded-md border border-gray-200 overflow-hidden">
      {modes.map((mode) => (
        <button
          key={mode.value}
          type="button"
          onClick={() => onChange(mode.value)}
          disabled={disabled}
          title={mode.description}
          className={cn(
            'border-r last:border-r-0 transition-colors',
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === mode.value
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'bg-white text-gray-600 hover:bg-gray-50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}
