'use client'

import { BaseCanvas } from './BaseCanvas'
import { Users, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * TeamsCanvas - Canvas for Teams management page
 * 
 * Features:
 * - Team listing and management
 * - Team member management
 * - Collaboration tools
 * 
 * AIDEV-NOTE: Teams page canvas for managing teams and collaboration.
 */

interface TeamsCanvasProps {
  teamId?: string
  teamName?: string
  children?: React.ReactNode
}

export function TeamsCanvas({ teamId, teamName, children }: TeamsCanvasProps) {
  const title = teamId ? (teamName || 'Team Details') : 'Teams'
  const subtitle = teamId ? `Manage team members and collaboration` : 'Organize your team and manage collaboration'

  return (
    <BaseCanvas
      title={title}
      subtitle={subtitle}
      icon={<Users className="h-5 w-5" />}
    >
      <div className="h-full flex flex-col overflow-hidden">
        {children || (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No teams found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first team to start collaborating with others.
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            </div>
          </div>
        )}
      </div>
    </BaseCanvas>
  )
}