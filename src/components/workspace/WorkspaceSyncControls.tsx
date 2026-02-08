'use client';

import React, { useEffect } from 'react';
import {
  FolderSync,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  Check,
  Loader2,
  Unplug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useWorkspaceSync } from '@/hooks/useWorkspaceSync';
import { ConflictDialog } from './ConflictDialog';

interface WorkspaceSyncControlsProps {
  agentId: number;
}

export function WorkspaceSyncControls({ agentId }: WorkspaceSyncControlsProps) {
  const {
    isAvailable,
    syncPath,
    status,
    syncState,
    error,
    hasConflict,
    selectFolder,
    checkStatus,
    pull,
    push,
    disconnect,
    resolveConflict,
  } = useWorkspaceSync(agentId);

  const [conflictDialogOpen, setConflictDialogOpen] = React.useState(false);
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  // Check status on mount and when syncPath changes
  useEffect(() => {
    if (syncPath) {
      checkStatus();
    }
  }, [syncPath, checkStatus]);

  // Open conflict dialog when conflict is detected
  useEffect(() => {
    if (hasConflict) {
      setConflictDialogOpen(true);
    }
  }, [hasConflict]);

  if (!isAvailable) {
    return null;
  }

  const isSyncing = syncState === 'syncing';
  const needsSync = status?.needs_pull || status?.needs_push;

  const handlePull = async () => {
    if (hasConflict) {
      setConflictDialogOpen(true);
      return;
    }
    await pull();
  };

  const handlePush = async () => {
    if (hasConflict) {
      setConflictDialogOpen(true);
      return;
    }
    await push();
  };

  const handleResolveConflict = async (resolution: 'keep_local' | 'keep_remote') => {
    await resolveConflict(resolution);
    // Dialog closes itself on success via ConflictDialog's internal state
  };

  const getStatusIcon = () => {
    if (isSyncing) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (hasConflict) {
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    }
    if (error) {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    if (needsSync) {
      return <RefreshCw className="h-4 w-4 text-primary" />;
    }
    return <Check className="h-4 w-4 text-success" />;
  };

  // Not connected - show connect button
  if (!syncPath) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={selectFolder}
              className="h-9 w-9"
            >
              <FolderSync className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Connect local folder for sync</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Connected - show sync controls
  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            disabled={isSyncing}
          >
            {getStatusIcon()}
            <span className="hidden sm:inline">Sync</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Workspace Sync</h4>
              <p className="text-sm text-muted-foreground truncate">
                {syncPath}
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {hasConflict && (
              <div className="rounded-md bg-warning/10 p-2 text-sm text-warning">
                Conflict detected - both local and remote have changes
              </div>
            )}

            <div className="grid gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePull}
                disabled={isSyncing || (!status?.needs_pull && !hasConflict)}
                className="justify-start gap-2"
              >
                <Download className="h-4 w-4" />
                Pull from remote
                {status?.needs_pull && !hasConflict && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    New changes
                  </span>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePush}
                disabled={isSyncing || (!status?.needs_push && !hasConflict)}
                className="justify-start gap-2"
              >
                <Upload className="h-4 w-4" />
                Push to remote
                {status?.needs_push && !hasConflict && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Local changes
                  </span>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => checkStatus()}
                disabled={isSyncing}
                className="justify-start gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh status
              </Button>

            </div>

            <div className="border-t pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  disconnect();
                  setPopoverOpen(false);
                }}
                className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
              >
                <Unplug className="h-4 w-4" />
                Disconnect folder
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <ConflictDialog
        open={conflictDialogOpen}
        onOpenChange={setConflictDialogOpen}
        onResolve={handleResolveConflict}
        localModified={status?.local_modified}
        remoteModified={status?.remote_modified}
      />
    </>
  );
}
