'use client';

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useEditor, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { fetchTiptapDocumentContent, updateTiptapDocumentContent } from '@/app/actions/artifacts';
import { createDebugLogger } from '@/lib/utils/debug-logger';
import { FileAttachment } from './tiptap-extensions/FileAttachmentNode';
import { FileUploadHandler } from './tiptap-extensions/FileUploadHandler';
import { S3Image } from './tiptap-extensions/S3Image';

const logger = createDebugLogger('useTipTapDocument');

export interface UseTipTapDocumentOptions {
  documentId: string;
  organizationId: number;
  tableId: number;
  fieldId: number;
  allowEdit?: boolean;
  autoSave?: boolean;
  autoSaveInterval?: number;
  placeholder?: string;
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onError?: (error: Error) => void;
  onContentChange?: (hasChanges: boolean) => void;
}

export interface UseTipTapDocumentReturn {
  editor: Editor | null;
  isLoading: boolean;
  loadError: string | null;
  hasChanges: boolean;
  isSaved: boolean;
  save: () => Promise<void>;
  retry: () => void;
}

export function useTipTapDocument({
  documentId,
  organizationId,
  tableId,
  fieldId,
  allowEdit = true,
  autoSave = true,
  autoSaveInterval = 3000,
  placeholder = 'Start writing your document...',
  onSaveStart,
  onSaveComplete,
  onError,
  onContentChange,
}: UseTipTapDocumentOptions): UseTipTapDocumentReturn {
  // Content state
  const [content, setContent] = useState<any>('<p>Loading document content...</p>');
  const [isLoading, setIsLoading] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contentLoaded, setContentLoaded] = useState(false);

  // Track whether we've synced the initial content to the editor
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
      if (isLoading || contentLoaded || loadAttempts >= 3) return;

      setIsLoading(true);
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
        setIsLoading(false);
      }
    };

    // Add exponential backoff for retries
    const delay = loadAttempts > 0 ? Math.min(1000 * Math.pow(2, loadAttempts - 1), 5000) : 0;
    const timeoutId = setTimeout(loadContent, delay);
    return () => clearTimeout(timeoutId);
  }, [documentId, organizationId, tableId, fieldId, loadAttempts, isLoading, contentLoaded, onError]);

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
      S3Image,  // Custom image node that stores s3Key for persistence
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      // File attachment support
      FileAttachment,
      FileUploadHandler.configure({
        organizationId,
        tableId,
        fieldId,
        onUploadStart: () => {
          logger.debug('File upload started');
        },
        onUploadComplete: () => {
          logger.debug('File upload completed');
          setHasChanges(true);
          setContentRecentlyChanged(true);
          onContentChange?.(true);
        },
        onUploadError: (errorMsg: string) => {
          logger.error('File upload error:', errorMsg);
          onError?.(new Error(errorMsg));
        },
      }),
    ],
    content: '<p>Loading document content...</p>',
    editable: allowEdit,
    immediatelyRender: false,
    onUpdate: () => {
      // Don't sync content back to state - this causes cursor reset issues
      // The editor is the source of truth for current content
      setHasChanges(true);
      setContentRecentlyChanged(true);
      onContentChange?.(true);
    },
  }, [allowEdit, organizationId, tableId, fieldId]);

  // Update editor content when loaded (only once per document)
  useEffect(() => {
    if (editor && content && contentLoaded && !hasInitializedEditor.current) {
      console.log('[useTipTapDocument] Setting editor content:', JSON.stringify(content));

      if (typeof content === 'string') {
        editor.commands.setContent(content, { emitUpdate: false });
      } else if (content && typeof content === 'object' && content.type === 'doc') {
        editor.commands.setContent(content, { emitUpdate: false });
      }
      hasInitializedEditor.current = true;

      // Log what nodes are in the editor after setting content
      const json = editor.getJSON();
      console.log('[useTipTapDocument] Editor JSON after setContent:', JSON.stringify(json));
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
          console.log('[useTipTapDocument] Auto-save getJSON() result:', JSON.stringify(currentContent));
          // CRITICAL: Use JSON.parse(JSON.stringify()) to create a plain object
          // Next.js server actions can lose nested properties on TipTap objects
          const plainContent = JSON.parse(JSON.stringify(currentContent));
          const result = await updateTiptapDocumentContent(
            documentId,
            organizationId,
            tableId,
            fieldId,
            plainContent
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
  const save = useCallback(async () => {
    if (!editor) return;

    try {
      onSaveStart?.();
      const tiptapContent = editor.getJSON();
      // CRITICAL: Use JSON.parse(JSON.stringify()) to create a plain object
      // Next.js server actions can lose nested properties on TipTap objects
      const plainContent = JSON.parse(JSON.stringify(tiptapContent));

      const result = await updateTiptapDocumentContent(
        documentId,
        organizationId,
        tableId,
        fieldId,
        plainContent
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

  // Retry function
  const retry = useCallback(() => {
    setLoadAttempts(0);
    setContentLoaded(false);
  }, []);

  const isSaved = !contentRecentlyChanged && !hasChanges;

  return {
    editor,
    isLoading: isLoading && !contentLoaded,
    loadError: loadError && loadAttempts >= 3 ? loadError : null,
    hasChanges,
    isSaved,
    save,
    retry,
  };
}
