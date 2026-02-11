'use client'

import React, { useState } from 'react'
import { User, ExternalLink, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import ReactMarkdown from 'react-markdown'
import type { HumanTaskState } from './types/extended-chat-handler'

interface HumanTaskCardProps {
  humanTask: HumanTaskState
  onSubmit: (outputs: Record<string, string>) => void
  onCancel?: () => void
  disabled?: boolean
}

/**
 * HumanTaskCard - Card component for human skill completion
 *
 * AIDEV-NOTE: Displayed when execution reaches a human skill. Shows:
 * - Instructions (markdown)
 * - Input context from execution
 * - Output form fields based on schema
 * - Submit/Cancel buttons
 */
export function HumanTaskCard({
  humanTask,
  onSubmit,
  onCancel,
  disabled = false,
}: HumanTaskCardProps) {
  const [outputs, setOutputs] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOutputChange = (name: string, value: string) => {
    setOutputs(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onSubmit(outputs)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid = humanTask.outputSchema.every(output => {
    const value = outputs[output.name]
    return value && value.trim().length > 0
  })

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/20 overflow-hidden my-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-sm text-blue-900 dark:text-blue-100">
            Human Task: {humanTask.skillName}
          </span>
        </div>
        {humanTask.assignedTo && (
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
            Assigned to you
          </span>
        )}
      </div>

      {/* Instructions */}
      <div className="px-4 py-3 border-b border-blue-100 dark:border-blue-800/50">
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Instructions
        </h4>
        <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
          <ReactMarkdown>{humanTask.instructions}</ReactMarkdown>
        </div>
      </div>

      {/* Input Context */}
      {humanTask.inputs.length > 0 && (
        <div className="px-4 py-3 border-b border-blue-100 dark:border-blue-800/50">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Context
          </h4>
          <div className="space-y-2">
            {humanTask.inputs.map((input, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 min-w-[80px]">
                  {input.name}:
                </span>
                <span className="text-sm text-gray-800 dark:text-gray-200">
                  {input.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* External Links */}
      {humanTask.externalLinks.length > 0 && (
        <div className="px-4 py-3 border-b border-blue-100 dark:border-blue-800/50">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            External Resources
          </h4>
          <div className="flex flex-wrap gap-2">
            {humanTask.externalLinks.map((link, idx) => (
              <a
                key={idx}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {new URL(link).hostname}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Output Form */}
      <div className="px-4 py-3">
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Your Response
        </h4>
        <div className="space-y-4">
          {humanTask.outputSchema.map((output, idx) => (
            <div key={idx} className="space-y-1.5">
              <Label htmlFor={`output-${output.name}`} className="text-sm font-medium">
                {output.name}
                {output.description && (
                  <span className="ml-1 text-xs text-gray-500 font-normal">
                    ({output.description})
                  </span>
                )}
              </Label>
              {output.type === 'text' || output.type === 'string' ? (
                <Input
                  id={`output-${output.name}`}
                  value={outputs[output.name] || ''}
                  onChange={(e) => handleOutputChange(output.name, e.target.value)}
                  placeholder={`Enter ${output.name}...`}
                  disabled={disabled || isSubmitting}
                  className="bg-white dark:bg-gray-900"
                />
              ) : output.type === 'long_text' || output.type === 'textarea' ? (
                <Textarea
                  id={`output-${output.name}`}
                  value={outputs[output.name] || ''}
                  onChange={(e) => handleOutputChange(output.name, e.target.value)}
                  placeholder={`Enter ${output.name}...`}
                  disabled={disabled || isSubmitting}
                  rows={3}
                  className="bg-white dark:bg-gray-900"
                />
              ) : (
                <Input
                  id={`output-${output.name}`}
                  value={outputs[output.name] || ''}
                  onChange={(e) => handleOutputChange(output.name, e.target.value)}
                  placeholder={`Enter ${output.name}...`}
                  disabled={disabled || isSubmitting}
                  className="bg-white dark:bg-gray-900"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 bg-blue-50/50 dark:bg-blue-950/20 border-t border-blue-100 dark:border-blue-800/50">
        {onCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={disabled || isSubmitting}
            className="gap-1"
          >
            <XCircle className="h-4 w-4" />
            Cancel
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={disabled || isSubmitting || !isValid}
          className="gap-1 bg-blue-600 hover:bg-blue-700"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          Submit
        </Button>
      </div>
    </div>
  )
}
