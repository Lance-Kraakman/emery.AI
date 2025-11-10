'use client'

/**
 * ChatHistoryDropdown Component
 * 
 * Header-based dropdown for chat history that's space-efficient and mobile-friendly.
 * Replaces the sidebar panel with a cleaner dropdown approach.
 */

import React, { useState, useEffect } from 'react'
import { History, Plus, Search, MoreHorizontal, Archive, MessageSquare, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getChatSessions, createNewChatSession, archiveChatSession } from '@/app/actions/chat-history'
import type { ChatSessionDTO, ChatContextDTO } from '@/app/mappers/chat-mapper'
import type { DomainType } from '@/ddd/domain/shared/types/domain-type'

interface ChatHistoryDropdownProps {
  currentChatId?: string
  onChatSelect: (chatId: string) => void
  onNewChat: () => void
  onChatHistoryUpdate?: () => void // Callback to notify parent of changes
  
  // Context for filtering chats
  domainType?: DomainType | 'organizations' | 'general'
  domainId?: number
  domainName?: string
  userId: string
  organizationId: number
}

interface ChatItemProps {
  session: ChatSessionDTO
  isActive: boolean
  onClick: (sessionId: string) => void
  onArchive?: (sessionId: string) => void
}

function ChatItem({ session, isActive, onClick, onArchive }: ChatItemProps) {
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

    if (hours < 1) return 'Just now'
    if (hours < 24) return `${Math.floor(hours)}h ago`
    if (days < 7) return `${Math.floor(days)}d ago`
    return date.toLocaleDateString()
  }

  const getDomainIcon = () => {
    const contextType = session.contextMetadata?.contextType
    switch (contextType) {
      case 'agents': return '🤖'
      case 'tables': return '📊'
      case 'teams': return '👥'
      case 'files': return '📁'
      default: return '💬'
    }
  }

  return (
    <div
      className={`flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer text-sm ${
        isActive ? 'bg-accent/20' : ''
      }`}
      onClick={() => onClick(session.id)}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-base">{getDomainIcon()}</span>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="font-medium truncate">{session.title}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleArchive}
        disabled={isArchiving}
        className="h-6 w-6 opacity-0 group-hover:opacity-100"
      >
        <Archive className="h-3 w-3" />
      </Button>
    </div>
  )
}

export function ChatHistoryDropdown({
  currentChatId,
  onChatSelect,
  onNewChat,
  onChatHistoryUpdate,
  domainType,
  domainId,
  domainName,
  userId,
  organizationId
}: ChatHistoryDropdownProps) {
  const [sessions, setSessions] = useState<ChatSessionDTO[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // Load chat sessions for current context
  const loadChatSessions = async () => {
    try {
      setIsLoading(true)
      
      const context: ChatContextDTO = {
        domainType: domainType === 'general' ? undefined : domainType,
        domainId,
        organizationId,
        userId,
        limit: 20 // Reduced for dropdown
      }

      const result = await getChatSessions(context)
      
      if (result.success && result.data) {
        setSessions(result.data)
        // Don't call onChatHistoryUpdate here as it causes infinite loop
        // onChatHistoryUpdate?.() // Notify parent
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load sessions when context changes or when explicitly refreshed
  useEffect(() => {
    if (isOpen) {
      loadChatSessions()
    }
  }, [domainType, domainId, organizationId, userId, isOpen])

  // Public method to refresh from parent
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).refreshChatHistory = loadChatSessions
    }
  }, [])

  // Handle creating new chat
  const handleNewChat = async () => {
    try {
      setIsCreatingNew(true)
      setIsOpen(false)
      
      // Create new chat via Server Action (for history tracking)
      const result = await createNewChatSession({
        domainType: domainType === 'general' ? undefined : domainType,
        domainId,
        domainName,
        organizationId,
        userId
      })

      if (result.success && result.data) {
        // Add new session to the list
        setSessions([result.data, ...sessions])
        // Switch to new chat
        onChatSelect(result.data.id)
        // Refresh the list
        await loadChatSessions()
      }
      
      onNewChat()
    } catch (error) {
      console.error('Failed to create new chat:', error)
      // Still call onNewChat to clear current chat
      onNewChat()
    } finally {
      setIsCreatingNew(false)
    }
  }

  // Handle archiving a chat
  const handleArchiveChat = (sessionId: string) => {
    setSessions(sessions.filter(s => s.id !== sessionId))
    if (currentChatId === sessionId) {
      onNewChat()
    }
  }

  // Filter sessions based on search query
  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeChatTitle = sessions.find(s => s.id === currentChatId)?.title

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">
            {activeChatTitle ? `${activeChatTitle.substring(0, 20)}${activeChatTitle.length > 20 ? '...' : ''}` : 'Chat History'}
          </span>
          <span className="sm:hidden">History</span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        className="w-80 p-0" 
        align="start" 
        side="bottom"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-medium text-sm">Chat History</div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewChat}
            disabled={isCreatingNew}
            className="h-6 w-6"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-7 text-sm"
            />
          </div>
        </div>

        {/* Chat List */}
        <ScrollArea className="h-80">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-4 text-center">
              {searchQuery ? (
                <p className="text-sm text-muted-foreground">
                  No chats match "{searchQuery}"
                </p>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2">No chat history yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNewChat}
                    disabled={isCreatingNew}
                    className="text-xs"
                  >
                    Start your first chat
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-1">
              {filteredSessions.map((session) => (
                <div key={session.id} className="group">
                  <ChatItem
                    session={session}
                    isActive={session.id === currentChatId}
                    onClick={(chatId) => {
                      onChatSelect(chatId)
                      setIsOpen(false)
                    }}
                    onArchive={handleArchiveChat}
                  />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}