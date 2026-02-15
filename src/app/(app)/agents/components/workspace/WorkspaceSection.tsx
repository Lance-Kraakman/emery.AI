'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FolderOpen, File, ChevronRight, ChevronDown, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentStream } from '@/hooks/useAgentStream';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// AIDEV-NOTE: Collapsible workspace section in left panel
// Shows file tree, clicking file triggers onFileSelect callback
// Uses /api/agents/[id]/workspace/browse API
// SSE subscription auto-refreshes on workspace changes

interface WorkspaceSectionProps {
  agentId: number;
  onFileSelect: (path: string) => void;
  selectedFilePath?: string;
}

interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

interface FileTreeNodeProps {
  entry: DirectoryEntry;
  path: string;
  agentId: number;
  onFileClick: (path: string) => void;
  onDeleteFile: (path: string) => void;
  selectedFilePath?: string;
}

function FileTreeNode({ entry, path, agentId, onFileClick, onDeleteFile, selectedFilePath }: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<DirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fullPath = path ? `${path}/${entry.name}` : entry.name;

  const loadChildren = async () => {
    if (entry.type !== 'directory') return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/workspace/browse?path=${encodeURIComponent(fullPath)}`);
      const data = await res.json();
      if (data.success) {
        setChildren(data.data.entries);
      }
    } catch (error) {
      console.error('Failed to load directory:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    if (entry.type === 'directory') {
      if (!isExpanded && children.length === 0) {
        loadChildren();
      }
      setIsExpanded(!isExpanded);
    } else {
      onFileClick(fullPath);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteFile(fullPath);
  };

  return (
    <div className="group">
      <div
        className={cn(
          'w-full flex items-center gap-1 py-0.5 px-1 text-xs rounded transition-colors',
          fullPath === selectedFilePath
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-accent'
        )}
      >
        <button
          onClick={handleClick}
          className="flex-1 flex items-center gap-1 text-left min-w-0"
        >
          {entry.type === 'directory' ? (
            <>
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
              ) : isExpanded ? (
                <ChevronDown className="h-3 w-3 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 flex-shrink-0" />
              )}
              <FolderOpen className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
            </>
          ) : (
            <>
              <span className="w-3 flex-shrink-0" /> {/* Spacer for alignment */}
              <File className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            </>
          )}
          <span className="truncate">{entry.name}</span>
        </button>

        {/* Delete button - visible on hover for files and directories */}
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/20 rounded transition-opacity"
          title={entry.type === 'directory' ? 'Delete folder' : 'Delete file'}
        >
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </button>
      </div>

      {entry.type === 'directory' && isExpanded && (
        <div className="pl-3 border-l border-border ml-2">
          {children.map((child) => (
            <FileTreeNode
              key={`${fullPath}/${child.name}`}
              entry={child}
              path={fullPath}
              agentId={agentId}
              onFileClick={onFileClick}
              onDeleteFile={onDeleteFile}
              selectedFilePath={selectedFilePath}
            />
          ))}
          {children.length === 0 && !isLoading && (
            <div className="text-xs text-muted-foreground py-1 px-2">Empty</div>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkspaceSection({ agentId, onFileSelect, selectedFilePath }: WorkspaceSectionProps) {
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load root directory entries (with loading state - for initial load)
  const loadRoot = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/workspace/browse?path=/`);
      const data = await res.json();
      if (data.success) {
        setEntries(data.data.entries);
      } else {
        setError(data.error || 'Failed to load workspace');
      }
    } catch (err) {
      setError('Failed to load workspace');
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  // Silent refresh - updates entries without showing loading state
  const refreshEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/workspace/browse?path=/`);
      const data = await res.json();
      if (data.success) {
        setEntries(data.data.entries);
      }
    } catch (err) {
      // Silently fail - don't disrupt UI
      console.error('Background workspace refresh failed:', err);
    }
  }, [agentId]);

  // Initial load
  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  // SSE subscription for real-time workspace updates
  useAgentStream(agentId, {
    onWorkspaceUpdate: () => {
      // Refresh file tree when workspace changes (silent refresh)
      refreshEntries();
    },
    onLockChange: (locked) => {
      // Refresh when agent finishes (lock released)
      if (!locked) {
        refreshEntries();
      }
    }
  });

  // Delete file handler
  const handleDeleteFile = async (path: string) => {
    setDeleteTarget(path);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/workspace/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted: [deleteTarget], files: {} })
      });

      const data = await res.json();
      if (data.success) {
        // Refresh the file list
        await loadRoot();
        // Clear selected file if it was deleted
        if (selectedFilePath === deleteTarget) {
          onFileSelect('');
        }
      } else {
        console.error('Failed to delete file:', data.error);
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="px-3 py-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-xs">
          <FolderOpen className="h-3.5 w-3.5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-xs">
          <FolderOpen className="h-3.5 w-3.5" />
          <span>Workspace is empty</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-2 py-1 max-h-48 overflow-y-auto">
        {entries.map((entry) => (
          <FileTreeNode
            key={`/${entry.name}`}
            entry={entry}
            path=""
            agentId={agentId}
            onFileClick={onFileSelect}
            onDeleteFile={handleDeleteFile}
            selectedFilePath={selectedFilePath}
          />
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-mono text-foreground">{deleteTarget}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
