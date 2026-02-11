'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Code } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditorHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  hasChanges?: boolean;
  onClose?: () => void;
  actions?: React.ReactNode;  // Slot for custom action buttons
  className?: string;
}

/**
 * Shared header component for file editors
 * Used by both CodeViewer and WorkspaceFileViewer
 */
export function EditorHeader({
  title,
  subtitle,
  icon,
  hasChanges,
  onClose,
  actions,
  className = ''
}: EditorHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between p-3 border-b bg-muted/10', className)}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon || <Code className="w-5 h-5 text-primary flex-shrink-0" />}
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sm truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {hasChanges && (
          <Badge variant="secondary" className="text-xs">Unsaved</Badge>
        )}

        {actions && (
          <div className="flex items-center gap-1 border-l pl-2 ml-2">
            {actions}
          </div>
        )}

        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0 flex-shrink-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
