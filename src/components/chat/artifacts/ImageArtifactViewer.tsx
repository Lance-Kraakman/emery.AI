/**
 * ImageArtifactViewer - Inline image viewer for chat attachments
 *
 * Displays uploaded images with zoom, rotation, and download controls
 * Used for both user-uploaded images and AI-generated images
 *
 * AIDEV-NOTE: Simple inline image viewer for multimodal chat messages
 */

'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  ExternalLink,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  Maximize2,
} from 'lucide-react'
import type { ImageAttachmentMetadata } from '@/ddd/domain/multimodal/value-objects/attachment-metadata'
import { createDebugLogger } from '@/lib/utils/debug-logger'

const logger = createDebugLogger('ImageArtifactViewer')

interface ImageArtifactViewerProps {
  attachment: ImageAttachmentMetadata
  onClose?: () => void
  className?: string
  inline?: boolean // If true, show compact inline version
}

export function ImageArtifactViewer({
  attachment,
  onClose,
  className = '',
  inline = true
}: ImageArtifactViewerProps) {
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [imageError, setImageError] = useState(false)

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25))
  const handleResetZoom = () => setZoom(100)
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)

  // Download image
  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = attachment.url
    link.download = attachment.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    logger.debug('Downloaded image', { filename: attachment.filename })
  }

  // Open in new tab
  const handleExternalOpen = () => {
    window.open(attachment.url, '_blank')
    logger.debug('Opened image externally', { filename: attachment.filename })
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    if (!isFullscreen) {
      setZoom(100)
      setRotation(0)
    }
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (inline) {
    // Compact inline version for chat messages
    return (
      <div className={`rounded-lg border border-border overflow-hidden bg-card ${className}`}>
        {/* Inline Image */}
        <div className="relative bg-gray-50 dark:bg-gray-900">
          {imageError ? (
            <div className="flex items-center justify-center h-48 bg-gray-100 dark:bg-gray-800">
              <div className="text-center text-sm text-muted-foreground">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Failed to load image</p>
              </div>
            </div>
          ) : (
            <img
              src={attachment.url}
              alt={attachment.filename}
              className="w-full h-auto max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
              onClick={toggleFullscreen}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          )}

          {/* Overlay controls */}
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleFullscreen}
              className="h-7 w-7 p-0 bg-black/50 hover:bg-black/70 text-white border-0"
              title="View fullscreen"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Inline metadata */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/10">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ImageIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="text-xs font-medium truncate">{attachment.filename}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Badge variant="outline" className="text-xs">
              {formatFileSize(attachment.sizeBytes)}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-6 w-6 p-0"
              title="Download"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Fullscreen modal */}
        {isFullscreen && (
          <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-black/50">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <ImageIcon className="w-5 h-5 text-white flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-sm text-white truncate">{attachment.filename}</h3>
                  <p className="text-xs text-gray-300">
                    {formatFileSize(attachment.sizeBytes)} • {attachment.width}×{attachment.height}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Zoom controls */}
                <div className="flex items-center gap-1 border-r border-gray-600 pr-2 mr-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomOut}
                    disabled={zoom <= 25}
                    className="h-8 w-8 p-0 text-white hover:bg-white/20"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-white px-2 min-w-[3rem] text-center">{zoom}%</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomIn}
                    disabled={zoom >= 300}
                    className="h-8 w-8 p-0 text-white hover:bg-white/20"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRotate}
                    className="h-8 w-8 p-0 text-white hover:bg-white/20"
                    title="Rotate"
                  >
                    <RotateCw className="w-4 h-4" />
                  </Button>
                </div>

                {/* Action buttons */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="text-white hover:bg-white/20"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExternalOpen}
                  className="text-white hover:bg-white/20"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Image container */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
              <img
                src={attachment.url}
                alt={attachment.filename}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                }}
                onError={() => setImageError(true)}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  // Full viewer version (for canvas/modal)
  return (
    <div className={`h-full flex flex-col bg-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/10">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <ImageIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate">{attachment.filename}</h3>
            <p className="text-xs text-muted-foreground truncate">
              {formatFileSize(attachment.sizeBytes)} • {attachment.mimeType}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Zoom controls */}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRotate}
              className="h-6 w-6 p-0"
              title="Rotate"
            >
              <RotateCw className="w-3 h-3" />
            </Button>
          </div>

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
              Open
            </Button>
          </div>

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
        </div>
      </div>

      {/* Image content */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        {imageError ? (
          <div className="text-center text-muted-foreground">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-sm font-medium mb-2">Failed to load image</p>
            <p className="text-xs">The image could not be displayed</p>
          </div>
        ) : (
          <img
            src={attachment.url}
            alt={attachment.filename}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            }}
            onError={() => setImageError(true)}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-3 border-t border-border bg-muted/10 text-xs text-muted-foreground flex-shrink-0">
        <div className="flex items-center gap-4">
          {attachment.width && attachment.height && (
            <span>{attachment.width} × {attachment.height} px</span>
          )}
          <span>{attachment.mimeType}</span>
        </div>
        <div>
          Uploaded {new Date(attachment.uploadedAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  )
}

// AIDEV-NOTE: Component provides both inline (chat message) and full (canvas) display modes
// Inline mode shows compact preview with fullscreen modal on click
// Full mode provides complete viewer with all controls visible
