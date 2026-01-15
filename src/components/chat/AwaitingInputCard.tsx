'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FileQuestion, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AwaitingInputState } from './types/extended-chat-handler'
import ReactMarkdown from 'react-markdown'

interface AwaitingInputCardProps {
  awaitingInput: AwaitingInputState
  onRespond: (response: string) => void
  disabled?: boolean
}

/**
 * AwaitingInputCard - Keyboard-driven HITL UI for plan approval and questions
 *
 * AIDEV-NOTE: Claude Code-style UI with keyboard navigation:
 * - Arrow Up/Down to navigate between options
 * - Enter to select highlighted option
 * - Start typing to auto-focus input for custom feedback
 * - Input Enter to send feedback
 */
export function AwaitingInputCard({
  awaitingInput,
  onRespond,
  disabled = false
}: AwaitingInputCardProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [customInput, setCustomInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [batchedAnswers, setBatchedAnswers] = useState<Record<string, string>>({})
  const options = awaitingInput.options || []
  const isPlanApproval = awaitingInput.inputType === 'plan_approval'
  const isQuestion = awaitingInput.inputType === 'question'
  const isBatchedQuestions = awaitingInput.inputType === 'batched_questions'

  // Format agent name for display
  const formatAgentName = (name: string): string => {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  // Handle batched answer update
  const setBatchedAnswer = (questionId: string, answer: string) => {
    setBatchedAnswers(prev => ({ ...prev, [questionId]: answer }))
  }

  // Submit all batched answers
  const submitBatchedAnswers = () => {
    onRespond(JSON.stringify(batchedAnswers))
    setBatchedAnswers({})
  }

  // Global keyboard handler for the card
  useEffect(() => {
    if (disabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if input is focused and has content
      if (document.activeElement === inputRef.current && customInput) {
        if (e.key === 'Enter') {
          e.preventDefault()
          onRespond(customInput.trim())
          setCustomInput('')
        }
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, options.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (options[selectedIndex]) {
          onRespond(options[selectedIndex].id)
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Any printable character - focus input and type
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [disabled, options, selectedIndex, customInput, onRespond])

  // Handle input keydown
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customInput.trim()) {
      e.preventDefault()
      onRespond(customInput.trim())
      setCustomInput('')
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setCustomInput('')
      inputRef.current?.blur()
    }
  }

  // Render option row with highlight
  const renderOption = (option: { id: string; label: string; description?: string }, index: number) => {
    const isSelected = index === selectedIndex
    return (
      <div
        key={option.id}
        className={cn(
          "flex items-start gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors",
          isSelected ? "bg-blue-100 dark:bg-blue-900/30" : "hover:bg-muted/50"
        )}
        onClick={() => {
          if (!disabled) {
            onRespond(option.id)
          }
        }}
      >
        <span className={cn(
          "font-mono text-sm w-5 flex-shrink-0",
          isSelected ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
        )}>
          {isSelected ? '>' : ' '}{index + 1}.
        </span>
        <div className="flex flex-col">
          <span className={cn(
            "text-sm",
            isSelected ? "font-medium" : ""
          )}>
            {option.label}
          </span>
          {option.description && (
            <span className="text-xs text-muted-foreground">
              {option.description}
            </span>
          )}
        </div>
      </div>
    )
  }

  // Plan approval UI
  if (isPlanApproval) {
    return (
      <Card
        ref={containerRef}
        className={cn(
          "my-3 border-2 transition-colors",
          disabled ? "border-muted opacity-60" : "border-blue-500/50 hover:border-blue-500"
        )}
        tabIndex={0}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5 text-blue-500" />
            {awaitingInput.title || 'Proposed Plan'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plan content */}
          {awaitingInput.content && (
            <div className="prose prose-sm dark:prose-invert max-w-none max-h-64 overflow-y-auto">
              <ReactMarkdown>{awaitingInput.content}</ReactMarkdown>
            </div>
          )}

          {/* Divider */}
          <div className="border-t" />

          {/* Options with keyboard navigation */}
          <div className="space-y-1">
            {options.map((option, index) => renderOption(option, index))}
          </div>

          {/* Custom input for modifications */}
          <div className="pt-2">
            <Input
              ref={inputRef}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Or type feedback to request changes..."
              disabled={disabled}
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Question UI
  if (isQuestion) {
    return (
      <Card
        ref={containerRef}
        className={cn(
          "my-3 border-2 transition-colors",
          disabled ? "border-muted opacity-60" : "border-yellow-500/50 hover:border-yellow-500"
        )}
        tabIndex={0}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileQuestion className="h-5 w-5 text-yellow-500" />
            {awaitingInput.title || 'Question'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Question content */}
          {awaitingInput.content && (
            <p className="text-muted-foreground">{awaitingInput.content}</p>
          )}

          {/* Options with keyboard navigation */}
          <div className="space-y-1">
            {options.map((option, index) => renderOption(option, index))}
          </div>

          {/* Custom input option */}
          <div className="pt-2 border-t">
            <Input
              ref={inputRef}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Or type a custom response..."
              disabled={disabled}
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Batched Questions UI (for cascading planning)
  if (isBatchedQuestions) {
    const sections = awaitingInput.questionSections || []

    return (
      <Card
        ref={containerRef}
        className={cn(
          "my-3 border-2 transition-colors",
          disabled ? "border-muted opacity-60" : "border-yellow-500/50 hover:border-yellow-500"
        )}
        tabIndex={0}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileQuestion className="h-5 w-5 text-yellow-500" />
            {awaitingInput.title || 'Clarifying Questions'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {awaitingInput.content && (
            <p className="text-sm text-muted-foreground">{awaitingInput.content}</p>
          )}

          {sections.map((section) => (
            <div key={`${section.agentName}_${section.stepId}`} className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground border-b pb-1">
                {formatAgentName(section.agentName)}
              </h4>
              {section.questions.map((q) => (
                <div key={q.questionId} className="pl-3 border-l-2 border-muted space-y-2">
                  <p className="text-sm font-medium">{q.question}</p>
                  {q.context && (
                    <p className="text-xs text-muted-foreground italic">{q.context}</p>
                  )}
                  {q.options && q.options.length > 0 ? (
                    <div className="space-y-1">
                      {q.options.map((opt, i) => {
                        const isSelected = batchedAnswers[q.questionId] === opt
                        return (
                          <div
                            key={i}
                            className={cn(
                              "flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors text-sm",
                              isSelected ? "bg-blue-100 dark:bg-blue-900/30" : "hover:bg-muted/50"
                            )}
                            onClick={() => !disabled && setBatchedAnswer(q.questionId, opt)}
                          >
                            <span className={cn(
                              "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                              isSelected ? "border-blue-500 bg-blue-500" : "border-muted-foreground"
                            )}>
                              {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                            </span>
                            <span>{opt}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <Input
                      value={batchedAnswers[q.questionId] || ''}
                      onChange={(e) => setBatchedAnswer(q.questionId, e.target.value)}
                      placeholder="Type your answer..."
                      disabled={disabled}
                      className="text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          ))}

          <div className="pt-3 border-t">
            <button
              onClick={submitBatchedAnswers}
              disabled={disabled}
              className={cn(
                "w-full py-2 px-4 rounded text-sm font-medium transition-colors",
                disabled
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              )}
            >
              Continue Planning
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Fallback for unknown input types
  return null
}
