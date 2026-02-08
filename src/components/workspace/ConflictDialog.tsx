'use client';

import React, { useState } from 'react';
import { AlertTriangle, Download, Upload, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (resolution: 'keep_local' | 'keep_remote') => Promise<void>;
  localModified?: number | null;
  remoteModified?: number | null;
}

function formatTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) return 'Unknown';
  return new Date(timestamp * 1000).toLocaleString();
}

export function ConflictDialog({
  open,
  onOpenChange,
  onResolve,
  localModified,
  remoteModified,
}: ConflictDialogProps) {
  const [resolving, setResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  const handleResolve = async (resolution: 'keep_local' | 'keep_remote') => {
    setResolving(true);
    setResolutionError(null);
    try {
      await onResolve(resolution);
      onOpenChange(false);
    } catch (err) {
      setResolutionError(err instanceof Error ? err.message : 'Resolution failed');
    } finally {
      setResolving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={resolving ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Sync Conflict Detected
          </DialogTitle>
          <DialogDescription>
            Both your local folder and the remote workspace have been modified since the last sync.
            Choose which version to keep.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 font-medium">
                <Upload className="h-4 w-4" />
                Local
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Modified: {formatTimestamp(localModified)}
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 font-medium">
                <Download className="h-4 w-4" />
                Remote
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Modified: {formatTimestamp(remoteModified)}
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Warning: The version you don&apos;t choose will be overwritten.
          </p>

          {resolutionError && (
            <p className="text-sm text-destructive">
              {resolutionError}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={resolving}
            className="sm:order-1"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => handleResolve('keep_remote')}
            disabled={resolving}
            className="gap-2 sm:order-2"
          >
            {resolving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Keep Remote
          </Button>
          <Button
            onClick={() => handleResolve('keep_local')}
            disabled={resolving}
            className="gap-2 sm:order-3"
          >
            {resolving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Keep Local
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
