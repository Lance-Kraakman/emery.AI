'use client';

import React from 'react';
import { Loader2, Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  className?: string;
}

export function SaveStatusIndicator({ status, className }: SaveStatusIndicatorProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs transition-opacity duration-200',
        className
      )}
    >
      {status === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="h-3 w-3 text-success" />
          <span className="text-muted-foreground">Saved</span>
        </>
      )}
      {status === 'unsaved' && (
        <>
          <Circle className="h-2 w-2 fill-warning text-warning" />
          <span className="text-muted-foreground">Unsaved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <Circle className="h-2 w-2 fill-destructive text-destructive" />
          <span className="text-destructive">Save failed</span>
        </>
      )}
    </div>
  );
}
