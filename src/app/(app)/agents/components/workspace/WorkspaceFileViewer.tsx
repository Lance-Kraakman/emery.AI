'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Save, Loader2, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileTypeDetector } from '@/ddd/domain/tables/services/file-type-detector';
import { CodeEditor } from '@llamaindex/chat-ui/widgets';
import { useFileEditor } from '@/components/chat/artifacts/hooks/useFileEditor';
import { EditorHeader } from '@/components/chat/artifacts/EditorHeader';

interface WorkspaceFileViewerProps {
  filePath: string;
  content: string;
  mimeType: string;
  onSave: (content: string) => Promise<void>;
}

/**
 * Workspace file viewer/editor component
 * Shows in RightPanel when a workspace file is selected
 * Uses shared useFileEditor hook and EditorHeader component
 */
export function WorkspaceFileViewer({
  filePath,
  content: initialContent,
  mimeType,
  onSave
}: WorkspaceFileViewerProps) {
  // Use shared hook for change tracking
  const { content, setContent, hasChanges, markSaved } = useFileEditor({
    initialContent,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fileName = filePath.split('/').pop() || 'file';
  const viewerType = FileTypeDetector.detectViewerType(fileName);

  // Detect language for syntax highlighting
  const language = useMemo(() => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript',
      js: 'javascript', jsx: 'javascript',
      py: 'python', json: 'json',
      md: 'markdown', html: 'html',
      css: 'css', sql: 'sql',
      yaml: 'yaml', yml: 'yaml',
      sh: 'bash', bash: 'bash',
    };
    return langMap[ext || ''] || 'text';
  }, [fileName]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(content);
      markSaved();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave, markSaved]);

  // Keyboard shortcut: Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !isSaving) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, isSaving, handleSave]);

  // Clear save error when content changes
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only trigger on content change
  useEffect(() => {
    if (saveError) {
      setSaveError(null);
    }
  }, [content]);

  // Action buttons for header
  const headerActions = (
    <>
      {saveError && (
        <span className="text-xs text-destructive max-w-32 truncate">{saveError}</span>
      )}
      <Button
        size="sm"
        onClick={handleSave}
        disabled={!hasChanges || isSaving}
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4 mr-1" />
        )}
        Save
      </Button>
    </>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Shared header component */}
      <EditorHeader
        title={fileName}
        subtitle={`${language.toUpperCase()} • ${filePath}`}
        icon={<FileCode className="w-5 h-5 text-primary flex-shrink-0" />}
        hasChanges={hasChanges}
        actions={headerActions}
      />

      {/* Editor - CodeMirror height override via Tailwind arbitrary selector */}
      <div className="flex-1 overflow-hidden [&_.cm-editor]:h-full [&_.cm-scroller]:!overflow-auto">
        {viewerType === 'code' || viewerType === 'text' || viewerType === 'markdown' ? (
          <CodeEditor
            code={content}
            onChange={setContent}
            language={language as 'javascript' | 'python' | 'html' | 'css'}
            className="h-full"
          />
        ) : (
          // Fallback for non-editable types
          <div className="p-4 h-full overflow-auto">
            <p className="text-sm text-muted-foreground mb-4">
              Preview not available for this file type. Showing raw content:
            </p>
            <pre className="p-3 bg-muted rounded-md text-xs overflow-auto whitespace-pre-wrap break-words">
              {content}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
