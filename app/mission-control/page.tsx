'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ChatCanvas,
  ChatInput,
  ChatMessages,
  ChatSection,
  useChatCanvas,
} from '@llamaindex/chat-ui'
import { X, Code, FileText, Send, Database, BarChart, Users, Lightbulb } from 'lucide-react'
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

// Compact Suggestions Component
function CompactSuggestions({ 
  onSuggestionClick, 
  selectedIndex = -1 
}: { 
  onSuggestionClick: (suggestion: string) => void;
  selectedIndex?: number;
}) {
  const suggestions = [
    {
      icon: <Database className="h-3 w-3" />,
      title: "Analyze database performance and optimization opportunities",
      prompt: "Analyze the current database performance and suggest optimizations for our main tables and queries."
    },
    {
      icon: <BarChart className="h-3 w-3" />,
      title: "Generate comprehensive analytics report with KPIs and trends",
      prompt: "Generate a comprehensive analytics report showing key performance indicators, user engagement metrics, and business trends from our data."
    },
    {
      icon: <Users className="h-3 w-3" />,
      title: "Analyze user behavior patterns and engagement strategies",
      prompt: "Analyze user behavior patterns, identify high-value user segments, and suggest strategies to improve user retention and engagement."
    },
    {
      icon: <Code className="h-3 w-3" />,
      title: "Review code architecture and suggest best practices",
      prompt: "Perform a code architecture review, identify potential improvements, and suggest best practices for scalability and maintainability."
    }
  ]

  return (
    <div className="px-4">
      <div className="mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Lightbulb className="h-3 w-3" />
          Suggestions
        </div>
      </div>
      <div>
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            className={`w-full flex items-center gap-2 px-0 py-2.5 text-left text-sm transition-colors duration-150 focus:outline-none border-b border-border/30 last:border-b-0 ${
              selectedIndex === index 
                ? 'bg-muted/70 text-foreground' 
                : 'hover:bg-muted/50'
            }`}
            onClick={() => onSuggestionClick(suggestion.prompt)}
          >
            <div className="flex-shrink-0 text-muted-foreground">
              {suggestion.icon}
            </div>
            <span className="flex-1 text-foreground truncate">
              {suggestion.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function CustomChat() {
  const handler = useChatRSC()
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)

  // Force textarea height to stay at 32px
  useEffect(() => {
    const forceHeight = () => {
      const textareas = document.querySelectorAll('[data-llamaindex-chat-input] textarea')
      textareas.forEach(textarea => {
        textarea.style.height = '32px'
        textarea.style.minHeight = '32px'
        textarea.style.maxHeight = '32px'
      })
    }

    // Force height on any DOM changes
    const observer = new MutationObserver(forceHeight)
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['style']
    })

    // Force height on input events
    const handleInput = (e: Event) => {
      const target = e.target as HTMLTextAreaElement
      if (target.matches('[data-llamaindex-chat-input] textarea')) {
        target.style.height = '32px'
      }
    }

    document.addEventListener('input', handleInput)
    
    // Initial force
    forceHeight()
    
    return () => {
      observer.disconnect()
      document.removeEventListener('input', handleInput)
    }
  }, [])
  
  const suggestions = [
    "Analyze the current database performance and suggest optimizations for our main tables and queries.",
    "Generate a comprehensive analytics report showing key performance indicators, user engagement metrics, and business trends from our data.",
    "Analyze user behavior patterns, identify high-value user segments, and suggest strategies to improve user retention and engagement.",
    "Perform a code architecture review, identify potential improvements, and suggest best practices for scalability and maintainability."
  ]

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return
    
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => {
        if (prev === -1) return suggestions.length - 1 // Start at bottom/last item
        return prev > 0 ? prev - 1 : suggestions.length - 1 // Go up, wrap to bottom
      })
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => {
        if (prev === -1) return 0 // Start at top/first item
        return prev < suggestions.length - 1 ? prev + 1 : 0 // Go down, wrap to top
      })
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault()
      handleSuggestionClick(suggestions[selectedSuggestionIndex])
    } else if (e.key === 'Escape') {
      setSelectedSuggestionIndex(-1)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    console.log('Suggestion clicked:', suggestion)
    setSelectedSuggestionIndex(-1)
    // Keep suggestions visible for now
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
        
        {showSuggestions && (
          <CompactSuggestions 
            onSuggestionClick={handleSuggestionClick} 
            selectedIndex={selectedSuggestionIndex}
          />
        )}
        <div onKeyDown={handleKeyDown}>
          <ChatInput className="px-4 pb-4 bg-transparent border-0 shadow-none">
            <ChatInput.Form className="relative flex items-center gap-2 bg-transparent">
              <div className="relative flex-1">
                <ChatInput.Field
                  className="w-full resize-none rounded-xl border border-input bg-background py-1 px-4 pr-14 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                  placeholder="Ask me anything..."
                  rows={1}
                />
                <ChatInput.Submit className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                  <Send className="h-4 w-4" />
                </ChatInput.Submit>
              </div>
            </ChatInput.Form>
          </ChatInput>
        </div>
      </div>
      <CustomCanvas />
    </ChatSection>
  )
}
