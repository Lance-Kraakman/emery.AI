'use client'

import { useSearchParams } from 'next/navigation'
import {
  ChatCanvas,
  ChatInput,
  ChatMessages,
  ChatSection,
  useChatCanvas,
} from '@llamaindex/chat-ui'
import { X, Code, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatRSC } from './use-chat-rsc'
import MissionControlDashboardContent from './dashboard-content'

// Save/Revert Actions Component - separate from other actions
function SaveRevertActions() {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="default"
        size="sm"
        className="h-8 px-3"
        title="Save changes"
        onClick={() => {
          // Handle save action
          console.log('Save clicked')
        }}
      >
        Save
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-3"
        title="Revert changes"
        onClick={() => {
          // Handle revert action
          console.log('Revert clicked')
        }}
      >
        Revert
      </Button>
    </div>
  )
}

// Custom Canvas Component
function CustomCanvas() {
  const { currentArtifact, isVisible, hideCanvas } = useChatCanvas() as any

  if (!isVisible || !currentArtifact) {
    return (
      <ChatCanvas className="hidden md:flex md:w-1/2 bg-card border border-border rounded-lg shadow-sm" />
    )
  }

  return (
    <div className="hidden md:flex md:w-1/2 bg-card border border-border rounded-lg shadow-sm flex-col min-h-0">
      {/* Custom header with artifact details */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/50 rounded-t-lg">
        <div>
          <h2 className="font-semibold text-foreground">
            {currentArtifact.title ||
              (currentArtifact.type === 'code'
                ? currentArtifact.data.file_name
                : 'Document')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {currentArtifact.type === 'code' ? (
              <span className="flex items-center gap-1">
                <Code className="h-3 w-3" />
                {currentArtifact.data.language} • Code Editor
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Markdown Document
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <SaveRevertActions />
          <Button
            variant="ghost"
            size="sm"
            onClick={hideCanvas}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas content area - this is where editing happens */}
      <div className="flex-1 overflow-hidden relative">
        <ChatCanvas className="h-full w-full rounded-none border-0" />
      </div>

      {/* Custom footer */}
      <div className="border-t border-border bg-secondary/30 p-3 rounded-b-lg">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {currentArtifact.type === 'code'
              ? `${currentArtifact.data.language} • ${
                  currentArtifact.data.file_name || 'Untitled'
                }`
              : 'Markdown Document'}
          </span>
          <span>Last modified: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  )
}

export default function Page(): JSX.Element {
  const searchParams = useSearchParams()
  const tableId = searchParams.get('tableId')
  
  // If there's a tableId or other dashboard params, show the dashboard content
  if (tableId) {
    return <MissionControlDashboardContent />
  }
  
  // Otherwise show the AI chat interface
  return <CustomChat />
}

function CustomChat() {
  const handler = useChatRSC()

  return (
    <div className="flex h-screen flex-col">
      <ChatSection
        handler={handler}
        className="flex flex-1 justify-center overflow-hidden min-h-0 bg-background"
      >
        {/* ChatGPT-style centered container */}
        <div className="flex flex-col min-h-0 w-full max-w-4xl">
          {/* Fixed header */}
          <div className="flex-shrink-0 flex justify-center border-b border-border bg-background p-6">
            <div className="text-center">
              <h1 className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-2xl font-bold text-transparent">
                Mission Control
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                AI-powered organizational intelligence and analysis
              </p>
            </div>
          </div>
          
          {/* Scrollable chat area with fixed input */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Messages area - scrollable with auto-scroll */}
            <div 
              ref={handler.scrollRef}
              className="flex-1 overflow-y-auto min-h-0 px-4"
            >
              <div className="max-w-3xl mx-auto py-4">
                <ChatMessages className="space-y-4" />
              </div>
            </div>
            
            {/* Input area - fixed at bottom */}
            <div className="flex-shrink-0 border-t border-border bg-background/80 backdrop-blur-sm p-4">
              <div className="max-w-3xl mx-auto">
                <ChatInput />
              </div>
            </div>
          </div>
        </div>
        
        {/* Canvas stays on the right */}
        <CustomCanvas />
      </ChatSection>
    </div>
  )
}
