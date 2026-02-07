'use client'

/**
 * ChatHistoryPanel Component
 * 
 * Collapsible sidebar panel that shows chat history for the current context.
 * Allows users to switch between previous chats and create new ones.
 */

import React, { useState, useEffect } from 'react'
import { Plus, Search, ChevronLeft, ChevronRight, History, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatSessionItem } from './ChatSessionItem'
import { getChatSessions, createNewChatSession } from '@/app/actions/chat-history'
import type { ChatSessionDTO, ChatContextDTO } from '@/app/mappers/chat-mapper'
import { CHAT_COLLAPSED_WIDTH, CHAT_HISTORY_EXPANDED_WIDTH } from './EmeryChat'

interface ChatHistoryPanelProps {
  isCollapsed: boolean
  onToggle: () => void
  currentChatId?: string
  onChatSelect: (chatId: string) => void
  onNewChat: () => void

  userId: string
  organizationId: number
}

export function ChatHistoryPanel({
  isCollapsed,
  onToggle,
  currentChatId,
  onChatSelect,
  onNewChat,
  userId,
  organizationId
}: ChatHistoryPanelProps) {
  const [sessions, setSessions] = useState<ChatSessionDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Load chat sessions for current context
  const loadChatSessions = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const context: ChatContextDTO = {
        organizationId,
        userId,
        limit: 50
      }

      const result = await getChatSessions(context)
      
      if (result.success && result.data) {
        setSessions(result.data)
      } else {
        setError(result.error || 'Failed to load chat sessions')
        setSessions([])
      }
    } catch (err) {
      console.error('Failed to load chat sessions:', err)
      setError('Failed to load chat sessions')
      setSessions([])
    } finally {
      setIsLoading(false)
    }
  }

  // Load sessions when context changes
  useEffect(() => {
    loadChatSessions()
  }, [organizationId, userId])

  // Handle creating new chat
  const handleNewChat = async () => {
    try {
      setIsCreatingNew(true)
      
      const result = await createNewChatSession({
        organizationId,
        userId
      })

      if (result.success && result.data) {
        // Add new session to the list
        setSessions([result.data, ...sessions])
        // Switch to new chat
        onChatSelect(result.data.id)
        onNewChat()
      } else {
        console.error('Failed to create new chat:', result.error)
      }
    } catch (error) {
      console.error('Failed to create new chat:', error)
    } finally {
      setIsCreatingNew(false)
    }
  }

  // Handle archiving a chat
  const handleArchiveChat = (sessionId: string) => {
    setSessions(sessions.filter(s => s.id !== sessionId))
    // If the archived chat was active, trigger new chat creation
    if (currentChatId === sessionId) {
      onNewChat()
    }
  }

  // Filter sessions based on search query
  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )


  // Collapsed view
  if (isCollapsed) {
    return (
      <div className={`${CHAT_COLLAPSED_WIDTH} h-full flex flex-col bg-card border-r border-border`}>
        <div className="p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8"
            title="Expand chat history"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <History className="h-5 w-5 text-muted-foreground mb-2" />
          <div className="text-xs text-muted-foreground -rotate-90 whitespace-nowrap">
            History
          </div>
        </div>
      </div>
    )
  }

  // Expanded view
  return (
    <div className={`${CHAT_HISTORY_EXPANDED_WIDTH} h-full flex flex-col bg-card border-r border-border`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <History className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate">Chat History</h3>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewChat}
            disabled={isCreatingNew}
            className="h-7 w-7"
            title="New chat"
          >
            {isCreatingNew ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-7 w-7"
            title="Collapse history"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
      </div>

      {/* Chat list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-sm text-red-500 mb-2">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={loadChatSessions}
              className="text-xs"
            >
              Retry
            </Button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-8 text-center">
            {searchQuery ? (
              <p className="text-sm text-muted-foreground">
                No chats match &quot;{searchQuery}&quot;
              </p>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  No chat history yet
                </p>
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
          <div className="py-2">
            {filteredSessions.map((session) => (
              <ChatSessionItem
                key={session.id}
                session={session}
                isActive={session.id === currentChatId}
                onClick={onChatSelect}
                onArchive={handleArchiveChat}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}