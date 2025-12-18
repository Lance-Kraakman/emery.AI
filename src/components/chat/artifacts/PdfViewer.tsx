/**
 * PdfViewer - PDF viewer for chat artifacts
 *
 * Uses @llamaindex/pdf-viewer for rich PDF viewing with page navigation.
 *
 * AIDEV-NOTE: PDF artifact viewer using @llamaindex/pdf-viewer library
 * for better PDF experience than native iframe.
 */

'use client'

import React, { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  ExternalLink,
  Calendar,
  HardDrive,
  X,
  FileText,
} from 'lucide-react'
import type { FileArtifact } from '../types/chat-artifacts'
import { getFileDisplayInfo } from '../types/chat-artifacts'
import { PDFViewer, PdfFocusProvider } from '@llamaindex/pdf-viewer'
import '@llamaindex/pdf-viewer/index.css'
import { useOptionalTheme } from '@/components/puck/contexts/PageContext'
import { getViewerContainerStyle, getThemedBackground, getThemedSectionStyle } from './theme-utils'

interface PdfViewerProps {
  artifact: FileArtifact
  onClose?: () => void
  className?: string
}

export function PdfViewer({
  artifact,
  onClose,
  className = ''
}: PdfViewerProps) {
  const { fileField, fileName, fileUrl } = artifact.data
  const displayInfo = getFileDisplayInfo(artifact)
  const theme = useOptionalTheme()

  // Debug: Log file information
  console.log('[PdfViewer] Rendering with:', {
    fileFieldId: fileField?.id,
    fileName,
    fileUrl,
    hasFileUrl: !!fileUrl,
    fileUrlLength: fileUrl?.length
  })

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
          <FileText className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate">{displayInfo.title}</h3>
            <p className="text-xs text-muted-foreground truncate">
              PDF • {displayInfo.subtitle}
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

      {/* PDF Content */}
      <div
        className={`flex-1 overflow-hidden ${!theme ? 'bg-gray-100' : ''}`}
        style={getThemedBackground(theme, 'surface')}
      >
        {!fileUrl ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No PDF URL available</p>
              <p className="text-xs mt-1">File ID: {fileField?.id || 'unknown'}</p>
            </div>
          </div>
        ) : (
          <PdfFocusProvider>
            <PDFViewer
              file={{
                id: fileField.id,
                url: fileUrl,
              }}
              containerClassName="h-full"
            />
          </PdfFocusProvider>
        )}
      </div>

      {/* Footer */}
      <div
        className={`flex items-center justify-between p-3 border-t text-xs flex-shrink-0 ${!theme ? 'border-border bg-muted/10 text-muted-foreground' : ''}`}
        style={{ ...getThemedSectionStyle(theme), color: theme ? 'var(--theme-text-muted)' : undefined }}
      >
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(fileField.uploadedAt).toLocaleDateString()}
          </span>
          <span>{fileField.mimeType}</span>
        </div>

        <div className="flex items-center gap-2">
          <span>Table {artifact.data.tableId} • Field {artifact.data.fieldId}</span>
        </div>
      </div>
    </div>
  )
}
