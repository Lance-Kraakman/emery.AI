'use client';

import React, { useState, useEffect } from 'react';
import { FolderOpen, File, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// AIDEV-NOTE: Collapsible workspace section in left panel
// Shows file tree, clicking file triggers onFileSelect callback
// Uses /api/agents/[id]/workspace/browse API

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
  selectedFilePath?: string;
}

function FileTreeNode({ entry, path, agentId, onFileClick, selectedFilePath }: FileTreeNodeProps) {
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

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-1 py-0.5 px-1 text-xs rounded transition-colors text-left',
          fullPath === selectedFilePath
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-accent'
        )}
      >
        {entry.type === 'directory' ? (
          <>
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <FolderOpen className="h-3.5 w-3.5 text-yellow-500" />
          </>
        ) : (
          <>
            <span className="w-3" /> {/* Spacer for alignment */}
            <File className="h-3.5 w-3.5 text-muted-foreground" />
          </>
        )}
        <span className="truncate">{entry.name}</span>
      </button>

      {entry.type === 'directory' && isExpanded && (
        <div className="pl-3 border-l border-border ml-2">
          {children.map((child) => (
            <FileTreeNode
              key={`${fullPath}/${child.name}`}
              entry={child}
              path={fullPath}
              agentId={agentId}
              onFileClick={onFileClick}
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

  useEffect(() => {
    const loadRoot = async () => {
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
    };

    loadRoot();
  }, [agentId]);

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
    <div className="px-2 py-1 max-h-48 overflow-y-auto">
      {entries.map((entry) => (
        <FileTreeNode
          key={`/${entry.name}`}
          entry={entry}
          path=""
          agentId={agentId}
          onFileClick={onFileSelect}
          selectedFilePath={selectedFilePath}
        />
      ))}
    </div>
  );
}
