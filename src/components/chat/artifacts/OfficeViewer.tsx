/**
 * OfficeViewer - DOCX document viewer for chat artifacts
 *
 * Uses Mammoth.js for client-side DOCX → HTML conversion.
 * View-only (no editing support).
 *
 * AIDEV-NOTE: Office document viewer using Mammoth.js for DOCX preview.
 * Only DOCX is supported; other Office formats show download option.
 */

'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  ExternalLink,
  Calendar,
  HardDrive,
  X,
  FileText,
  AlertCircle,
} from 'lucide-react'
import DOMPurify from 'dompurify'
import type { FileArtifact } from '../types/chat-artifacts'
import { getFileDisplayInfo } from '../types/chat-artifacts'
import { getFileExtension } from '@/ddd/domain/tables/value-objects/file-viewer-types'
import { createDebugLogger } from '@/lib/utils/debug-logger'
import { useOptionalTheme } from '@/components/puck/contexts/PageContext'
import { getViewerContainerStyle, getThemedBackground, getThemedSectionStyle } from './theme-utils'

const logger = createDebugLogger('OfficeViewer')

interface OfficeViewerProps {
  artifact: FileArtifact
  onClose?: () => void
  className?: string
}

export function OfficeViewer({
  artifact,
  onClose,
  className = ''
}: OfficeViewerProps) {
  const { fileField, fileName, fileUrl } = artifact.data
  const theme = useOptionalTheme()
  const [htmlContent, setHtmlContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formattedDate, setFormattedDate] = useState('')

  // Format date after hydration to avoid server/client mismatch
  useEffect(() => {
    if (fileField?.uploadedAt) {
      setFormattedDate(new Date(fileField.uploadedAt).toLocaleDateString())
    }
  }, [fileField?.uploadedAt])

  const displayInfo = getFileDisplayInfo(artifact)
  const extension = getFileExtension(fileName)
  const isDocx = extension === 'docx'

  // Load and convert DOCX content
  useEffect(() => {
    if (!isDocx) {
      setLoading(false)
      return
    }

    async function loadDocx() {
      setLoading(true)
      setError(null)

      try {
        // Dynamically import mammoth to avoid SSR issues
        const mammoth = await import('mammoth')

        // Fetch the DOCX file as ArrayBuffer
        const response = await fetch(fileUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`)
        }

        const arrayBuffer = await response.arrayBuffer()

        // Convert DOCX to HTML
        const result = await mammoth.convertToHtml({ arrayBuffer })

        if (result.messages.length > 0) {
          logger.debug('Mammoth conversion messages', result.messages)
        }

        setHtmlContent(result.value)
      } catch (err) {
        logger.error('Failed to convert DOCX', err)
        setError(err instanceof Error ? err.message : 'Failed to load document')
      } finally {
        setLoading(false)
      }
    }

    loadDocx()
  }, [fileUrl, isDocx])

  // Handle download
  const handleDownload = useCallback(() => {
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [fileUrl, fileName])

  // Handle external open
  const handleExternalOpen = useCallback(() => {
    window.open(fileUrl, '_blank')
  }, [fileUrl])

  // Render content based on file type
  const renderContent = () => {
    // For non-DOCX files, show download message
    if (!isDocx) {
      return (
        <div
          className={`flex-1 flex items-center justify-center p-8 ${!theme ? 'bg-gray-50' : ''}`}
          style={getThemedBackground(theme, 'surface')}
        >
          <div className="text-center max-w-md">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-sm font-medium mb-2">{fileName}</p>
            <p className="text-xs text-gray-500 mb-4">
              Preview not available for .{extension} files.
              Only .docx files can be previewed.
            </p>
            <div className="space-x-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={handleExternalOpen}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Open External
              </Button>
            </div>
          </div>
        </div>
      )
    }

    // Loading state
    if (loading) {
      return (
        <div
          className={`flex-1 flex items-center justify-center ${!theme ? 'bg-gray-50' : ''}`}
          style={getThemedBackground(theme, 'surface')}
        >
          <div className="text-sm text-gray-500">Converting document...</div>
        </div>
      )
    }

    // Error state
    if (error) {
      return (
        <div
          className={`flex-1 flex items-center justify-center p-8 ${!theme ? 'bg-gray-50' : ''}`}
          style={getThemedBackground(theme, 'surface')}
        >
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-sm font-medium text-red-600 mb-2">Failed to load document</p>
            <p className="text-xs text-gray-500 mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download Original
            </Button>
          </div>
        </div>
      )
    }

    // Render converted HTML
    return (
      <div
        className={`flex-1 overflow-auto p-6 ${!theme ? 'bg-white' : ''}`}
        style={getThemedBackground(theme, 'background')}
      >
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }}
        />
      </div>
    )
  }

  return (
    <div
      className={`h-full flex flex-col ${!theme ? 'bg-card' : ''} ${className}`}
      style={getViewerContainerStyle(theme)}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between p-3 border-b ${!theme ? 'border-border bg-muted/10' : ''}`}
        style={getThemedSectionStyle(theme)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate">{displayInfo.title}</h3>
            <p className="text-xs text-muted-foreground truncate">
              {extension.toUpperCase()} Document • {displayInfo.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* File metadata */}
          <Badge variant="outline" className="text-xs flex-shrink-0">
            <HardDrive className="w-3 h-3 mr-1" />
            {displayInfo.sizeFormatted}
          </Badge>

          {/* Close button */}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0 flex-shrink-0"
              title="Close (Esc)"
            >
              <X className="h-3 w-3" />
            </Button>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1 border-l pl-2 ml-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="text-xs"
            >
              <Download className="w-3 h-3 mr-1" />
              Download
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExternalOpen}
              className="text-xs"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              External
            </Button>
          </div>
        </div>
      </div>

      {/* Document Content */}
      {renderContent()}

      {/* Footer */}
      <div
        className={`flex items-center justify-between p-3 border-t text-xs flex-shrink-0 ${!theme ? 'border-border bg-muted/10 text-muted-foreground' : ''}`}
        style={{ ...getThemedSectionStyle(theme), color: theme ? 'var(--theme-text-muted)' : undefined }}
      >
        <div className="flex items-center gap-4">
          {formattedDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formattedDate}
            </span>
          )}
          <span>{fileField.mimeType}</span>
        </div>

        <div className="flex items-center gap-2">
          <span>Table {artifact.data.tableId} • Field {artifact.data.fieldId}</span>
        </div>
      </div>
    </div>
  )
}
