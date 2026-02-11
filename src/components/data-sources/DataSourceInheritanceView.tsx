'use client'

import { Database, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContextMappingDTO } from '@/app/actions/context-mappings'

interface DataSourceInheritanceViewProps {
  agentMappings: ContextMappingDTO[]
  skillMappings?: ContextMappingDTO[]
  stepMappings?: ContextMappingDTO[]
  currentLevel: 'agent' | 'skill' | 'skill_step'
}

function DataSourceBadge({ mapping }: { mapping: ContextMappingDTO }) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs">
      <Database className="h-3 w-3 text-gray-400" />
      <span className="text-gray-700">{mapping.tableName}</span>
      <span className="text-gray-400">({mapping.accessMode})</span>
    </div>
  )
}

export function DataSourceInheritanceView({
  agentMappings,
  skillMappings = [],
  stepMappings = [],
  currentLevel
}: DataSourceInheritanceViewProps) {
  const levels = [
    { key: 'agent', label: 'Agent', mappings: agentMappings },
    { key: 'skill', label: 'Skill', mappings: skillMappings },
    { key: 'skill_step', label: 'Step', mappings: stepMappings }
  ] as const

  // Filter levels based on current level
  const visibleLevels = levels.filter(level => {
    if (currentLevel === 'agent') return level.key === 'agent'
    if (currentLevel === 'skill') return level.key === 'agent' || level.key === 'skill'
    return true
  })

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Data Source Inheritance
      </div>

      <div className="relative">
        {visibleLevels.map((level, index) => (
          <div key={level.key} className="relative">
            {/* Connection line */}
            {index > 0 && (
              <div className="absolute left-3 -top-2 h-4 w-0.5 bg-gray-200" />
            )}

            {/* Level row */}
            <div
              className={cn(
                'flex items-start gap-2 p-2 rounded-md',
                level.key === currentLevel
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-gray-50/50'
              )}
            >
              {/* Level indicator */}
              <div
                className={cn(
                  'flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium shrink-0',
                  level.key === currentLevel
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-200 text-gray-500'
                )}
              >
                {index + 1}
              </div>

              {/* Level content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-1">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      level.key === currentLevel ? 'text-blue-700' : 'text-gray-600'
                    )}
                  >
                    {level.label}
                  </span>
                  {level.key === currentLevel && (
                    <span className="text-xs text-blue-500">(current)</span>
                  )}
                </div>

                {/* Mappings */}
                {level.mappings.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {level.mappings.map((mapping) => (
                      <DataSourceBadge key={mapping.id} mapping={mapping} />
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">No data sources attached</span>
                )}
              </div>
            </div>

            {/* Arrow indicator for inheritance */}
            {index < visibleLevels.length - 1 && (
              <div className="flex items-center justify-start pl-3 py-1">
                <ArrowDown className="h-3 w-3 text-gray-300" />
                <span className="text-xs text-gray-400 ml-1">inherits</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500">
        Lower levels can access tables from higher levels. Step-level mappings override skill-level, which override agent-level.
      </p>
    </div>
  )
}
