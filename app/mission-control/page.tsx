'use client'

import { useSearchParams } from 'next/navigation'
import {
  ChatCanvas,
  ChatInput,
  ChatMessages,
  ChatSection,
  useChatCanvas,
} from '@llamaindex/chat-ui'
import { X, Code, FileText, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatRSC } from './use-chat-rsc'
import DashboardMainContent from '../components/DashboardMainContent'

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
      <ChatCanvas className="w-full md:w-2/3" />
    )
  }

  return (
    <div className="w-full md:w-2/3 border border-border rounded-lg shadow-sm flex flex-col">
      {/* Custom header with artifact details */}
      <div className="flex items-center justify-between p-4 border-b border-border rounded-t-lg">
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
    return <DashboardMainContent />
  }
  
  // Otherwise show the AI chat interface
  return <CustomChat />
}

function CustomChat() {
  const handler = useChatRSC()

  return (
    <ChatSection
      handler={handler}
      className="block h-screen flex-row gap-4 p-0 md:flex md:p-5"
    >
      <div className="flex min-w-0 max-w-4xl mx-auto flex-1 flex-col gap-4">
        <div className="flex justify-between gap-2 border-b p-4">
          <div>
            <h1 className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-lg font-bold text-transparent">
              Mission Control
            </h1>
            <p className="text-sm text-muted-foreground">
              AI-powered organizational intelligence and analysis
            </p>
          </div>
        </div>
        <ChatMessages className="flex-1 min-h-0 overflow-y-auto bg-transparent" />
        <ChatInput className="px-4 pb-4">
          <ChatInput.Form className="flex items-center gap-3">
            <ChatInput.Field
              className="flex-1 border-none bg-gray-50 rounded-lg px-4 py-2"
              placeholder="Ask me anything..."
            />
            <ChatInput.Submit className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2">
              <Send className="h-4 w-4" />
            </ChatInput.Submit>
          </ChatInput.Form>
        </ChatInput>
      </div>
      <CustomCanvas />
    </ChatSection>
  )
}
