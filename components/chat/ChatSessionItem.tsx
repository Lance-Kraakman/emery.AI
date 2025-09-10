'use client'

/**
 * ChatSessionItem Component
 * 
 * Individual chat session item for the chat history panel.
 * Displays chat metadata and handles session switching.
 */

import { useState } from 'react'
import { MoreHorizontal, MessageSquare, Calendar, Archive, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ChatSessionDTO } from '@/app/mappers/chat-mapper'
import { archiveChatSession } from '@/app/actions/chat-history'

interface ChatSessionItemProps {
  session: ChatSessionDTO
  isActive: boolean
  onClick: (sessionId: string) => void
  onArchive?: (sessionId: string) => void
}

export function ChatSessionItem({ session, isActive, onClick, onArchive }: ChatSessionItemProps) {
  const [isArchiving, setIsArchiving] = useState(false)

  const handleArchive = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (isArchiving) return
    
    setIsArchiving(true)
    try {
      const result = await archiveChatSession(session.id)
      if (result.success) {
        onArchive?.(session.id)
      } else {
        console.error('Failed to archive chat:', result.error)
      }
    } catch (error) {
      console.error('Failed to archive chat:', error)
    } finally {
      setIsArchiving(false)
    }
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = diff / (1000 * 60 * 60)
    const days = diff / (1000 * 60 * 60 * 24)

    if (hours < 1) {
      return 'Just now'
    } else if (hours < 24) {
      return `${Math.floor(hours)}h ago`
    } else if (days < 7) {
      return `${Math.floor(days)}d ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const getDomainIcon = () => {
    const contextType = session.contextMetadata?.contextType
    switch (contextType) {
      case 'agents':
        return '🤖'
      case 'tables':
        return '📊'
      case 'teams':
        return '👥'
      case 'files':
        return '📁'
      default:
        return '💬'
    }
  }

  const getDomainLabel = () => {
    const metadata = session.contextMetadata
    if (metadata?.domainSchema?.name) {
      return `${metadata.contextType}: ${metadata.domainSchema.name}`
    }
    return metadata?.contextType || 'General'
  }

  return (
    <div
      className={`group relative flex flex-col p-3 cursor-pointer transition-colors duration-200 border-b border-border/30 last:border-b-0 ${
        isActive 
          ? 'bg-accent/20 border-l-2 border-l-accent' 
          : 'hover:bg-muted/50'
      }`}
      onClick={() => onClick(session.id)}
    >
      {/* Main content */}
      <div className="flex items-start gap-2 min-w-0">
        {/* Domain icon */}
        <div className="flex-shrink-0 text-lg mt-0.5">
          {getDomainIcon()}
        </div>
        
        {/* Chat info */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="font-medium text-sm text-foreground truncate mb-1">
            {session.title}
          </div>
          
          {/* Domain context */}
          <div className="text-xs text-muted-foreground mb-1">
            {getDomainLabel()}
          </div>
          
          {/* Metadata row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {session.messageCount}
            </div>
            
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {session.lastMessageAt 
                ? formatDate(new Date(session.lastMessageAt))
                : formatDate(new Date(session.createdAt))
              }
            </div>
          </div>
        </div>

        {/* Actions dropdown */}
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={handleArchive}
                disabled={isArchiving}
                className="text-muted-foreground"
              >
                <Archive className="h-4 w-4 mr-2" />
                {isArchiving ? 'Archiving...' : 'Archive'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Description if available */}
      {session.description && (
        <div className="text-xs text-muted-foreground mt-1 pl-8 truncate">
          {session.description}
        </div>
      )}
      
      {/* Active indicator */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />
      )}
    </div>
  )
}