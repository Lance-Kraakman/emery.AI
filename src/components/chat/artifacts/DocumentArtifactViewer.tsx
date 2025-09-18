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

import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
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
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  Palette,
  X
} from 'lucide-react'
import type { DocumentArtifact } from '../types/chat-artifacts'
import { getDocumentDisplayInfo } from '../types/chat-artifacts'
import { fetchTiptapDocumentContent, updateTiptapDocumentContent } from '@/src/app/actions/artifacts'
import styles from './DocumentArtifactViewer.module.css'

interface DocumentArtifactViewerProps {
  artifact: DocumentArtifact
  onSave?: (content: string, title?: string) => void
  onClose?: () => void
  className?: string
}

export function DocumentArtifactViewer({
  artifact,
  onSave,
  onClose,
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
  const [isUpdatingEditor, setIsUpdatingEditor] = useState(false)

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
  }, [
    documentField.id,
    artifact.data.tableId,
    artifact.data.fieldId,
    artifact.data.organizationId,
    loadAttempts,
    isLoadingContent,
    contentLoaded,
    documentField.documentMetadata?.documentType
  ])

  // Create a stable document key for comparison
  const documentKey = useMemo(() =>
    `${documentField.id}-${artifact.data.tableId}-${artifact.data.fieldId}`,
    [documentField.id, artifact.data.tableId, artifact.data.fieldId]
  )

  // Reset content loaded flag when document changes
  useEffect(() => {
    setContentLoaded(false)
    setLoadAttempts(0)
    setContent('<p>Loading document content...</p>')
  }, [documentKey])

  // Configure TipTap editor with StarterKit and additional extensions
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing your document...',
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
        includeChildren: false,
        emptyEditorClass: 'is-editor-empty',
        emptyNodeClass: 'is-empty'
      }),
      Image,
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      Underline, // This might cause the warning, but it's functional
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      })
    ],
    content: '<p>Loading document content...</p>', // Use stable initial content
    editable: isEditing,
    immediatelyRender: false, // Fix SSR hydration mismatch
    onUpdate: ({ editor }) => {
      // Prevent circular updates by checking if we're currently updating
      if (!isUpdatingEditor) {
        // Get JSON content from editor to maintain TipTap format
        const newContent = editor.getJSON()
        setContent(newContent)
        setHasChanges(true)
      }
    }
  }, [isEditing]) // Only recreate when editing state changes

  // Update editor content when content changes (prevent circular updates)
  useEffect(() => {
    if (editor && content && contentLoaded && !isUpdatingEditor) {
      setIsUpdatingEditor(true)

      try {
        // For string content (error messages), compare with HTML
        if (typeof content === 'string') {
          const currentHTML = editor.getHTML()
          if (currentHTML !== content) {
            editor.commands.setContent(content, { emitUpdate: false })
          }
        } else if (content && typeof content === 'object' && content.type === 'doc') {
          // For JSON content (TipTap documents), check if content actually differs
          const currentJSON = editor.getJSON()

          // Force update when content is first loaded (contentLoaded just became true)
          // Use HTML comparison as a safer approach
          const currentHTML = editor.getHTML();
          const isFirstLoad = contentLoaded && !currentHTML.includes('Loading document content...');

          // Simple text-based comparison for content changes
          const currentText = JSON.stringify(currentJSON)
          const newText = JSON.stringify(content)
          const contentDiffers = currentText !== newText

          const shouldUpdate = (
            !currentJSON ||
            currentJSON.type !== content.type ||
            !currentJSON.content ||
            contentDiffers ||
            isFirstLoad
          )

          if (shouldUpdate) {
            editor.commands.setContent(content, { emitUpdate: false })
          }
        }
      } finally {
        // Reset the updating flag after a short delay to allow editor to settle
        setTimeout(() => setIsUpdatingEditor(false), 100)
      }
    }
  }, [editor, content, contentLoaded])

  // Update editor editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing)
    }
  }, [editor, isEditing])

  // Handle save
  const handleSave = useCallback(async () => {
    if (editor) {
      try {
        // Get TipTap JSON content
        const tiptapContent = editor.getJSON()

        // Call the update action
        const result = await updateTiptapDocumentContent(
          documentField.id,
          artifact.data.organizationId,
          artifact.data.tableId,
          artifact.data.fieldId,
          tiptapContent
        )

        if (result.success) {
          setHasChanges(false)

          // Call the onSave callback if provided
          if (onSave) {
            onSave(JSON.stringify(tiptapContent), documentTitle)
          }
        } else {
          console.error('Failed to save document:', result.error)
        }
      } catch (error) {
        console.error('Error saving document:', error)
      }
    }
  }, [editor, onSave, documentTitle, documentField.id, artifact.data])

  // Handle mode toggle
  const toggleMode = () => {
    if (isEditing && hasChanges) {
      handleSave()
    }
    setIsEditing(!isEditing)
  }

  return (
    <div className={`${styles.editorContainer} ${className}`}>
      {/* Streamlined Header */}
      <div className={styles.documentHeader}>
        <div className={styles.documentTitle}>
          <FileText className={styles.documentIcon} />
          <div className="space-y-1">
            <h3 className={styles.titleText}>{displayInfo.title}</h3>
            <div className="flex items-center gap-2">
              <p className={styles.subtitleText}>application/vnd.tiptap+json</p>
              <span className="text-primary-foreground/40">•</span>
              <span className={`${styles.subtitleText} ${isEditing ? 'text-accent-foreground bg-accent/20 px-2 py-0.5 rounded-full text-xs' : ''}`}>
                {isEditing ? 'editing' : 'viewing'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          {/* Document metadata badges */}
          <div className="flex items-center gap-2">
            {displayInfo.wordCount && (
              <Badge variant="outline" className={`text-xs ${styles.documentBadge}`}>
                <Hash className="w-3 h-3 mr-1" />
                {displayInfo.wordCount} words
              </Badge>
            )}

            {hasChanges && (
              <Badge variant="outline" className="text-xs border-accent/50 bg-accent/10 text-accent-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-accent mr-1.5"></span>
                unsaved
              </Badge>
            )}
          </div>

          {/* Always show Save button for immediate access */}
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            className={`text-xs ${styles.saveButton} ${styles.actionButton} ${hasChanges ? 'ring-2 ring-accent/30' : ''}`}
            disabled={!hasChanges}
          >
            <Save className="w-3 h-3 mr-1" />
            Save {hasChanges && <span className="ml-1 text-xs opacity-75">(⌘S)</span>}
          </Button>

          {/* Close button */}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className={`text-xs ${styles.actionButton} ml-2`}
              title="Close document (Esc)"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className={styles.editorWrapper}>
        {documentField.documentMetadata?.documentType === 'tiptap' ? (
          // TipTap editor for editable documents
          <>
            {editor ? (
              <>
                {/* Comprehensive TipTap Toolbar */}
                {isEditing && (
                  <div className={styles.toolbar}>
                    <div className={styles.toolbarButtons}>
                      {/* Undo/Redo */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        className={styles.toolbarButton}
                      >
                        <Undo className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        className={styles.toolbarButton}
                      >
                        <Redo className="w-4 h-4" />
                      </Button>

                      <div className={styles.toolbarSeparator} />

                      {/* Headings */}
                      <Button
                        variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        className={styles.toolbarButton}
                      >
                        H1
                      </Button>
                      <Button
                        variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={styles.toolbarButton}
                      >
                        H2
                      </Button>
                      <Button
                        variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        className={styles.toolbarButton}
                      >
                        H3
                      </Button>

                      <div className={styles.toolbarSeparator} />

                      {/* Text Formatting */}
                      <Button
                        variant={editor.isActive('bold') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={styles.toolbarButton}
                      >
                        <Bold className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive('italic') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={styles.toolbarButton}
                      >
                        <Italic className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive('underline') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        className={styles.toolbarButton}
                      >
                        <UnderlineIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive('strike') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        className={styles.toolbarButton}
                      >
                        <Strikethrough className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive('code') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleCode().run()}
                        className={styles.toolbarButton}
                      >
                        <Code className="w-4 h-4" />
                      </Button>

                      <div className={styles.toolbarSeparator} />

                      {/* Lists */}
                      <Button
                        variant={editor.isActive('bulletList') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={styles.toolbarButton}
                      >
                        <List className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive('orderedList') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={styles.toolbarButton}
                      >
                        <ListOrdered className="w-4 h-4" />
                      </Button>

                      <div className={styles.toolbarSeparator} />

                      {/* Alignment */}
                      <Button
                        variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                        className={styles.toolbarButton}
                      >
                        <AlignLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                        className={styles.toolbarButton}
                      >
                        <AlignCenter className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                        className={styles.toolbarButton}
                      >
                        <AlignRight className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive({ textAlign: 'justify' }) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                        className={styles.toolbarButton}
                      >
                        <AlignJustify className="w-4 h-4" />
                      </Button>

                      <div className={styles.toolbarSeparator} />

                      {/* Quote and Code Block */}
                      <Button
                        variant={editor.isActive('blockquote') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        className={styles.toolbarButton}
                      >
                        <Quote className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={editor.isActive('codeBlock') ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        className={styles.toolbarButton}
                      >
                        <Code className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {/* Editor Content Area - Must be flex-1 to fill remaining space */}
                <div
                  className="flex-1 flex flex-col overflow-hidden"
                  onClick={(e) => {
                    // Focus editor when clicking anywhere in the editor area
                    if (editor && isEditing) {
                      editor.commands.focus('end')
                    }
                  }}
                >
                  <div className={styles.tiptapEditor}>
                    <EditorContent
                      editor={editor}
                      className={`${isEditing ? 'focus:outline-none' : 'cursor-default'} h-full`}
                    />
                  </div>
                </div>
                {/* Show placeholder for empty documents in view mode */}
                {!isEditing && editor.isEmpty && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground italic">This document is empty</p>
                      <p className="text-xs text-muted-foreground/60">Switch to edit mode to add content</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 border border-dashed border-border rounded-lg bg-muted/20">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Editor not initialized</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Please refresh the page if this persists</p>
                </div>
              </div>
            )}
          </>
        ) : (
          // Static content for non-TipTap documents
          <div className="p-8 text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <FileText className="w-16 h-16 text-muted-foreground/40" />
              <div className="space-y-2">
                <p className="text-base font-medium text-foreground">{documentField.name}</p>
                <p className="text-sm text-muted-foreground">{documentField.mimeType}</p>
                <p className="text-xs text-muted-foreground/80 max-w-xs">
                  This document type cannot be edited inline. Use the external viewer to access content.
                </p>
              </div>
              {artifact.data.fileUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className={`mt-4 ${styles.actionButton}`}
                  onClick={() => window.open(artifact.data.fileUrl, '_blank')}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Open External
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

// AIDEV-NOTE: This component provides inline TipTap document editing within
// the chat artifact system, maintaining consistency with existing domain DTOs
// and providing seamless integration with the LlamaIndex chat-ui canvas.