'use client';

import { ReactNode, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

// AIDEV-NOTE: Generic form dialog component to reduce duplication across form dialogs
// Provides consistent error handling, loading states, and dialog structure

interface GenericFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onSubmit?: (formData: FormData) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  submitLabel?: string;
  cancelLabel?: string;
  submitVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "success";
  maxWidth?: string;
  hideButtons?: boolean; // For custom button implementations
}

export function GenericFormDialog({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  onSubmit,
  isLoading = false,
  error,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  submitVariant = 'default',
  maxWidth = 'max-w-md',
  hideButtons = false,
}: GenericFormDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = isLoading || internalLoading;

  const handleSubmit = async (formData: FormData) => {
    if (!onSubmit || loading) return;
    
    try {
      setInternalLoading(true);
      await onSubmit(formData);
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={maxWidth}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {children}

          {!hideButtons && (
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                {cancelLabel}
              </Button>
              <Button
                type="submit"
                variant={submitVariant}
                disabled={loading}
              >
                {loading ? 'Saving...' : submitLabel}
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}