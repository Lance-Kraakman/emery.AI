/**
 * FileArtifactViewer - Multi-format file viewer for chat artifacts
 * 
 * Handles PDF, image, text, and other file types with appropriate viewers.
 * Uses existing FileFieldValue DTOs for data consistency.
 * 
 * AIDEV-NOTE: File artifact viewer supporting multiple file formats with
 * inline viewing capabilities within chat canvas overlay system.
 */

'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
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
} from 'lucide-react'
import type { FileArtifact } from '../types/chat-artifacts'
import { getFileDisplayInfo } from '../types/chat-artifacts'
// Note: Old reference search store removed in favor of simplified system

interface FileArtifactViewerProps {
  artifact: FileArtifact
  className?: string
}

export function FileArtifactViewer({ 
  artifact, 
  className = "" 
}: FileArtifactViewerProps) {
  const { fileField, viewerType, fileName, fileUrl } = artifact.data
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [loadingText, setLoadingText] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Extract display information
  const displayInfo = getFileDisplayInfo(artifact)

  // Load text content for text files
  useEffect(() => {
    if (viewerType === 'text' && fileUrl && !textContent) {
      setLoadingText(true)
      fetch(fileUrl)
        .then(response => response.text())
        .then(text => {
          setTextContent(text)
          setLoadingText(false)
        })
        .catch(error => {
          console.error('Failed to load text content:', error)
          setTextContent('Failed to load file content.')
          setLoadingText(false)
        })
    }
  }, [viewerType, fileUrl, textContent])

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
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-600" />
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
          <div className="flex items-center justify-center min-h-[400px] bg-gray-50">
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

      case 'pdf':
        return (
          <div className="min-h-[500px] bg-gray-100">
            <iframe
              src={fileUrl}
              className="w-full h-full min-h-[500px] border-0"
              title={fileName}
            />
          </div>
        )

      case 'text':
        return (
          <div className="min-h-[400px] bg-gray-50 overflow-auto">
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

      case 'office':
        return (
          <div className="min-h-[400px] flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <File className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-sm font-medium mb-2">{fileName}</p>
              <p className="text-xs text-gray-500 mb-4">
                Office documents require external application to view
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

      default:
        return (
          <div className="min-h-[400px] flex items-center justify-center bg-gray-50">
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
    <div className={`bg-white border rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          {getFileIcon()}
          <div>
            <h3 className="font-medium text-sm">{displayInfo.title}</h3>
            <p className="text-xs text-gray-500">{displayInfo.subtitle}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* File metadata */}
          <Badge variant="outline" className="text-xs">
            <HardDrive className="w-3 h-3 mr-1" />
            {displayInfo.sizeFormatted}
          </Badge>
          
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
                console.log('Add reference:', referenceText)
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
      <div ref={contentRef}>
        {renderFileContent()}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-3 border-t bg-gray-50 text-xs text-gray-500">
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