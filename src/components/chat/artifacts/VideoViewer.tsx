/**
 * VideoViewer - Video player for chat artifacts
 *
 * Uses native HTML5 video element with browser controls.
 *
 * AIDEV-NOTE: Simple video viewer using native HTML5 video element
 * for broad format support (MP4, WebM, OGG, etc.).
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
  Video,
} from 'lucide-react'
import type { FileArtifact } from '../types/chat-artifacts'
import { getFileDisplayInfo } from '../types/chat-artifacts'
import { useOptionalTheme } from '@/components/puck/theme-context'
import { getViewerContainerStyle, getThemedSectionStyle } from './theme-utils'

interface VideoViewerProps {
  artifact: FileArtifact
  onClose?: () => void
  className?: string
}

export function VideoViewer({
  artifact,
  onClose,
  className = ''
}: VideoViewerProps) {
  const { fileField, fileName, fileUrl } = artifact.data
  const displayInfo = getFileDisplayInfo(artifact)
  const theme = useOptionalTheme()

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
          <Video className="w-5 h-5 text-pink-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate">{displayInfo.title}</h3>
            <p className="text-xs text-muted-foreground truncate">
              Video • {displayInfo.subtitle}
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

      {/* Video Content */}
      <div className="flex-1 flex items-center justify-center bg-black p-4">
        <video
          controls
          className="max-w-full max-h-full"
          preload="metadata"
        >
          <source src={fileUrl} type={fileField.mimeType} />
          Your browser does not support the video element.
        </video>
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
