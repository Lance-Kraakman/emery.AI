'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ChatCanvas,
  ChatInput,
  ChatMessages,
  ChatSection,
  useChatCanvas,
} from '@llamaindex/chat-ui'
import { X, Code, FileText, Send, Lightbulb, Database, BarChart, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

function PageContent(): JSX.Element {
  const searchParams = useSearchParams()
  const tableId = searchParams.get('tableId')
  
  // If there's a tableId or other dashboard params, show the dashboard content
  if (tableId) {
    return <DashboardMainContent />
  }
  
  // Otherwise show the AI chat interface
  return <CustomChat />
}

export default function Page(): JSX.Element {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PageContent />
    </Suspense>
  )
}

// Quick Actions / Suggestions Component
function QuickSuggestions({ onSuggestionClick }: { onSuggestionClick: (suggestion: string) => void }) {
  const suggestions = [
    {
      icon: <Database className="h-4 w-4" />,
      title: "Analyze Database Performance",
      description: "Review query performance and optimization opportunities",
      prompt: "Analyze the current database performance and suggest optimizations for our main tables and queries."
    },
    {
      icon: <BarChart className="h-4 w-4" />,
      title: "Generate Analytics Report",
      description: "Create comprehensive metrics and insights dashboard",
      prompt: "Generate a comprehensive analytics report showing key performance indicators, user engagement metrics, and business trends from our data."
    },
    {
      icon: <Users className="h-4 w-4" />,
      title: "User Behavior Analysis",
      description: "Understand user patterns and engagement",
      prompt: "Analyze user behavior patterns, identify high-value user segments, and suggest strategies to improve user retention and engagement."
    },
    {
      icon: <Code className="h-4 w-4" />,
      title: "Code Review & Architecture",
      description: "Review codebase architecture and best practices",
      prompt: "Perform a code architecture review, identify potential improvements, and suggest best practices for scalability and maintainability."
    }
  ]

  return (
    <div className="px-4 pb-4">
      <div className="mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Lightbulb className="h-4 w-4" />
          Quick Actions
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {suggestions.map((suggestion, index) => (
          <Card
            key={index}
            className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-ring/50 bg-card/50"
            onClick={() => onSuggestionClick(suggestion.prompt)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10 text-primary">
                  {suggestion.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    {suggestion.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {suggestion.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function CustomChat() {
  const handler = useChatRSC()
  const [showSuggestions, setShowSuggestions] = useState(true)

  const handleSuggestionClick = (suggestion: string) => {
    // This would typically send the suggestion to the chat handler
    console.log('Suggestion clicked:', suggestion)
    setShowSuggestions(false)
    // You might want to programmatically set the input value and submit
    // This depends on how the ChatInput component exposes its API
  }

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
        
        {/* Show suggestions when chat is empty */}
        {showSuggestions && (
          <QuickSuggestions onSuggestionClick={handleSuggestionClick} />
        )}
        
        <ChatInput className="px-4 pb-4">
          <ChatInput.Form className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <ChatInput.Field
                className="w-full resize-none rounded-xl border border-input bg-background p-4 pr-14 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                placeholder="Ask me anything..."
                style={{ background: 'hsl(var(--background))', minHeight: '52px' }}
              />
              <ChatInput.Submit className="absolute right-2 top-1/2 -translate-y-1/2">
                <Button
                  type="submit"
                  size="icon"
                  className="h-8 w-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </ChatInput.Submit>
            </div>
          </ChatInput.Form>
        </ChatInput>
      </div>
      <CustomCanvas />
    </ChatSection>
  )
}
