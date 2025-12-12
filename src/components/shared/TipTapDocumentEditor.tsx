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

import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
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
import { fetchTiptapDocumentContent, updateTiptapDocumentContent } from '@/app/actions/artifacts';
import { createDebugLogger } from '@/lib/utils/debug-logger';
import styles from './TipTapDocumentEditor.module.css';

const logger = createDebugLogger('TipTapDocumentEditor');

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
  // Content state
  const [content, setContent] = useState<any>('<p>Loading document content...</p>');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contentLoaded, setContentLoaded] = useState(false);

  // Track whether we've synced the initial content to the editor
  // This prevents cursor reset when user is typing
  const hasInitializedEditor = useRef(false);

  // Save state
  const [hasChanges, setHasChanges] = useState(false);
  const [contentRecentlyChanged, setContentRecentlyChanged] = useState(false);

  // Document key for change detection
  const documentKey = useMemo(() => documentId, [documentId]);

  // Reset when document changes
  useEffect(() => {
    setContentLoaded(false);
    setLoadAttempts(0);
    setContent('<p>Loading document content...</p>');
    setHasChanges(false);
    setContentRecentlyChanged(false);
    hasInitializedEditor.current = false;
  }, [documentKey]);

  // Load document content
  useEffect(() => {
    const loadContent = async () => {
      if (isLoadingContent || contentLoaded || loadAttempts >= 3) return;

      setIsLoadingContent(true);
      setLoadError(null);

      try {
        const result = await fetchTiptapDocumentContent(
          documentId,
          organizationId,
          tableId,
          fieldId
        );

        if (result.success && result.data?.content) {
          const tiptapJson = result.data.content as any;
          if (tiptapJson && typeof tiptapJson === 'object' && tiptapJson.type === 'doc') {
            setContent(tiptapJson);
            setLoadError(null);
            setContentLoaded(true);
          } else {
            setContent('<p>Invalid TipTap document format</p>');
            setLoadError('Invalid document format');
          }
        } else {
          const errorMsg = result.error || 'Document content not available';
          setContent(`<p>Failed to load document: ${errorMsg}</p>`);
          setLoadError(errorMsg);
          setLoadAttempts((prev) => prev + 1);
        }
      } catch (error) {
        logger.error('Error loading TipTap content', error);
        const errorMsg = error instanceof Error ? error.message : 'Error loading document content';
        setContent(`<p>Error loading document content: ${errorMsg}</p>`);
        setLoadError(errorMsg);
        setLoadAttempts((prev) => prev + 1);
        onError?.(error instanceof Error ? error : new Error(errorMsg));
      } finally {
        setIsLoadingContent(false);
      }
    };

    // Add exponential backoff for retries
    const delay = loadAttempts > 0 ? Math.min(1000 * Math.pow(2, loadAttempts - 1), 5000) : 0;
    const timeoutId = setTimeout(loadContent, delay);
    return () => clearTimeout(timeoutId);
  }, [documentId, organizationId, tableId, fieldId, loadAttempts, isLoadingContent, contentLoaded, onError]);

  // Configure TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
        includeChildren: false,
        emptyEditorClass: 'is-editor-empty',
        emptyNodeClass: 'is-empty',
      }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: '<p>Loading document content...</p>',
    editable: allowEdit,
    immediatelyRender: false,
    onUpdate: () => {
      // Don't sync content back to state - this causes cursor reset issues
      // The editor is the source of truth for current content
      // We only track dirty state here
      setHasChanges(true);
      setContentRecentlyChanged(true);
      onContentChange?.(true);
    },
  }, [allowEdit]);

  // Update editor content when loaded (only once per document)
  useEffect(() => {
    // Only sync content to editor once during initial load
    // After that, the editor is the source of truth
    if (editor && content && contentLoaded && !hasInitializedEditor.current) {
      if (typeof content === 'string') {
        editor.commands.setContent(content, { emitUpdate: false });
      } else if (content && typeof content === 'object' && content.type === 'doc') {
        editor.commands.setContent(content, { emitUpdate: false });
      }
      hasInitializedEditor.current = true;
    }
  }, [editor, content, contentLoaded]);

  // Update editor editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(allowEdit);
    }
  }, [editor, allowEdit]);

  // Auto-save interval
  useEffect(() => {
    if (!autoSave) return;

    const saveInterval = setInterval(async () => {
      if (editor && contentRecentlyChanged && allowEdit) {
        try {
          onSaveStart?.();
          const currentContent = editor.getJSON();
          const result = await updateTiptapDocumentContent(
            documentId,
            organizationId,
            tableId,
            fieldId,
            currentContent
          );

          if (result.success) {
            setContentRecentlyChanged(false);
            setHasChanges(false);
            onContentChange?.(false);
            onSaveComplete?.();
          }
        } catch (error) {
          logger.error('Auto-save failed', error);
          onError?.(error instanceof Error ? error : new Error('Auto-save failed'));
        }
      }
    }, autoSaveInterval);

    return () => clearInterval(saveInterval);
  }, [
    editor,
    contentRecentlyChanged,
    allowEdit,
    autoSave,
    autoSaveInterval,
    documentId,
    organizationId,
    tableId,
    fieldId,
    onSaveStart,
    onSaveComplete,
    onContentChange,
    onError,
  ]);

  // Manual save function
  const handleSave = useCallback(async () => {
    if (!editor) return;

    try {
      onSaveStart?.();
      const tiptapContent = editor.getJSON();

      const result = await updateTiptapDocumentContent(
        documentId,
        organizationId,
        tableId,
        fieldId,
        tiptapContent
      );

      if (result.success) {
        setHasChanges(false);
        setContentRecentlyChanged(false);
        onContentChange?.(false);
        onSaveComplete?.();
      } else {
        logger.error('Failed to save document', result.error);
        onError?.(new Error(result.error || 'Failed to save document'));
      }
    } catch (error) {
      logger.error('Error saving document', error);
      onError?.(error instanceof Error ? error : new Error('Failed to save document'));
    }
  }, [editor, documentId, organizationId, tableId, fieldId, onSaveStart, onSaveComplete, onContentChange, onError]);

  // Loading state
  if (isLoadingContent && !contentLoaded) {
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
  if (loadError && loadAttempts >= 3) {
    return (
      <div className={`${styles.editorContainer} ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4 p-8">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{loadError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoadAttempts(0);
                setContentLoaded(false);
              }}
            >
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
            {!contentRecentlyChanged && !hasChanges ? (
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
          <div
            className="flex-1 flex flex-col overflow-hidden"
            onClick={() => {
              if (editor && allowEdit) {
                editor.commands.focus('end');
              }
            }}
          >
            <div className={styles.tiptapEditor}>
              <EditorContent
                editor={editor}
                className={`${allowEdit ? 'focus:outline-none' : 'cursor-default'} h-full`}
              />
            </div>
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
