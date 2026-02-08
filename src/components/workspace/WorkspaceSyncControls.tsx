'use client';

import React from 'react';
import {
  FolderSync,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  Check,
  Loader2,
  Unplug,
  Lock,
  Wifi,
  WifiOff,
  Eye,
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

interface WorkspaceSyncControlsProps {
  agentId: number;
}

export function WorkspaceSyncControls({ agentId }: WorkspaceSyncControlsProps) {
  const {
    isAvailable,
    isConnected,
    isWatching,
    syncPath,
    syncState,
    error,
    isLocked,
    lockState,
    pendingChanges,
    lastSync,
    selectFolder,
    connect,
    disconnect,
    pull,
    push,
  } = useWorkspaceSync(agentId);

  const [popoverOpen, setPopoverOpen] = React.useState(false);

  if (!isAvailable) {
    return null;
  }

  const isSyncing = syncState === 'syncing';
  const isConnecting = syncState === 'connecting';

  const getStatusIcon = () => {
    if (isConnecting) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (isSyncing) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (isLocked) {
      return <Lock className="h-4 w-4 text-warning" />;
    }
    if (error) {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    if (!isConnected) {
      return <WifiOff className="h-4 w-4 text-muted-foreground" />;
    }
    if (isWatching) {
      return <Eye className="h-4 w-4 text-success" />;
    }
    return <Check className="h-4 w-4 text-success" />;
  };

  const getStatusText = () => {
    if (isConnecting) return 'Connecting...';
    if (isSyncing) return 'Syncing...';
    if (isLocked) return 'Agent working...';
    if (error) return 'Error';
    if (!isConnected) return 'Disconnected';
    if (isWatching) return 'Watching';
    return 'Connected';
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Never';
    const date = new Date(lastSync * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
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
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2"
          disabled={isSyncing || isConnecting}
        >
          {getStatusIcon()}
          <span className="hidden sm:inline">{getStatusText()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)]" align="end">
        <div className="grid gap-4 overflow-hidden">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Workspace Sync</h4>
            <p
              className="text-sm text-muted-foreground truncate max-w-full"
              title={syncPath}
            >
              {syncPath}
            </p>
          </div>

          {/* Status indicators */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="h-3 w-3 text-success" />
              ) : (
                <WifiOff className="h-3 w-3 text-muted-foreground" />
              )}
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="flex items-center gap-2">
              {isWatching ? (
                <Eye className="h-3 w-3 text-success" />
              ) : (
                <Eye className="h-3 w-3 text-muted-foreground" />
              )}
              <span>{isWatching ? 'Watching' : 'Not watching'}</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Lock status */}
          {isLocked && (
            <div className="rounded-md bg-warning/10 p-2 text-sm text-warning flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <div>
                <div>Agent is working</div>
                {lockState?.task_id && (
                  <div className="text-xs opacity-75">
                    Task: {lockState.task_id.slice(0, 8)}...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pending changes */}
          {pendingChanges > 0 && (
            <div className="rounded-md bg-primary/10 p-2 text-sm text-primary">
              {pendingChanges} change{pendingChanges > 1 ? 's' : ''} queued
              (waiting for agent)
            </div>
          )}

          {/* Last sync */}
          <div className="text-xs text-muted-foreground">
            Last sync: {formatLastSync()}
          </div>

          {/* Action buttons */}
          <div className="grid gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pull()}
              disabled={isSyncing || !isConnected}
              className="justify-start gap-2"
            >
              <Download className="h-4 w-4" />
              Pull from remote
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => push()}
              disabled={isSyncing || !isConnected}
              className="justify-start gap-2"
            >
              <Upload className="h-4 w-4" />
              Push to remote
              {isLocked && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Will queue
                </span>
              )}
            </Button>

            {!isConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => connect()}
                disabled={isConnecting}
                className="justify-start gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reconnect
              </Button>
            )}
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
  );
}
