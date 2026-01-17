'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AwaitingInputState, BatchedQuestionAnswers } from './types/extended-chat-handler'
import ReactMarkdown from 'react-markdown'

interface ApprovalInputBarProps {
  awaitingInput: AwaitingInputState
  onRespond: (response: string) => void
  disabled?: boolean
  /** Called when user wants to save the plan to a skill */
  onSaveToSkill?: () => void
}

/**
 * ApprovalInputBar - Compact HITL UI that appears above chat input
 *
 * AIDEV-NOTE: Claude Code-style keyboard navigation:
 * - Arrow Up/Down to navigate between options
 * - Enter to select highlighted option
 * - Start typing to auto-focus input for custom feedback
 * - Input Enter to send feedback
 */
export function ApprovalInputBar({
  awaitingInput,
  onRespond,
  disabled = false,
  onSaveToSkill,
}: ApprovalInputBarProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [customInput, setCustomInput] = useState('')
  const [batchedAnswers, setBatchedAnswers] = useState<BatchedQuestionAnswers>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const options = awaitingInput.options || []
  const isBatchedQuestions = awaitingInput.inputType === 'batched_questions'
  const questionSections = awaitingInput.questionSections || []

  // Format agent name for display (snake_case → Title Case)
  const formatAgentName = (name: string): string => {
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  // Handle batched answer update
  const setBatchedAnswer = (questionId: string, answer: string) => {
    setBatchedAnswers(prev => ({ ...prev, [questionId]: answer }))
  }

  // Submit all batched answers as JSON
  const submitBatchedAnswers = () => {
    onRespond(JSON.stringify(batchedAnswers))
    setBatchedAnswers({})
  }

  // Auto-focus input on mount
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  // Global keyboard handler
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

  return (
    <div
      ref={containerRef}
      className={cn(
        "border-t bg-muted/30 px-3 py-2 mb-2",
        disabled && "opacity-60"
      )}
    >
      {/* Title */}
      <div className="text-xs text-muted-foreground mb-2">
        {awaitingInput.title || 'Waiting for your response'}
      </div>

      {/* Content (for questions/clarifications) */}
      {awaitingInput.content && !isBatchedQuestions && (
        <div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-sm">
          <ReactMarkdown>{awaitingInput.content}</ReactMarkdown>
        </div>
      )}

      {/* Batched Questions UI - Flattened Claude Code-style numbered list */}
      {isBatchedQuestions && questionSections.length > 0 && (() => {
        // Flatten all questions with inline agent context
        const allQuestions = questionSections.flatMap(section =>
          section.questions.map(q => ({ ...q, agentName: section.agentName }))
        )

        return (
          <div className="space-y-3 mb-3">
            {allQuestions.map((q, index) => (
              <div key={q.questionId} className="flex items-start gap-2">
                <span className="font-mono text-xs text-muted-foreground w-5 flex-shrink-0 pt-1.5">
                  {index + 1}.
                </span>
                <div className="flex-1 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm">{q.question}</span>
                    <span className="text-xs text-muted-foreground/70">
                      ({formatAgentName(q.agentName)})
                    </span>
                  </div>
                  {q.context && (
                    <div className="text-xs text-muted-foreground italic">{q.context}</div>
                  )}
                  {q.options && q.options.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {q.options.map((opt, i) => {
                        const isSelected = batchedAnswers[q.questionId] === opt
                        return (
                          <button
                            key={i}
                            onClick={() => !disabled && setBatchedAnswer(q.questionId, opt)}
                            disabled={disabled}
                            className={cn(
                              "px-2 py-0.5 text-xs rounded border transition-colors",
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background hover:bg-muted border-input"
                            )}
                          >
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <input
                      value={batchedAnswers[q.questionId] || ''}
                      onChange={(e) => setBatchedAnswer(q.questionId, e.target.value)}
                      placeholder="Type your answer..."
                      disabled={disabled}
                      className="w-full px-2 py-1 text-sm bg-background border border-input rounded"
                    />
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={submitBatchedAnswers}
              disabled={disabled}
              className={cn(
                "w-full py-1.5 px-3 text-sm font-medium rounded transition-colors",
                disabled
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
              )}
            >
              Submit Answers
            </button>
          </div>
        )
      })()}

      {/* Options list + custom input (all styled the same) */}
      {!isBatchedQuestions && <div className="space-y-0.5">
        {options.map((option, index) => {
          const isSelected = index === selectedIndex
          return (
            <div
              key={option.id}
              className={cn(
                "flex items-center gap-2 py-0.5 px-1 rounded cursor-pointer transition-colors text-sm",
                isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
              )}
              onClick={() => {
                if (!disabled) {
                  onRespond(option.id)
                }
              }}
            >
              <span className={cn(
                "font-mono w-4 flex-shrink-0",
                isSelected ? "text-primary" : "text-muted-foreground"
              )}>
                {isSelected ? '>' : ' '}
              </span>
              <span className="font-mono w-4 flex-shrink-0 text-muted-foreground">
                {index + 1}.
              </span>
              <span className={isSelected ? "font-medium" : ""}>
                {option.label}
              </span>
              {option.description && (
                <span className="text-xs text-muted-foreground ml-1">
                  - {option.description}
                </span>
              )}
            </div>
          )
        })}

        {/* Custom input row - styled exactly like options when options exist, simpler for free-form */}
        <div
          className={cn(
            "flex items-center gap-2 py-0.5 px-1 rounded cursor-text transition-colors text-sm",
            customInput ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
          )}
          onClick={() => inputRef.current?.focus()}
        >
          <span className={cn(
            "font-mono w-4 flex-shrink-0",
            customInput ? "text-primary" : "text-muted-foreground"
          )}>
            {customInput ? '>' : ' '}
          </span>
          {/* Only show numbered prefix if there are options */}
          {options.length > 0 && (
            <span className="font-mono w-4 flex-shrink-0 text-muted-foreground">
              {options.length + 1}.
            </span>
          )}
          <input
            ref={inputRef}
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={options.length > 0 ? "Or type feedback..." : "Type your answer..."}
            disabled={disabled}
            className={cn(
              "flex-1 bg-transparent border-none outline-none text-sm",
              "placeholder:text-muted-foreground",
              customInput && "font-medium"
            )}
          />
        </div>

        {/* Save to Skill option - shown when there's a plan that can be saved */}
        {awaitingInput.planJson && onSaveToSkill && (
          <div
            className={cn(
              "flex items-center gap-2 py-0.5 px-1 rounded cursor-pointer transition-colors text-sm mt-2 border-t pt-2",
              "hover:bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}
            onClick={() => {
              if (!disabled) {
                onSaveToSkill()
              }
            }}
          >
            <Zap className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">Save to Skill</span>
            <span className="text-xs text-muted-foreground ml-1">
              - Enable autonomous execution
            </span>
          </div>
        )}
      </div>}
    </div>
  )
}
