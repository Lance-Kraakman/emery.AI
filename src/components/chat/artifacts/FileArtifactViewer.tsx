/**
 * FileArtifactViewer - Multi-format file viewer for chat artifacts
 *
 * Routes to specialized viewers based on file type:
 * - CodeViewer for code files (js, ts, py, etc.)
 * - MarkdownViewer for markdown files
 * - OfficeViewer for DOCX files
 * - AudioViewer for audio files
 * - VideoViewer for video files
 * - Built-in viewers for PDF, images, text, and generic files
 *
 * AIDEV-NOTE: File artifact viewer supporting multiple file formats with
 * inline viewing capabilities within chat canvas overlay system.
 */

'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  ExternalLink,
  File,
  FileText,
  Image as ImageIcon,
  Calendar,
  HardDrive,
  ZoomIn,
  ZoomOut,
  RotateCw,
  AtSign,
  X,
} from 'lucide-react'
import type { FileArtifact } from '../types/chat-artifacts'
import { getFileDisplayInfo } from '../types/chat-artifacts'
import { createDebugLogger } from '@/lib/utils/debug-logger'
import { CodeViewer } from './CodeViewer'
import { MarkdownViewer } from './MarkdownViewer'
import { OfficeViewer } from './OfficeViewer'
import { AudioViewer } from './AudioViewer'
import { VideoViewer } from './VideoViewer'
import { PdfViewer } from './PdfViewer'
import { useOptionalTheme } from '@/components/puck/contexts/PageContext'
import { getViewerContainerStyle, getThemedBackground, getThemedSectionStyle } from './theme-utils'

const logger = createDebugLogger('FileArtifactViewer')
// Note: Old reference search store removed in favor of simplified system

interface FileArtifactViewerProps{
  artifact: FileArtifact
  onClose?: () => void
  onSaveContent?: (content: string) => Promise<void>
  className?: string
}

export function FileArtifactViewer({
  artifact,
  onClose,
  onSaveContent,
  className = ""
}: FileArtifactViewerProps) {
  const { fileField, viewerType, fileName, fileUrl } = artifact.data
  const theme = useOptionalTheme()

  // All hooks must be called before any conditional returns
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [loadingText, setLoadingText] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Load text content for text files (hook must be before any returns)
  useEffect(() => {
    if (viewerType === 'text' && fileUrl && !textContent) {
      logger.debug('TEXT viewer: fetching content', { fileUrl, viewerType })
      setLoadingText(true)
      fetch(fileUrl)
        .then(response => {
          logger.debug('TEXT viewer: response received', {
            status: response.status,
            ok: response.ok,
            contentType: response.headers.get('content-type')
          })
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          return response.text()
        })
        .then(text => {
          logger.debug('TEXT viewer: content loaded', { length: text.length, preview: text.substring(0, 100) })
          setTextContent(text)
          setLoadingText(false)
        })
        .catch(error => {
          logger.error('TEXT viewer: failed to load content', error)
          setTextContent(`Failed to load file content: ${error.message}`)
          setLoadingText(false)
        })
    }
  }, [viewerType, fileUrl, textContent])

  // Handle download (hook must be before any returns)
  const handleDownload = useCallback(() => {
    if (!fileUrl) return
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [fileUrl, fileName])

  // Handle external open (hook must be before any returns)
  const handleExternalOpen = useCallback(() => {
    if (!fileUrl) return
    window.open(fileUrl, '_blank')
  }, [fileUrl])

  // Debug: Log what data we received
  logger.debug('FileArtifactViewer: opening file', { viewerType, fileName, fileUrl, s3Key: fileField?.s3Key })

  // Route to specialized viewers for new file types
  switch (viewerType) {
    case 'pdf':
      return <PdfViewer artifact={artifact} onClose={onClose} className={className} />
    case 'code':
      return <CodeViewer artifact={artifact} onClose={onClose} onSave={onSaveContent} className={className} />
    case 'markdown':
      return <MarkdownViewer artifact={artifact} onClose={onClose} onSave={onSaveContent} className={className} />
    case 'office':
      return <OfficeViewer artifact={artifact} onClose={onClose} className={className} />
    case 'audio':
      return <AudioViewer artifact={artifact} onClose={onClose} className={className} />
    case 'video':
      return <VideoViewer artifact={artifact} onClose={onClose} className={className} />
    // image, text, and generic handled below
  }

  // Early return if no fileUrl - show error state
  if (!fileUrl) {
    return (
      <div
        className={`h-full flex flex-col ${!theme ? 'bg-card' : ''} ${className}`}
        style={getViewerContainerStyle(theme)}
      >
        <div
          className={`flex items-center justify-between p-3 border-b ${!theme ? 'border-border bg-muted/10' : ''}`}
          style={getThemedSectionStyle(theme)}
        >
          <div className="flex items-center gap-3">
            <File className="w-5 h-5 text-gray-600" />
            <div>
              <h3 className="font-medium text-sm">{fileName || 'Unknown File'}</h3>
              <p className="text-xs text-muted-foreground">Unable to load</p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div
          className={`flex-1 flex items-center justify-center ${!theme ? 'bg-gray-50' : ''}`}
          style={getThemedBackground(theme, 'surface')}
        >
          <div className="text-center p-8">
            <File className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-sm font-medium text-gray-600 mb-2">Unable to load file</p>
            <p className="text-xs text-gray-500">No download URL available. The file may not have been uploaded yet.</p>
          </div>
        </div>
      </div>
    )
  }

  // Extract display information
  const displayInfo = getFileDisplayInfo(artifact)

  // Note: useEffect and useCallback hooks moved above early returns to satisfy React hooks rules

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25))
  const handleResetZoom = () => setZoom(100)
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)

  // Get file type icon
  const getFileIcon = () => {
    switch (viewerType) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-green-600" />
      case 'text':
        return <FileText className="w-5 h-5 text-blue-600" />
      default:
        return <File className="w-5 h-5 text-gray-600" />
    }
  }

  // Render file content based on type
  const renderFileContent = () => {
    switch (viewerType) {
      case 'image':
        return (
          <div
            className={`flex items-center justify-center min-h-[400px] ${!theme ? 'bg-gray-50' : ''}`}
            style={getThemedBackground(theme, 'surface')}
          >
            <img
              src={fileUrl}
              alt={fileName}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                maxHeight: isFullscreen ? '80vh' : '400px'
              }}
              onError={(e) => {
                e.currentTarget.src = '/api/placeholder/400/300?text=Image+Failed+to+Load'
              }}
            />
          </div>
        )

      case 'text':
        return (
          <div
            className={`min-h-[400px] overflow-auto ${!theme ? 'bg-gray-50' : ''}`}
            style={getThemedBackground(theme, 'surface')}
          >
            {loadingText ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-sm text-gray-500">Loading text content...</div>
              </div>
            ) : (
              <pre
                className="p-4 text-sm font-mono whitespace-pre-wrap break-words"
                style={{ fontSize: `${zoom / 100}rem` }}
              >
                {textContent}
              </pre>
            )}
          </div>
        )

      default:
        return (
          <div
            className={`min-h-[400px] flex items-center justify-center ${!theme ? 'bg-gray-50' : ''}`}
            style={getThemedBackground(theme, 'surface')}
          >
            <div className="text-center">
              <File className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-sm font-medium mb-2">{fileName}</p>
              <p className="text-xs text-gray-500 mb-4">
                Preview not available for this file type
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
          {getFileIcon()}
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate">{displayInfo.title}</h3>
            <p className="text-xs text-muted-foreground truncate">{displayInfo.subtitle}</p>
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
          
          {/* Viewer controls for supported types */}
          {(viewerType === 'image' || viewerType === 'text') && (
            <div className="flex items-center gap-1 border-l pl-2 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 25}
                className="h-6 w-6 p-0"
                title="Zoom out"
              >
                <ZoomOut className="w-3 h-3" />
              </Button>
              <span className="text-xs text-gray-500 px-1">{zoom}%</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 300}
                className="h-6 w-6 p-0"
                title="Zoom in"
              >
                <ZoomIn className="w-3 h-3" />
              </Button>
              
              {viewerType === 'image' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRotate}
                  className="h-6 w-6 p-0"
                  title="Rotate"
                >
                  <RotateCw className="w-3 h-3" />
                </Button>
              )}
            </div>
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
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Insert file reference into chat
                const fileName = artifact.data.fileField.name
                const referenceText = `@file:${fileName}`

                // TODO: Implement reference button functionality with new simplified system
                logger.debug('Add reference', { referenceText })
              }}
              className="text-xs"
              title="Add file reference to chat"
            >
              <AtSign className="w-3 h-3 mr-1" />
              Reference
            </Button>
          </div>
        </div>
      </div>

      {/* File Content */}
      <div ref={contentRef} className="flex-1 overflow-auto">
        {renderFileContent()}
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

// AIDEV-NOTE: This component provides comprehensive file viewing capabilities
// within the chat artifact system, handling multiple file formats with
// appropriate viewers and maintaining consistency with existing domain DTOs.