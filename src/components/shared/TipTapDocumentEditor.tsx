'use client';

/**
 * TipTapDocumentEditor - Shared TipTap document editor component
 *
 * Used by:
 * - DocumentArtifactViewer (chat artifacts)
 * - EditorBlock (Puck pages)
 *
 * Handles document loading, editing, and auto-save functionality.
 */

import React from 'react';
import { EditorContent } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  Code,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useTipTapDocument } from './useTipTapDocument';
import styles from './TipTapDocumentEditor.module.css';

export interface TipTapDocumentEditorProps {
  /** Document ID to load/edit */
  documentId: string;
  /** Organization ID for API calls */
  organizationId: number;
  /** Table ID containing the document */
  tableId: number;
  /** Field ID of the document field */
  fieldId: number;
  /** Whether editing is allowed */
  allowEdit?: boolean;
  /** Whether to show the toolbar */
  showToolbar?: boolean;
  /** Whether to auto-save changes */
  autoSave?: boolean;
  /** Auto-save interval in ms */
  autoSaveInterval?: number;
  /** Editor height (CSS value) */
  height?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Callback when save starts */
  onSaveStart?: () => void;
  /** Callback when save completes */
  onSaveComplete?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Callback when content changes */
  onContentChange?: (hasChanges: boolean) => void;
  /** Additional class name */
  className?: string;
}

export function TipTapDocumentEditor({
  documentId,
  organizationId,
  tableId,
  fieldId,
  allowEdit = true,
  showToolbar = true,
  autoSave = true,
  autoSaveInterval = 3000,
  height = '100%',
  placeholder = 'Start writing your document...',
  onSaveStart,
  onSaveComplete,
  onError,
  onContentChange,
  className = '',
}: TipTapDocumentEditorProps) {
  const {
    editor,
    isLoading,
    loadError,
    isSaved,
    retry,
  } = useTipTapDocument({
    documentId,
    organizationId,
    tableId,
    fieldId,
    allowEdit,
    autoSave,
    autoSaveInterval,
    placeholder,
    onSaveStart,
    onSaveComplete,
    onError,
    onContentChange,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className={`${styles.editorContainer} ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="space-y-4 w-full max-w-md p-8">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className={`${styles.editorContainer} ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4 p-8">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" onClick={retry}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.editorContainer} ${className}`} style={{ height }}>
      {/* Toolbar */}
      {showToolbar && allowEdit && editor && (
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

          {/* Save status */}
          <div className="flex items-center gap-2 ml-auto">
            {isSaved ? (
              <Badge variant="outline" className="text-xs border-green-500/50 bg-green-50 text-green-700">
                <Clock className="w-3 h-3 mr-1" />
                Saved
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs border-amber-500/50 bg-amber-50 text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
                Unsaved
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div className={styles.editorWrapper}>
        {editor ? (
          <div className={styles.tiptapEditor}>
            <EditorContent
              editor={editor}
              className={`${allowEdit ? 'focus:outline-none' : 'cursor-default'} h-full`}
            />
          </div>
        ) : (
          <div className="p-8 border border-dashed border-border rounded-lg bg-muted/20">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Editor not initialized</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Please refresh the page if this persists</p>
            </div>
          </div>
        )}

        {/* Empty state for view mode */}
        {!allowEdit && editor?.isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground italic">This document is empty</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TipTapDocumentEditor;
