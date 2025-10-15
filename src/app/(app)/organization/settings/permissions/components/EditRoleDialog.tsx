'use client'

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Settings } from "lucide-react";
import { getAvailablePermissions, getRoleDetails, updateCustomRole, type CustomRole } from "@/app/actions/roles";
import { PermissionSelector, type PermissionAssignment } from "./PermissionSelector";

interface EditRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: CustomRole;
  onSuccess: () => void;
}

export function EditRoleDialog({ open, onOpenChange, role, onSuccess }: EditRoleDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionAssignment[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Array<{
    id: number;
    resource: string;
    action: string;
    description: string | null;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && role) {
      loadRoleData();
      loadAvailablePermissions();
      setError("");
    }
  }, [open, role]);

  const loadRoleData = async () => {
    try {
      setDetailsLoading(true);
      const roleDetails = await getRoleDetails(role.id);
      
      if (roleDetails) {
        setName(roleDetails.name);
        setDescription(roleDetails.description || "");

        // Convert existing permissions to PermissionAssignment format
        // For now, we'll default to 'all' scope since we don't have resource scope info from the backend yet
        const permissionAssignments: PermissionAssignment[] = roleDetails.permissions?.map(p => {
          const getResourceType = (resource: string): 'agent' | 'team' | 'user' | null => {
            switch (resource.toLowerCase()) {
              case 'agents': return 'agent';
              case 'teams': return 'team';
              case 'users': return 'user';
              default: return null;
            }
          };

          return {
            permissionId: p.id,
            resourceType: getResourceType(p.resource),
            resourceScope: 'all' as const,
            resourceIds: undefined
          };
        }) || [];

        setSelectedPermissions(permissionAssignments);
      }
    } catch (error) {
      console.error("Error loading role details:", error);
      setError("Failed to load role details");
    } finally {
      setDetailsLoading(false);
    }
  };

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
      formData.append("roleId", role.id.toString());
      formData.append("name", name.trim());
      formData.append("description", description.trim());
      formData.append("permissionAssignments", JSON.stringify(selectedPermissions));

      const result = await updateCustomRole(formData);

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || "Failed to update role");
      }
    } catch (error) {
      console.error("Error updating role:", error);
      setError("Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  const isSystemRole = role?.isSystem;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Edit Role: {role?.name}
          </DialogTitle>
          <DialogDescription>
            {isSystemRole ? (
              <span className="text-yellow-600">
                This is a system role and cannot be modified.
              </span>
            ) : (
              "Update the role name, description, and permissions."
            )}
          </DialogDescription>
        </DialogHeader>

        {isSystemRole ? (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 text-sm">
                System roles are predefined by the application and cannot be modified. 
                You can view their permissions but cannot change them.
              </p>
            </div>
            
            {detailsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">Loading role details...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Role Name</Label>
                  <Input value={role.name} disabled />
                </div>
                
                <div>
                  <Label>Description</Label>
                  <Textarea value={role.description || "System-defined role"} disabled rows={3} />
                </div>

                <div>
                  <Label>Permissions ({selectedPermissions.length})</Label>
                  {permissionsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Loading permissions...
                    </div>
                  ) : (
                    <PermissionSelector
                      availablePermissions={availablePermissions}
                      selectedPermissions={selectedPermissions}
                      onSelectionChange={() => {}} // No-op for system roles
                      disabled={true}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {detailsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">Loading role details...</span>
              </div>
            ) : (
              <>
                {/* Basic Information */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-role-name">Role Name *</Label>
                    <Input
                      id="edit-role-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Content Editor, Project Manager"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-role-description">Description</Label>
                    <Textarea
                      id="edit-role-description"
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
                        Updating...
                      </>
                    ) : (
                      <>
                        <Settings className="w-4 h-4 mr-2" />
                        Update Role
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}