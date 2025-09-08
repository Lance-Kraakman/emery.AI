'use client'

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import { getAvailablePermissions, createCustomRole } from "@/app/actions/roles";
import { PermissionSelector } from "./PermissionSelector";

interface CreateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateRoleDialog({ open, onOpenChange, onSuccess }: CreateRoleDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Array<{
    id: number;
    resource: string;
    action: string;
    description: string | null;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      loadAvailablePermissions();
      // Reset form when dialog opens
      setName("");
      setDescription("");
      setSelectedPermissions([]);
      setError("");
    }
  }, [open]);

  const loadAvailablePermissions = async () => {
    try {
      setPermissionsLoading(true);
      const permissions = await getAvailablePermissions();
      setAvailablePermissions(permissions);
    } catch (error) {
      console.error("Error loading permissions:", error);
      setError("Failed to load available permissions");
    } finally {
      setPermissionsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError("Role name is required");
      return;
    }

    if (selectedPermissions.length === 0) {
      setError("Please select at least one permission");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("description", description.trim());
      formData.append("permissionIds", JSON.stringify(selectedPermissions));

      const result = await createCustomRole(formData);

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || "Failed to create role");
      }
    } catch (error) {
      console.error("Error creating role:", error);
      setError("Failed to create role");
    } finally {
      setLoading(false);
    }
  };

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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name *</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Content Editor, Project Manager"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this role is for and what responsibilities it has..."
                rows={3}
              />
            </div>
          </div>

          {/* Permission Selection */}
          <div className="space-y-4">
            <div>
              <Label>Permissions *</Label>
              <p className="text-sm text-muted-foreground">
                Select the permissions this role should have.
              </p>
            </div>

            {permissionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">Loading permissions...</span>
              </div>
            ) : (
              <PermissionSelector
                availablePermissions={availablePermissions}
                selectedPermissions={selectedPermissions}
                onSelectionChange={setSelectedPermissions}
              />
            )}
          </div>

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
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim() || selectedPermissions.length === 0}
            >
              {loading ? (
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