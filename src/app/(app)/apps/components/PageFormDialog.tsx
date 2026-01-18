'use client';

import React, { useState, useEffect } from 'react';
import type { PageDTO } from '@/app/mappers/puck-page-mapper';
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
import { createPage, updatePage, generatePageSlug } from '@/app/actions/puck-pages';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PageFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appId: number;
  page?: PageDTO;
  onSuccess?: (page: PageDTO) => void;
}

export function PageFormDialog({ isOpen, onClose, appId, page, onSuccess }: PageFormDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!page;
  const router = useRouter();

  const form = useForm({
    defaultValues: {
      name: '',
      slug: '',
      description: '',
    },
    onSubmit: async ({ value }) => {
      try {
        setIsSubmitting(true);
        setError(null);

        const result = isEditMode
          ? await updatePage({ id: page.id, ...value }, `/apps/${appId}`)
          : await createPage({ appId, ...value }, `/apps/${appId}`);

        if (!result.success) {
          setError(result.error || 'Failed to save page');
          toast.error(result.error || "Failed to save page");
          return;
        }

        toast.success(isEditMode ? "Page updated successfully" : "Page created successfully");

        if (result.data && onSuccess) {
          onSuccess(result.data as PageDTO);
        }

        // Navigate to edit page if creating new page
        if (!isEditMode && result.data) {
          const newPage = result.data as PageDTO;
          router.push(`/apps/${appId}/pages/${newPage.id}/edit`);
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

  // Reset form when page changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset();
      form.setFieldValue('name', page?.name || '');
      form.setFieldValue('slug', page?.slug || '');
      form.setFieldValue('description', page?.description || '');
    }
  }, [page, isOpen]);

  // Auto-generate slug from name when creating new page
  const handleNameChange = async (name: string) => {
    form.setFieldValue('name', name);

    if (!isEditMode && name) {
      // Generate slug from name
      try {
        const result = await generatePageSlug(appId, name);
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
          <DialogTitle>{isEditMode ? 'Edit Page' : 'Create Page'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update page details' : 'Create a new page in your app'}
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
                  !value ? 'Page name is required' : undefined,
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
                    placeholder="Home"
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
                  if (!/^\/[a-z0-9-\/]*[a-z0-9]$/.test(value)) {
                    return 'Slug must start with /, contain only lowercase letters, numbers, hyphens, and forward slashes, and end with a letter or number';
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
                    placeholder="/home"
                  />
                  <p className="text-xs text-muted-foreground">
                    URL path for the page. Must start with / (e.g., /home, /about, /products/item).
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
                    placeholder="A brief description of the page..."
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
            {isEditMode ? 'Update' : 'Create & Edit'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
