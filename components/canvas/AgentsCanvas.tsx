'use client'

import { BaseCanvas } from './BaseCanvas'
import { Bot, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * AgentsCanvas - Canvas for Agents management page
 * 
 * Features:
 * - Agent listing and management
 * - Agent creation and configuration
 * - Performance monitoring
 * 
 * AIDEV-NOTE: Agents page canvas for managing AI agents.
 */

interface AgentsCanvasProps {
  agentId?: string
  children?: React.ReactNode
}

export function AgentsCanvas({ agentId, children }: AgentsCanvasProps) {
  const title = agentId ? `Agent Configuration` : 'AI Agents'
  const subtitle = agentId ? `Configure agent ${agentId}` : 'Manage and monitor your AI agents'

  return (
    <BaseCanvas
      title={title}
      subtitle={subtitle}
      icon={<Bot className="h-5 w-5" />}
      headerActions={
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Agent
        </Button>
      }
    >
      <div className="h-full flex flex-col overflow-hidden">
        {children || (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No agents configured</h3>
              <p className="text-muted-foreground mb-4">
                Create your first AI agent to get started with automation.
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            </div>
          </div>
        )}
      </div>
    </BaseCanvas>
  )
}