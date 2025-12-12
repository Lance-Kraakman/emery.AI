/**
 * DocumentArtifactViewer - TipTap document editor/viewer for chat artifacts
 *
 * Renders TipTap documents with edit capabilities when in edit mode.
 * Uses shared TipTapDocumentEditor component for the actual editing.
 *
 * AIDEV-NOTE: Document artifact viewer using TipTap editor for inline
 * document editing within chat canvas overlay system.
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Save,
  FileText,
  Hash,
  X,
  Clock,
} from 'lucide-react';
import type { DocumentArtifact } from '../types/chat-artifacts';
import { getDocumentDisplayInfo } from '../types/chat-artifacts';
import { TipTapDocumentEditor } from '@/components/shared/TipTapDocumentEditor';
import { updateTiptapDocumentContent } from '@/app/actions/artifacts';
import styles from './DocumentArtifactViewer.module.css';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('DocumentArtifactViewer');

interface DocumentArtifactViewerProps {
  artifact: DocumentArtifact;
  onSave?: (content: string, title?: string) => void;
  onClose?: () => void;
  className?: string;
}

export function DocumentArtifactViewer({
  artifact,
  onSave,
  onClose,
  className = '',
}: DocumentArtifactViewerProps) {
  const { documentField, mode } = artifact.data;
  const [isEditing, setIsEditing] = useState(true); // Always start in edit mode
  const [documentTitle, setDocumentTitle] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Extract display information
  const displayInfo = getDocumentDisplayInfo(artifact);

  // Initialize title
  useEffect(() => {
    setDocumentTitle(displayInfo.title);
  }, [displayInfo.title]);

  // Prevent accidental navigation away from unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    if (hasChanges) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [hasChanges]);

  // Check if this is a TipTap document
  const isTipTap =
    documentField.documentMetadata?.documentType === 'tiptap' ||
    documentField.mimeType === 'application/vnd.tiptap+json';

  // Handle content change from editor
  const handleContentChange = useCallback((changed: boolean) => {
    setHasChanges(changed);
  }, []);

  // Handle save complete
  const handleSaveComplete = useCallback(() => {
    setHasChanges(false);
    if (onSave) {
      onSave('', documentTitle);
    }
  }, [onSave, documentTitle]);

  // Handle error
  const handleError = useCallback((error: Error) => {
    logger.error('Editor error', error);
  }, []);

  return (
    <div className={`${styles.editorContainer} ${className}`}>
      {/* Header */}
      <div className={styles.documentHeader}>
        <div className={styles.documentTitle}>
          <FileText className={styles.documentIcon} />
          <div className="space-y-1">
            <h3 className={styles.titleText}>{displayInfo.title}</h3>
            <div className="flex items-center gap-2">
              <p className={styles.subtitleText}>application/vnd.tiptap+json</p>
              <span className="text-primary-foreground/40">•</span>
              <span
                className={`${styles.subtitleText} ${
                  isEditing ? 'text-accent-foreground bg-accent/20 px-2 py-0.5 rounded-full text-xs' : ''
                }`}
              >
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

            {/* Auto-save status */}
            {!hasChanges ? (
              <Badge variant="outline" className="text-xs border-green-500/50 bg-green-50 text-green-700">
                <Clock className="w-3 h-3 mr-1" />
                Auto-saved
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs border-accent/50 bg-accent/10 text-accent-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-accent mr-1.5"></span>
                Unsaved changes
              </Badge>
            )}
          </div>

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
        {isTipTap ? (
          <TipTapDocumentEditor
            documentId={documentField.id}
            organizationId={artifact.data.organizationId}
            tableId={artifact.data.tableId}
            fieldId={artifact.data.fieldId}
            allowEdit={isEditing}
            showToolbar={isEditing}
            autoSave={true}
            autoSaveInterval={3000}
            height="100%"
            onContentChange={handleContentChange}
            onSaveComplete={handleSaveComplete}
            onError={handleError}
            className="border-0 rounded-none"
          />
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
  );
}

// AIDEV-NOTE: This component provides inline TipTap document editing within
// the chat artifact system, maintaining consistency with existing domain DTOs
// and providing seamless integration with the LlamaIndex chat-ui canvas.
