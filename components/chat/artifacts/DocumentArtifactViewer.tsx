/**
 * DocumentArtifactViewer - TipTap document editor/viewer for chat artifacts
 * 
 * Renders TipTap documents with edit capabilities when in edit mode.
 * Uses existing TipTap infrastructure and DocumentFieldValue DTOs.
 * 
 * AIDEV-NOTE: Document artifact viewer using TipTap editor for inline
 * document editing within chat canvas overlay system.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Save, 
  Edit3, 
  Eye, 
  FileText, 
  Clock, 
  User,
  Calendar,
  Hash,
  AtSign
} from 'lucide-react'
import type { DocumentArtifact } from '../types/chat-artifacts'
import { getDocumentDisplayInfo } from '../types/chat-artifacts'
// Note: Old reference search store removed in favor of simplified system

interface DocumentArtifactViewerProps {
  artifact: DocumentArtifact
  onSave?: (content: string, title?: string) => void
  className?: string
}

export function DocumentArtifactViewer({ 
  artifact, 
  onSave,
  className = "" 
}: DocumentArtifactViewerProps) {
  const { documentField, mode } = artifact.data
  const [isEditing, setIsEditing] = useState(mode === 'edit')
  const [documentTitle, setDocumentTitle] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [content, setContent] = useState('')

  // Extract display information
  const displayInfo = getDocumentDisplayInfo(artifact)

  // Initialize content and title
  useEffect(() => {
    // Set title from artifact display info
    setDocumentTitle(displayInfo.title)

    // For TipTap documents, try to parse content
    if (documentField.documentMetadata?.documentType === 'tiptap') {
      // AIDEV-TODO: Load actual TipTap content from file URL or S3
      // For now, show placeholder content
      setContent('<p>Loading document content...</p>')
    } else {
      // For non-TipTap documents, show document info
      setContent(`<p><em>Document: ${documentField.name}</em></p><p>Type: ${documentField.mimeType}</p>`)
    }
  }, [documentField, displayInfo.title])

  // Configure TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing your document...'
      }),
      Image,
      Link.configure({
        openOnClick: false
      }),
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell
    ],
    content: content,
    editable: isEditing,
    onUpdate: ({ editor }) => {
      const newContent = editor.getHTML()
      setContent(newContent)
      setHasChanges(true)
    }
  })

  // Update editor content when content changes
  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content)
    }
  }, [editor, content])

  // Update editor editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing)
    }
  }, [editor, isEditing])

  // Handle save
  const handleSave = useCallback(() => {
    if (editor && onSave) {
      const currentContent = editor.getHTML()
      onSave(currentContent, documentTitle)
      setHasChanges(false)
    }
  }, [editor, onSave, documentTitle])

  // Handle mode toggle
  const toggleMode = () => {
    if (isEditing && hasChanges) {
      handleSave()
    }
    setIsEditing(!isEditing)
  }

  return (
    <div className={`bg-white border rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-medium text-sm">{displayInfo.title}</h3>
            <p className="text-xs text-gray-500">{displayInfo.subtitle}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Document metadata */}
          {displayInfo.wordCount && (
            <Badge variant="outline" className="text-xs">
              <Hash className="w-3 h-3 mr-1" />
              {displayInfo.wordCount} words
            </Badge>
          )}
          
          {displayInfo.readTime && (
            <Badge variant="outline" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              {displayInfo.readTime} min read
            </Badge>
          )}
          
          {/* Mode toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleMode}
            className="text-xs"
          >
            {isEditing ? (
              <>
                <Eye className="w-3 h-3 mr-1" />
                View
              </>
            ) : (
              <>
                <Edit3 className="w-3 h-3 mr-1" />
                Edit
              </>
            )}
          </Button>
          
          {/* Reference button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Insert document reference into chat
              const docName = artifact.data.documentField.name
              const referenceText = `@doc:${docName}`
              
              // TODO: Implement reference button functionality with new simplified system
              console.log('Add reference:', referenceText)
            }}
            className="text-xs"
            title="Add document reference to chat"
          >
            <AtSign className="w-3 h-3 mr-1" />
            Reference
          </Button>
          
          {/* Save button */}
          {isEditing && hasChanges && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              className="text-xs"
            >
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="min-h-[400px]">
        {documentField.documentMetadata?.documentType === 'tiptap' ? (
          // TipTap editor for editable documents
          <div className={`prose prose-sm max-w-none p-4 ${isEditing ? 'min-h-[400px]' : ''}`}>
            <EditorContent 
              editor={editor} 
              className={isEditing ? 'focus:outline-none' : 'cursor-default'}
            />
          </div>
        ) : (
          // Static content for non-TipTap documents
          <div className="p-4 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm font-medium mb-1">{documentField.name}</p>
            <p className="text-xs mb-3">{documentField.mimeType}</p>
            <p className="text-xs">
              This document type cannot be edited inline.
            </p>
            {artifact.data.fileUrl && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => window.open(artifact.data.fileUrl, '_blank')}
              >
                Open External
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-3 border-t bg-gray-50 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          {displayInfo.version && (
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              v{displayInfo.version}
            </span>
          )}
          
          {documentField.uploadedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(documentField.uploadedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span>Table {artifact.data.tableId} • Field {artifact.data.fieldId}</span>
        </div>
      </div>
    </div>
  )
}

// AIDEV-NOTE: This component provides inline TipTap document editing within
// the chat artifact system, maintaining consistency with existing domain DTOs
// and providing seamless integration with the LlamaIndex chat-ui canvas.