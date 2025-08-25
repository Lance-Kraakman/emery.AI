'use client'

import { MessageCircle, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLayout } from './LayoutProvider'
import type { DomainType } from '@/ddd/domain/chat/entities/chat'

/**
 * EmeryChat - Chat panel placeholder component
 * 
 * Provides the basic structure for the chat panel that will be expanded in Phase 2.
 * Currently shows context information and panel controls.
 * 
 * AIDEV-NOTE: Placeholder chat component for Phase 1. Will be replaced with
 * full chat functionality in Phase 2 using domain entities and chat context.
 */

interface ChatHeaderProps {
  domainType?: DomainType | 'organization' | 'general'
  domainName?: string
}

function ChatHeader({ domainType, domainName }: ChatHeaderProps) {
  const { chatState, toggleChat, setChatState } = useLayout()
  
  // Determine header title based on domain context
  const getTitle = () => {
    if (domainType && domainName) {
      switch (domainType) {
        case 'agent': return `Agent: ${domainName}`
        case 'team': return `Team: ${domainName}`
        case 'table': return `Table: ${domainName}`
        case 'workflow': return `Workflow: ${domainName}`
        case 'file': return `File: ${domainName}`
        case 'organization': return 'Organization Assistant'
        default: return 'AI Assistant'
      }
    }
    return 'AI Assistant'
  }

  const getSubtitle = () => {
    if (domainType) {
      switch (domainType) {
        case 'agent': return 'Agent configuration and management'
        case 'team': return 'Team collaboration and insights'
        case 'table': return 'Data queries and analysis'
        case 'workflow': return 'Process optimization'
        case 'file': return 'File processing and analysis'
        case 'organization': return 'General organizational assistance'
        default: return 'General AI assistance'
      }
    }
    return 'How can I help you today?'
  }

  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
      <div className="flex items-center gap-3">
        <MessageCircle className="h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm truncate">{getTitle()}</h3>
          <p className="text-xs text-muted-foreground truncate">{getSubtitle()}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        {chatState === 'expanded' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setChatState('collapsed')}
            className="h-7 w-7"
            title="Collapse chat"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        
        {chatState === 'collapsed' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setChatState('expanded')}
            className="h-7 w-7"
            title="Expand chat"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

function ChatPlaceholder({ domainType }: { domainType?: DomainType | 'organization' | 'general' }) {
  const features = getContextFeatures(domainType)
  
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-sm space-y-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <MessageCircle className="h-8 w-8 text-primary" />
        </div>
        
        <div>
          <h4 className="font-medium text-lg mb-2">Chat Coming Soon</h4>
          <p className="text-muted-foreground text-sm">
            Context-aware AI assistance is being built for this page.
          </p>
        </div>

        {features.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Planned Features:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export function EmeryChat() {
  const { chatState, chatContext } = useLayout()
  
  // Don't render if hidden
  if (chatState === 'hidden') {
    return null
  }
  
  // Collapsed state - just show expand button
  if (chatState === 'collapsed') {
    return (
      <div className="w-12 h-full flex flex-col">
        <ChatHeader 
          domainType={chatContext?.domainType}
          domainName={chatContext?.domainName}
        />
        <div className="flex-1" />
      </div>
    )
  }
  
  // Expanded state - show full chat interface
  return (
    <div className="flex flex-col h-full">
      <ChatHeader 
        domainType={chatContext?.domainType}
        domainName={chatContext?.domainName}
      />
      
      <ChatPlaceholder domainType={chatContext?.domainType} />
    </div>
  )
}

// Utility function to get context-specific features
function getContextFeatures(domainType?: DomainType | 'organization' | 'general'): string[] {
  switch (domainType) {
    case 'agent':
      return [
        'Agent configuration help',
        'Capability editing assistance',
        'Task management queries',
        'Performance insights'
      ]
    
    case 'team':
      return [
        'Team structure optimization',
        'Collaboration insights',
        'Member productivity analysis',
        'Workflow recommendations'
      ]
    
    case 'table':
      return [
        'Natural language SQL queries',
        'Data analysis and insights',
        'Field management assistance',
        'Relationship recommendations'
      ]
    
    case 'workflow':
      return [
        'Process optimization suggestions',
        'Bottleneck identification',
        'Automation opportunities',
        'Performance metrics'
      ]
    
    case 'file':
      return [
        'File content analysis',
        'Processing assistance',
        'Metadata extraction',
        'Integration guidance'
      ]
    
    case 'organization':
      return [
        'Organizational insights',
        'Resource optimization',
        'Strategic recommendations',
        'System configuration help'
      ]
    
    default:
      return [
        'General AI assistance',
        'Code generation',
        'Data analysis',
        'Configuration help'
      ]
  }
}