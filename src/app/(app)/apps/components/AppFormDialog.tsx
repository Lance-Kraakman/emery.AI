'use client';

import React, { useState, useEffect } from 'react';
import type { AppDTO } from '@/app/mappers/puck-app-mapper';
import { useForm } from '@tanstack/react-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createApp, updateApp, generateAppSlug } from '@/app/actions/puck-apps';
import { appsActions } from '@/stores/apps.store';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface AppFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  app?: AppDTO;
}

export function AppFormDialog({ isOpen, onClose, app }: AppFormDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!app;

  const form = useForm({
    defaultValues: {
      name: app?.name || '',
      slug: app?.slug || '',
      description: app?.description || '',
    },
    onSubmit: async ({ value }) => {
      try {
        setIsSubmitting(true);
        setError(null);

        const result = isEditMode
          ? await updateApp({ id: app.id, ...value })
          : await createApp(value);

        if (!result.success) {
          setError(result.error || 'Failed to save app');
          toast.error(result.error || "Failed to save app");
          return;
        }

        toast.success(isEditMode ? "App updated successfully" : "App created successfully");

        // Update store
        if (isEditMode && result.data) {
          appsActions.updateApp(app.id, result.data);
        } else if (result.data) {
          appsActions.addApp(result.data);
        }

        onClose();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  // Auto-generate slug from name when creating new app
  const handleNameChange = async (name: string) => {
    form.setFieldValue('name', name);

    if (!isEditMode && name) {
      // Generate slug from name
      try {
        const result = await generateAppSlug(name);
        if (result.success && result.data?.slug) {
          form.setFieldValue('slug', result.data.slug);
        }
      } catch (error) {
        console.error('Error generating slug:', error);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit App' : 'Create App'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update app details' : 'Create a new visual page builder app'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-6 pr-4"
          >
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}

            {/* Name Field */}
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) =>
                  !value ? 'App name is required' : undefined,
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={field.state.value}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="My App"
                  />
                  {field.state.meta.errors && (
                    <p className="text-sm text-destructive">
                      {field.state.meta.errors.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            {/* Slug Field */}
            <form.Field
              name="slug"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return 'Slug is required';
                  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(value)) {
                    return 'Slug must start with a letter, contain only lowercase letters, numbers, and hyphens, and end with a letter or number';
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="slug">
                    Slug <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="slug"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="my-app"
                  />
                  <p className="text-xs text-muted-foreground">
                    Unique identifier for the app. Only lowercase letters, numbers, and hyphens.
                  </p>
                  {field.state.meta.errors && (
                    <p className="text-sm text-destructive">
                      {field.state.meta.errors.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            {/* Description Field */}
            <form.Field name="description">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="A brief description of the app..."
                    rows={3}
                  />
                </div>
              )}
            </form.Field>
          </form>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={() => form.handleSubmit()}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? 'Update' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
