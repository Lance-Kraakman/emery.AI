'use client'

import { useEffect, useState } from 'react'
import { FileText, Download, ExternalLink, X, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useLayout } from '@/components/layout/LayoutProvider'
import { BaseCanvas } from './BaseCanvas'
import { FileTypeDetector } from '@/ddd/domain/tables/services/file-type-detector'
import { FILE_VIEWER_TYPES } from '@/ddd/domain/tables/value-objects/file-viewer-types'

/**
 * FileViewerCanvas - LlamaIndex integrated file viewer canvas
 * 
 * Features:
 * - LlamaIndex file viewer integration for various file types
 * - PDF, image, text, and office document support
 * - File metadata display and download functionality
 * - Smart rendering based on file type
 * - Integration with layout canvas system
 * 
 * AIDEV-NOTE: This component integrates with LlamaIndex file viewer components
 * and provides a canvas interface for viewing files within the layout system.
 */

interface FileViewerCanvasProps {
  className?: string
}

export function FileViewerCanvas({ className = '' }: FileViewerCanvasProps) {
  const { fileViewerContext, canvasState, toggleCanvas, setCanvasState } = useLayout()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset error when context changes
  useEffect(() => {
    setError(null)
  }, [fileViewerContext])

  // Only render when canvas is expanded and we have file viewer context
  if (canvasState !== 'expanded' || !fileViewerContext) {
    return null
  }

  const { viewerType, fileName, fileUrl, fileField } = fileViewerContext

  // Determine file type icon using domain constants
  const getFileIcon = () => {
    switch (viewerType) {
      case FILE_VIEWER_TYPES.PDF:
        return <FileText className="h-5 w-5 text-red-600" />
      case FILE_VIEWER_TYPES.IMAGE:
        return <FileText className="h-5 w-5 text-blue-600" />
      case FILE_VIEWER_TYPES.TEXT:
        return <FileText className="h-5 w-5 text-green-600" />
      case FILE_VIEWER_TYPES.OFFICE:
        return <FileText className="h-5 w-5 text-orange-600" />
      default:
        return <FileText className="h-5 w-5 text-gray-600" />
    }
  }

  // Get file type badge
  const getFileTypeBadge = () => {
    const extension = fileName.split('.').pop()?.toUpperCase() || 'FILE'
    return (
      <Badge variant="secondary" className="text-xs">
        {extension}
      </Badge>
    )
  }

  // Handle file download
  const handleDownload = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank')
    }
  }

  // Handle opening in new tab
  const handleOpenExternal = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank')
    }
  }

  // Header actions for the canvas
  const headerActions = (
    <div className="flex items-center gap-2">
      {getFileTypeBadge()}
      
      {fileUrl && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-8 px-2"
            title="Download file"
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenExternal}
            className="h-8 px-2"
            title="Open in new tab"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Open
          </Button>
        </>
      )}
    </div>
  )

  // Render file content based on type using domain constants
  const renderFileContent = () => {
    if (error) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Error Loading File</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={() => setError(null)}>
              Try Again
            </Button>
          </div>
        </div>
      )
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading file...</p>
          </div>
        </div>
      )
    }

    // TODO: Integrate with LlamaIndex file viewer components
    // For now, show a placeholder with file information
    switch (viewerType) {
      case FILE_VIEWER_TYPES.PDF:
        return (
          <div className="h-full p-4">
            <div className="bg-muted/20 rounded-lg h-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-16 w-16 text-red-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">PDF Viewer</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  LlamaIndex PDF viewer integration will be implemented here
                </p>
                <p className="text-xs text-muted-foreground">
                  File: {fileName}
                </p>
                {fileUrl && (
                  <Button
                    variant="outline"
                    onClick={handleOpenExternal}
                    className="mt-4"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open PDF
                  </Button>
                )}
              </div>
            </div>
          </div>
        )

      case FILE_VIEWER_TYPES.IMAGE:
        return (
          <div className="h-full p-4">
            <div className="bg-muted/20 rounded-lg h-full flex items-center justify-center">
              {fileUrl ? (
                <img
                  src={fileUrl}
                  alt={fileName}
                  className="max-w-full max-h-full object-contain rounded"
                  onError={() => setError('Failed to load image')}
                />
              ) : (
                <div className="text-center">
                  <FileText className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Image Viewer</h3>
                  <p className="text-sm text-muted-foreground">
                    No image URL available
                  </p>
                </div>
              )}
            </div>
          </div>
        )

      case FILE_VIEWER_TYPES.TEXT:
        return (
          <div className="h-full p-4">
            <div className="bg-muted/20 rounded-lg h-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Text Viewer</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  LlamaIndex text viewer integration will be implemented here
                </p>
                <p className="text-xs text-muted-foreground">
                  File: {fileName}
                </p>
                {fileUrl && (
                  <Button
                    variant="outline"
                    onClick={handleOpenExternal}
                    className="mt-4"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Text File
                  </Button>
                )}
              </div>
            </div>
          </div>
        )

      case FILE_VIEWER_TYPES.OFFICE:
        return (
          <div className="h-full p-4">
            <div className="bg-muted/20 rounded-lg h-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-16 w-16 text-orange-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Office Document Viewer</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  LlamaIndex office document viewer integration will be implemented here
                </p>
                <p className="text-xs text-muted-foreground">
                  File: {fileName}
                </p>
                {fileUrl && (
                  <Button
                    variant="outline"
                    onClick={handleOpenExternal}
                    className="mt-4"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Document
                  </Button>
                )}
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="h-full p-4">
            <div className="bg-muted/20 rounded-lg h-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Generic File Viewer</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This file type is not directly supported for preview
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  File: {fileName}
                </p>
                {fileUrl && (
                  <Button
                    variant="outline"
                    onClick={handleDownload}
                    className="mt-4"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                )}
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <BaseCanvas
      title="File Viewer"
      subtitle={fileName}
      icon={getFileIcon()}
      headerActions={headerActions}
      className={className}
    >
      {renderFileContent()}
    </BaseCanvas>
  )
}