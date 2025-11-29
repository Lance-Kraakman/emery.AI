/**
 * MarkdownViewer - Markdown viewer/editor for chat artifacts
 *
 * Uses @llamaindex/chat-ui DocumentEditor (MDXEditor-based) for WYSIWYG editing
 * and Markdown component for rendered view.
 *
 * Supports saving:
 * - Files with rowId: Directly saves to existing row via PUT /api/files/[fileId]/content
 * - Files without rowId: Shows SaveToDatabaseDialog to select target table/row
 *
 * AIDEV-NOTE: Markdown artifact viewer using MDXEditor for rich editing
 * via @llamaindex/chat-ui for consistent chat experience.
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
  Save,
  Edit2,
  Eye,
  Database,
} from 'lucide-react'
import { DocumentEditor, Markdown } from '@llamaindex/chat-ui/widgets'
import type { FileArtifact } from '../types/chat-artifacts'
import { getFileDisplayInfo } from '../types/chat-artifacts'
import { createDebugLogger } from '@/lib/utils/debug-logger'
import { SaveToDatabaseDialog } from './SaveToDatabaseDialog'

const logger = createDebugLogger('MarkdownViewer')

interface MarkdownViewerProps {
  artifact: FileArtifact
  onClose?: () => void
  onSave?: (content: string) => Promise<void>
  className?: string
}

export function MarkdownViewer({
  artifact,
  onClose,
  onSave,
  className = ''
}: MarkdownViewerProps) {
  const { fileField, fileName, fileUrl, tableId, fieldId, rowId } = artifact.data
  const [content, setContent] = useState<string>('')
  const [originalContent, setOriginalContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  const displayInfo = getFileDisplayInfo(artifact)

  // Determine if file has existing row context
  const hasRowContext = Boolean(rowId)

  // Load file content
  useEffect(() => {
    if (fileUrl) {
      setLoading(true)
      fetch(fileUrl)
        .then(response => response.text())
        .then(text => {
          setContent(text)
          setOriginalContent(text)
          setLoading(false)
        })
        .catch(error => {
          logger.error('Failed to load markdown content', error)
          setContent('# Failed to load file content')
          setLoading(false)
        })
    }
  }, [fileUrl])

  // Track changes
  useEffect(() => {
    setHasChanges(content !== originalContent)
  }, [content, originalContent])

  // Handle content change
  const handleChange = useCallback((newContent: string) => {
    setContent(newContent)
  }, [])

  // Save file content to existing row via API
  const saveToExistingRow = useCallback(async () => {
    if (!hasChanges || !rowId) return

    setSaving(true)
    try {
      const response = await fetch(`/api/files/${fileField.id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          tableId,
          fieldId,
          rowId
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to save file')
      }

      setOriginalContent(content)
      setHasChanges(false)
      logger.debug('Markdown saved to existing row successfully')
    } catch (error) {
      logger.error('Failed to save markdown to existing row', error)
      throw error
    } finally {
      setSaving(false)
    }
  }, [content, hasChanges, rowId, fileField.id, tableId, fieldId])

  // Handle save button click
  const handleSave = useCallback(async () => {
    if (!hasChanges) return

    if (hasRowContext) {
      // Save directly to existing row
      await saveToExistingRow()
    } else {
      // Show dialog to select where to save
      setShowSaveDialog(true)
    }
  }, [hasChanges, hasRowContext, saveToExistingRow])

  // Handle save to database (from dialog)
  const handleSaveToDatabase = useCallback(async (
    targetTableId: number,
    targetFieldId: number,
    targetRowId?: string
  ) => {
    setSaving(true)
    try {
      if (targetRowId) {
        // Add to existing row - upload file then update row
        const formData = new FormData()
        const blob = new Blob([content], { type: fileField.mimeType })
        formData.append('file', blob, fileName)
        formData.append('organizationId', '0') // Will be set by server from session
        formData.append('tableId', targetTableId.toString())
        formData.append('fieldName', targetFieldId.toString())

        // Upload file
        const uploadResponse = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData
        })

        const uploadResult = await uploadResponse.json()
        if (!uploadResult.data) {
          throw new Error(uploadResult.error || 'Failed to upload file')
        }

        // TODO: Add file to existing row's file field array
        logger.debug('File uploaded, need to add to row', { targetRowId, uploadResult })
      } else {
        // Create new row with file
        const formData = new FormData()
        const blob = new Blob([content], { type: fileField.mimeType })
        formData.append('file', blob, fileName)
        formData.append('organizationId', '0') // Will be set by server from session
        formData.append('tableId', targetTableId.toString())
        formData.append('fieldName', targetFieldId.toString())

        const uploadResponse = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData
        })

        const uploadResult = await uploadResponse.json()
        if (!uploadResult.data) {
          throw new Error(uploadResult.error || 'Failed to upload file')
        }

        logger.debug('File saved to new location', { uploadResult })
      }

      setOriginalContent(content)
      setHasChanges(false)
      setShowSaveDialog(false)
    } catch (error) {
      logger.error('Failed to save file to database', error)
      throw error
    } finally {
      setSaving(false)
    }
  }, [content, fileName, fileField.mimeType])

  // Handle download
  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [content, fileName])

  // Handle external open
  const handleExternalOpen = useCallback(() => {
    window.open(fileUrl, '_blank')
  }, [fileUrl])

  // Toggle edit mode
  const toggleEditMode = useCallback(() => {
    setIsEditing(prev => !prev)
  }, [])

  return (
    <div className={`h-full flex flex-col bg-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/10">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate">{displayInfo.title}</h3>
            <p className="text-xs text-muted-foreground truncate">
              Markdown • {displayInfo.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* File metadata */}
          <Badge variant="outline" className="text-xs flex-shrink-0">
            <HardDrive className="w-3 h-3 mr-1" />
            {displayInfo.sizeFormatted}
          </Badge>

          {/* Edit indicator */}
          {hasChanges && (
            <Badge variant="secondary" className="text-xs">
              Unsaved
            </Badge>
          )}

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

          {/* Editor controls */}
          <div className="flex items-center gap-1 border-l pl-2 ml-2">
            {/* Edit/View toggle */}
            <Button
              variant={isEditing ? 'secondary' : 'ghost'}
              size="sm"
              onClick={toggleEditMode}
              className="text-xs"
              title={isEditing ? 'View mode' : 'Edit mode'}
            >
              {isEditing ? (
                <>
                  <Eye className="w-3 h-3 mr-1" />
                  View
                </>
              ) : (
                <>
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </>
              )}
            </Button>

            {/* Save button - shows for files with row context */}
            {hasRowContext && hasChanges && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="text-xs"
              >
                <Save className="w-3 h-3 mr-1" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            )}

            {/* Save to Database button - shows for files without row context */}
            {!hasRowContext && hasChanges && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowSaveDialog(true)}
                disabled={saving}
                className="text-xs"
              >
                <Database className="w-3 h-3 mr-1" />
                {saving ? 'Saving...' : 'Save to DB'}
              </Button>
            )}

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

      {/* Markdown Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-gray-500">Loading markdown...</div>
          </div>
        ) : isEditing ? (
          <div className="h-full">
            <DocumentEditor
              content={content}
              onChange={handleChange}
              showToolbar={true}
              className="h-full"
            />
          </div>
        ) : (
          <div className="p-4 prose prose-sm max-w-none">
            <Markdown content={content} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-3 border-t border-border bg-muted/10 text-xs text-muted-foreground flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(fileField.uploadedAt).toLocaleDateString()}
          </span>
          <span>{fileField.mimeType}</span>
        </div>

        <div className="flex items-center gap-2">
          <span>Table {artifact.data.tableId} • Field {artifact.data.fieldId}</span>
          {rowId && <span> • Row {rowId}</span>}
        </div>
      </div>

      {/* Save to Database Dialog */}
      <SaveToDatabaseDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSaveToDatabase}
        fileName={fileName}
        fileType={fileField.mimeType}
      />
    </div>
  )
}
