'use client'

import { useForm } from '@tanstack/react-form';
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import { createCustomRole } from "@/app/actions/roles";
import { CompactPermissionList } from "./CompactPermissionList";
import type { PermissionAssignment } from "./PermissionSelector";

interface CreateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateRoleDialog({ open, onOpenChange, onSuccess }: CreateRoleDialogProps) {
  const [error, setError] = useState("");

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      selectedPermissions: [] as PermissionAssignment[],
    },
    onSubmit: async ({ value }) => {
      try {
        setError('');
        
        const formData = new FormData();
        formData.append('name', value.name.trim());
        formData.append('description', value.description.trim());
        formData.append('permissionAssignments', JSON.stringify(value.selectedPermissions));

        const result = await createCustomRole(formData);

        if (result.success) {
          onSuccess();
          form.reset();
        } else {
          setError(result.error || 'Failed to create role');
        }
      } catch (error) {
        console.error('Error creating role:', error);
        setError('Failed to create role');
      }
    },
  });

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      form.reset();
      setError('');
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create Custom Role
          </DialogTitle>
          <DialogDescription>
            Create a new role with specific permissions for your organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => !value.trim() ? 'Role name is required' : undefined,
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="role-name">Role Name *</Label>
                  <Input
                    id="role-name"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="e.g., Content Editor, Project Manager"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <div className="text-sm text-destructive">
                      {field.state.meta.errors[0]}
                    </div>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="description">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="role-description">Description</Label>
                  <Textarea
                    id="role-description"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Describe what this role is for and what responsibilities it has..."
                    rows={3}
                  />
                </div>
              )}
            </form.Field>
          </div>

          {/* Permission Selection */}
          <form.Field
            name="selectedPermissions"
          >
            {(field) => (
              <div className="space-y-4">
                <div>
                  <Label>Permissions</Label>
                  <p className="text-sm text-muted-foreground">
                    Select the permissions this role should have (optional).
                  </p>
                </div>

                <CompactPermissionList
                  selectedPermissions={field.state.value}
                  onSelectionChange={(permissions) => field.handleChange(permissions)}
                />
                {field.state.meta.errors.length > 0 && (
                  <div className="text-sm text-destructive">
                    {field.state.meta.errors[0]}
                  </div>
                )}
              </div>
            )}
          </form.Field>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={form.state.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.state.isSubmitting}
            >
              {form.state.isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Role
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}