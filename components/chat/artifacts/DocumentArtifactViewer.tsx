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

import React, { useCallback, useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
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
  AtSign,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3
} from 'lucide-react'
import type { DocumentArtifact } from '../types/chat-artifacts'
import { getDocumentDisplayInfo } from '../types/chat-artifacts'
import { fetchTiptapDocumentContent } from '@/app/actions/artifacts'

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
  const [isEditing, setIsEditing] = useState(true) // Always start in edit mode
  const [documentTitle, setDocumentTitle] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  // Extract display information
  const displayInfo = getDocumentDisplayInfo(artifact)

  const [content, setContent] = useState<any>('<p>Loading document content...</p>')
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [loadAttempts, setLoadAttempts] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [contentLoaded, setContentLoaded] = useState(false)

  // Initialize title
  useEffect(() => {
    setDocumentTitle(displayInfo.title)
  }, [displayInfo.title])

  // Load TipTap content for TipTap documents
  useEffect(() => {
    const loadContent = async () => {
      if (documentField.documentMetadata?.documentType === 'tiptap' && !isLoadingContent && !contentLoaded && loadAttempts < 3) {
        setIsLoadingContent(true)
        setLoadError(null)

        try {
          const result = await fetchTiptapDocumentContent(
            documentField.id,
            artifact.data.organizationId,
            artifact.data.tableId,
            artifact.data.fieldId
          )

          if (result.success && result.data?.content) {
            // Use the parsed TipTap content directly (no more fetch needed!)
            const tiptapJson = result.data.content as any
            if (tiptapJson && typeof tiptapJson === 'object' && tiptapJson.type === 'doc') {
              // Valid TipTap document - pass JSON object directly to editor
              setContent(tiptapJson)
              setLoadError(null)
              setContentLoaded(true)
            } else {
              setContent('<p>Invalid TipTap document format</p>')
              setLoadError('Invalid document format')
            }
          } else {
            const errorMsg = result.error || 'Document content not available'
            setContent(`<p>Failed to load document: ${errorMsg}</p>`)
            setLoadError(errorMsg)

            // Increment retry counter
            setLoadAttempts(prev => prev + 1)
          }
        } catch (error) {
          console.error('Error loading TipTap content:', error)
          const errorMsg = error instanceof Error ? error.message : 'Error loading document content'
          setContent(`<p>Error loading document content: ${errorMsg}</p>`)
          setLoadError(errorMsg)

          // Increment retry counter
          setLoadAttempts(prev => prev + 1)
        } finally {
          setIsLoadingContent(false)
        }
      } else if (documentField.documentMetadata?.documentType !== 'tiptap') {
        // For non-TipTap documents, show document info
        setContent(`<p><em>Document: ${documentField.name}</em></p><p>Type: ${documentField.mimeType}</p>`)
      } else if (loadAttempts >= 3) {
        setContent('<p>Failed to load document after multiple attempts</p>')
        setLoadError('Maximum retry attempts exceeded')
      }
    }

    // Add exponential backoff for retries
    const delay = loadAttempts > 0 ? Math.min(1000 * Math.pow(2, loadAttempts - 1), 5000) : 0

    const timeoutId = setTimeout(loadContent, delay)
    return () => clearTimeout(timeoutId)
  }, [documentField, artifact.data.tableId, artifact.data.fieldId, artifact.data.organizationId, loadAttempts])

  // Reset content loaded flag when document changes
  useEffect(() => {
    setContentLoaded(false)
    setLoadAttempts(0)
  }, [documentField.id, artifact.data.tableId, artifact.data.fieldId])

  // Configure TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing your document...'
      }),
      Image,
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell
    ],
    content: content,
    editable: isEditing,
    immediatelyRender: false, // Fix SSR hydration mismatch
    onUpdate: ({ editor }) => {
      // Get JSON content from editor to maintain TipTap format
      const newContent = editor.getJSON()
      setContent(newContent)
      setHasChanges(true)
    }
  })

  // Update editor content when content changes
  useEffect(() => {
    if (editor && content) {
      // For string content (error messages), compare with HTML
      if (typeof content === 'string') {
        if (editor.getHTML() !== content) {
          editor.commands.setContent(content)
        }
      } else {
        // For JSON content (TipTap documents), compare JSON structures
        const currentJSON = editor.getJSON()
        if (JSON.stringify(currentJSON) !== JSON.stringify(content)) {
          editor.commands.setContent(content)
        }
      }
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
    <div className={`border border-border rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-medium text-sm text-foreground">{displayInfo.title}</h3>
            <p className="text-xs text-muted-foreground">{displayInfo.subtitle}</p>
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
            {editor ? (
              <div className="relative">
                {/* TipTap Toolbar */}
                {isEditing && (
                  <div className="border-b border-border mb-4 pb-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant={editor.isActive('bold') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                      >
                        <Bold className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive('italic') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                      >
                        <Italic className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                      >
                        <Heading1 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                      >
                        <Heading2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive('bulletList') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                      >
                        <List className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive('orderedList') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                      >
                        <ListOrdered className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive('blockquote') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                      >
                        <Quote className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive('code') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleCode().run()}
                      >
                        <Code className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <EditorContent
                  editor={editor}
                  className={isEditing ? 'focus:outline-none' : 'cursor-default'}
                />
                {/* Show placeholder for empty documents in view mode */}
                {!isEditing && editor.isEmpty && (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <p className="text-sm italic">This document is empty</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 border border-dashed border-gray-300 rounded">
                <p>Editor not initialized</p>
              </div>
            )}
          </div>
        ) : (
          // Static content for non-TipTap documents
          <div className="p-4 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium mb-1 text-foreground">{documentField.name}</p>
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
      <div className="flex items-center justify-between p-3 border-t border-border text-xs text-muted-foreground">
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