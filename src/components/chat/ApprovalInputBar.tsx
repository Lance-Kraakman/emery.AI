'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Zap, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatQuestionAnswers } from '@/lib/chat/format-utils'
import type { AwaitingInputState, BatchedQuestionAnswers, BatchedQuestion } from './types/extended-chat-handler'
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
 * - Enter to select highlighted option (single_select) or toggle (multi_select)
 * - Start typing to auto-focus input for custom feedback
 * - Wizard-style: one question per page with Next/Previous/Submit
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [multiSelectValues, setMultiSelectValues] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const options = awaitingInput.options || []
  const isQuestions = awaitingInput.inputType === 'questions'
  const questionSections = awaitingInput.questionSections || []

  // Flatten all questions with agent context
  const allQuestions = questionSections.flatMap(section =>
    section.questions.map(q => ({ ...q, agentName: section.agentName }))
  )

  // Format agent name for display (snake_case → Title Case)
  const formatAgentName = (name: string): string => {
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  // Handle batched answer update
  const setBatchedAnswer = (questionId: string, answer: string) => {
    setBatchedAnswers(prev => ({ ...prev, [questionId]: answer }))
  }

  // Submit all batched answers as human-readable text (not JSON)
  const submitBatchedAnswers = () => {
    const formattedAnswers = formatQuestionAnswers(allQuestions, batchedAnswers)
    onRespond(formattedAnswers)
    setBatchedAnswers({})
    setCurrentQuestionIndex(0)
    setMultiSelectValues(new Set())
  }

  // Toggle multi-select value
  const toggleMultiSelect = (value: string) => {
    setMultiSelectValues(prev => {
      const next = new Set(prev)
      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
      }
      return next
    })
  }

  // Save current question answer and move to next
  const saveCurrentAndNext = (currentQ: BatchedQuestion & { agentName: string }) => {
    const questionType = currentQ.questionType || (currentQ.options?.length ? 'single_select' : 'text')

    if (questionType === 'multi_select') {
      // Save multi-select as comma-separated string
      const answer = Array.from(multiSelectValues).join(', ')
      setBatchedAnswer(currentQ.questionId, answer)
      setMultiSelectValues(new Set())
    }
    // For single_select and text, answer is already saved

    setSelectedIndex(0)
    setCustomInput('')

    if (currentQuestionIndex < allQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    }
  }

  // Auto-focus input on mount and question change
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [currentQuestionIndex])

  // Get the effective options for keyboard navigation
  const getEffectiveOptions = (): string[] => {
    if (isQuestions && allQuestions.length > 0) {
      const currentQ = allQuestions[currentQuestionIndex]
      if (currentQ?.options?.length) {
        return currentQ.options
      }
    }
    return options.map(o => o.id)
  }

  const effectiveOptions = getEffectiveOptions()
  const currentQuestion = isQuestions && allQuestions.length > 0 ? allQuestions[currentQuestionIndex] : null
  const currentQuestionType = currentQuestion?.questionType || (currentQuestion?.options?.length ? 'single_select' : 'text')
  const isMultiSelect = currentQuestionType === 'multi_select'

  // Global keyboard handler
  useEffect(() => {
    if (disabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const focusInContainer = containerRef.current?.contains(document.activeElement)
      const focusInInput = document.activeElement === inputRef.current

      // If typing in the custom input and has content, handle Enter for custom input
      if (focusInInput && customInput) {
        if (e.key === 'Enter') {
          e.preventDefault()
          if (isMultiSelect) {
            // For multi-select, add custom input to selections
            toggleMultiSelect(customInput.trim())
            setCustomInput('')
          } else {
            // For single-select or text, submit the custom input
            if (isQuestions && allQuestions.length > 1) {
              // Wizard mode: save answer and potentially move to next
              setBatchedAnswer(currentQuestion!.questionId, customInput.trim())
              setCustomInput('')
              if (currentQuestionIndex === allQuestions.length - 1) {
                submitBatchedAnswers()
              } else {
                saveCurrentAndNext(currentQuestion!)
              }
            } else {
              onRespond(customInput.trim())
              setCustomInput('')
            }
          }
        }
        return
      }

      // Arrow navigation only works when focused in container
      if (focusInContainer) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex(prev => Math.min(prev + 1, effectiveOptions.length - 1))
          return
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex(prev => Math.max(prev - 1, 0))
          return
        }
      }

      // Enter key - works globally when approval bar is active
      if (e.key === 'Enter' && !customInput) {
        e.preventDefault()
        if (effectiveOptions[selectedIndex]) {
          const selectedOption = effectiveOptions[selectedIndex]

          if (isMultiSelect) {
            // Multi-select: toggle the selection
            toggleMultiSelect(selectedOption)
          } else if (isQuestions) {
            if (allQuestions.length > 1) {
              // Wizard mode: save and move to next
              setBatchedAnswer(currentQuestion!.questionId, selectedOption)
              if (currentQuestionIndex === allQuestions.length - 1) {
                submitBatchedAnswers()
              } else {
                saveCurrentAndNext(currentQuestion!)
              }
            } else {
              // Single question: respond directly
              onRespond(selectedOption)
            }
          } else if (options[selectedIndex]) {
            // Plan approval
            onRespond(options[selectedIndex].id)
          }
        }
        return
      }

      // Any printable character - focus input (only if container is focused)
      if (focusInContainer && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [disabled, options, effectiveOptions, selectedIndex, customInput, onRespond, isQuestions, isMultiSelect, currentQuestion, currentQuestionIndex, allQuestions])

  // Handle input keydown for custom input field
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

  // Handle input keydown for text-type questions (uses batchedAnswers, not customInput)
  const handleTextQuestionKeyDown = (e: React.KeyboardEvent, questionId: string) => {
    const answer = batchedAnswers[questionId]?.trim()
    if (e.key === 'Enter' && answer) {
      e.preventDefault()
      if (allQuestions.length > 1) {
        // Wizard mode: move to next or submit
        if (currentQuestionIndex === allQuestions.length - 1) {
          submitBatchedAnswers()
        } else {
          setCurrentQuestionIndex(prev => prev + 1)
          setSelectedIndex(0)
        }
      } else {
        // Single question: respond directly
        onRespond(answer)
        setBatchedAnswers({})
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
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
      {awaitingInput.content && !isQuestions && (
        <div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-sm max-h-[50vh] overflow-y-auto">
          <ReactMarkdown>{awaitingInput.content}</ReactMarkdown>
        </div>
      )}

      {/* Questions UI - Wizard-style one question per page */}
      {isQuestions && allQuestions.length > 0 && currentQuestion && (() => {
        const questionOptions = currentQuestion.options || []
        const allowOther = currentQuestion.allowOther !== false // Default: true
        const isLastQuestion = currentQuestionIndex === allQuestions.length - 1
        const hasMultipleQuestions = allQuestions.length > 1

        // Render options list (same visual style for both single and multi select)
        const renderOptionsList = () => (
          <div className="space-y-0.5">
            {questionOptions.map((opt, index) => {
              const isHighlighted = index === selectedIndex && !customInput
              const isChecked = isMultiSelect && multiSelectValues.has(opt)

              return (
                <div
                  key={opt}
                  className={cn(
                    "flex items-center gap-2 py-0.5 px-1 rounded cursor-pointer transition-colors text-sm",
                    isHighlighted ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                  )}
                  onClick={() => {
                    if (!disabled) {
                      if (isMultiSelect) {
                        toggleMultiSelect(opt)
                      } else if (hasMultipleQuestions) {
                        setBatchedAnswer(currentQuestion.questionId, opt)
                        if (isLastQuestion) {
                          submitBatchedAnswers()
                        } else {
                          saveCurrentAndNext(currentQuestion)
                        }
                      } else {
                        onRespond(opt)
                      }
                    }
                  }}
                >
                  {/* Checkmark for multi-select */}
                  {isMultiSelect ? (
                    <span className={cn(
                      "w-4 h-4 flex-shrink-0 flex items-center justify-center border rounded",
                      isChecked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                    )}>
                      {isChecked && <Check className="w-3 h-3" />}
                    </span>
                  ) : (
                    <span className={cn(
                      "font-mono w-4 flex-shrink-0",
                      isHighlighted ? "text-primary" : "text-muted-foreground"
                    )}>
                      {isHighlighted ? '>' : ' '}
                    </span>
                  )}
                  <span className="font-mono w-4 flex-shrink-0 text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span className={isHighlighted || isChecked ? "font-medium" : ""}>
                    {opt}
                  </span>
                </div>
              )
            })}

            {/* Custom input row - only shown if allowOther is true */}
            {allowOther && (
              <div
                className={cn(
                  "flex items-center gap-2 py-0.5 px-1 rounded cursor-text transition-colors text-sm",
                  customInput ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                )}
                onClick={() => inputRef.current?.focus()}
              >
                {isMultiSelect ? (
                  <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center border border-muted-foreground rounded text-muted-foreground">
                    +
                  </span>
                ) : (
                  <span className={cn(
                    "font-mono w-4 flex-shrink-0",
                    customInput ? "text-primary" : "text-muted-foreground"
                  )}>
                    {customInput ? '>' : ' '}
                  </span>
                )}
                <span className="font-mono w-4 flex-shrink-0 text-muted-foreground">
                  {questionOptions.length + 1}.
                </span>
                <input
                  ref={inputRef}
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={isMultiSelect ? "Add your own..." : "Or type your own..."}
                  disabled={disabled}
                  className={cn(
                    "flex-1 bg-transparent border-none outline-none text-sm",
                    "placeholder:text-muted-foreground",
                    customInput && "font-medium"
                  )}
                />
              </div>
            )}
          </div>
        )

        // Render text input for text-type questions
        const renderTextInput = () => (
          <input
            ref={inputRef}
            value={batchedAnswers[currentQuestion.questionId] || ''}
            onChange={(e) => setBatchedAnswer(currentQuestion.questionId, e.target.value)}
            onKeyDown={(e) => handleTextQuestionKeyDown(e, currentQuestion.questionId)}
            placeholder="Type your answer..."
            disabled={disabled}
            className="w-full px-2 py-1 text-sm bg-background border border-input rounded"
          />
        )

        return (
          <div className="space-y-2">
            {/* Progress indicator for multiple questions */}
            {hasMultipleQuestions && (
              <div className="text-xs text-muted-foreground">
                Question {currentQuestionIndex + 1} of {allQuestions.length}
              </div>
            )}

            {/* Question text */}
            <div className="text-sm">{currentQuestion.question}</div>
            {currentQuestion.context && (
              <div className="text-xs text-muted-foreground italic">{currentQuestion.context}</div>
            )}

            {/* Render based on question type */}
            {currentQuestionType === 'text' ? renderTextInput() : renderOptionsList()}

            {/* Multi-select selected items summary */}
            {isMultiSelect && multiSelectValues.size > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                Selected: {Array.from(multiSelectValues).join(', ')}
              </div>
            )}

            {/* Navigation buttons for wizard mode or multi-select */}
            {(hasMultipleQuestions || isMultiSelect) && (
              <div className="flex items-center justify-between mt-3 pt-2 border-t">
                {/* Previous button */}
                <button
                  onClick={() => {
                    if (currentQuestionIndex > 0) {
                      setCurrentQuestionIndex(prev => prev - 1)
                      setSelectedIndex(0)
                      setCustomInput('')
                      setMultiSelectValues(new Set())
                    }
                  }}
                  disabled={disabled || currentQuestionIndex === 0}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors",
                    currentQuestionIndex === 0
                      ? "text-muted-foreground cursor-not-allowed"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                {/* Next/Submit button */}
                {isLastQuestion || !hasMultipleQuestions ? (
                  <button
                    onClick={() => {
                      if (isMultiSelect) {
                        // Save multi-select answer
                        const answer = Array.from(multiSelectValues).join(', ')
                        if (hasMultipleQuestions) {
                          setBatchedAnswer(currentQuestion.questionId, answer)
                          submitBatchedAnswers()
                        } else {
                          onRespond(answer)
                        }
                      } else if (hasMultipleQuestions) {
                        submitBatchedAnswers()
                      }
                    }}
                    disabled={disabled}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1 text-sm font-medium rounded transition-colors",
                      disabled
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary hover:bg-primary/90 text-primary-foreground"
                    )}
                  >
                    Submit
                  </button>
                ) : (
                  <button
                    onClick={() => saveCurrentAndNext(currentQuestion)}
                    disabled={disabled}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors",
                      disabled
                        ? "text-muted-foreground cursor-not-allowed"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Options list + custom input (all styled the same) */}
      {!isQuestions && <div className="space-y-0.5">
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
