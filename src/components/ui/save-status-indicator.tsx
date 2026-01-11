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
          <Check className="h-3 w-3 text-emerald-500" />
          <span className="text-muted-foreground">Saved</span>
        </>
      )}
      {status === 'unsaved' && (
        <>
          <Circle className="h-2 w-2 fill-amber-500 text-amber-500" />
          <span className="text-muted-foreground">Unsaved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <Circle className="h-2 w-2 fill-red-500 text-red-500" />
          <span className="text-red-500">Save failed</span>
        </>
      )}
    </div>
  );
}
