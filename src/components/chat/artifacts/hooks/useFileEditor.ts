import { useState, useEffect, useCallback, useRef } from 'react';

interface UseFileEditorOptions {
  initialContent: string;
  onReset?: () => void;
}

interface UseFileEditorReturn {
  content: string;
  setContent: (content: string) => void;
  originalContent: string;
  hasChanges: boolean;
  markSaved: () => void;
  reset: (newContent?: string) => void;
}

/**
 * Shared hook for file editor change tracking
 * Used by both CodeViewer (table files) and WorkspaceFileViewer (workspace files)
 */
export function useFileEditor({ initialContent, onReset }: UseFileEditorOptions): UseFileEditorReturn {
  const [content, setContent] = useState(initialContent);
  const [originalContent, setOriginalContent] = useState(initialContent);

  // Use ref to avoid requiring callers to memoize the callback
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;

  const hasChanges = content !== originalContent;

  // Reset when initial content changes (e.g., different file selected)
  useEffect(() => {
    setContent(initialContent);
    setOriginalContent(initialContent);
    onResetRef.current?.();
  }, [initialContent]);

  const markSaved = useCallback(() => {
    setOriginalContent(content);
  }, [content]);

  const reset = useCallback((newContent?: string) => {
    const c = newContent ?? initialContent;
    setContent(c);
    setOriginalContent(c);
  }, [initialContent]);

  return { content, setContent, originalContent, hasChanges, markSaved, reset };
}
