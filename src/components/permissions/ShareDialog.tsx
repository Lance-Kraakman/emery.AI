'use client'

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResourceSelector } from "@/app/(app)/organization/settings/permissions/components/ResourceSelector";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { assignResourcePermissions } from "@/app/actions/resource-permissions";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: string;
  resourceId: number;
  resourceName: string;
}

/**
 * ShareDialog - Modal for managing resource-specific permissions
 *
 * Allows granting permissions to users or teams for a specific resource.
 *
 * @example
 * ```tsx
 * <ShareDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   resourceType="app"
 *   resourceId={app.id}
 *   resourceName={app.name}
 * />
 * ```
 */
export function ShareDialog({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  resourceName
}: ShareDialogProps) {
  const [activeTab, setActiveTab] = useState('users');
  const [selectedUsers, setSelectedUsers] = useState<(number | string)[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<(number | string)[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({
    view: true,
    manage: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const result = await assignResourcePermissions({
        resourceType,
        resourceId,
        userIds: selectedUsers,
        teamIds: selectedTeams,
        permissions: Object.keys(selectedPermissions).filter(p => selectedPermissions[p]),
        scope: 'specific'
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to assign permissions');
      }

      toast.success(`Shared ${resourceName} successfully`);
      onOpenChange(false);

      // Reset form
      setSelectedUsers([]);
      setSelectedTeams([]);
      setSelectedPermissions({ view: true, manage: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to share resource");
      console.error("Error sharing resource:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset form
    setSelectedUsers([]);
    setSelectedTeams([]);
    setSelectedPermissions({ view: true, manage: false });
  };

  const canSave = (selectedUsers.length > 0 || selectedTeams.length > 0) &&
    Object.values(selectedPermissions).some(v => v);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share {resourceName}</DialogTitle>
          <DialogDescription>
            Grant access to this {resourceType} by selecting users or teams and choosing their permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Left Side: Select Users/Teams */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Select People or Teams</h3>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="teams">Teams</TabsTrigger>
              </TabsList>
              <TabsContent value="users" className="mt-4">
                <ResourceSelector
                  resourceType="user"
                  selectedResourceIds={selectedUsers}
                  onSelectionChange={setSelectedUsers}
                  className="border-0 shadow-none"
                />
              </TabsContent>
              <TabsContent value="teams" className="mt-4">
                <ResourceSelector
                  resourceType="team"
                  selectedResourceIds={selectedTeams}
                  onSelectionChange={setSelectedTeams}
                  className="border-0 shadow-none"
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Side: Select Permissions */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Permissions</h3>
            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="view"
                  checked={selectedPermissions.view}
                  onCheckedChange={(checked) =>
                    setSelectedPermissions({ ...selectedPermissions, view: checked as boolean })
                  }
                />
                <Label htmlFor="view" className="text-sm font-normal cursor-pointer">
                  <div>
                    <div className="font-medium">View</div>
                    <div className="text-xs text-muted-foreground">
                      Can view this {resourceType}
                    </div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="manage"
                  checked={selectedPermissions.manage}
                  onCheckedChange={(checked) =>
                    setSelectedPermissions({ ...selectedPermissions, manage: checked as boolean })
                  }
                />
                <Label htmlFor="manage" className="text-sm font-normal cursor-pointer">
                  <div>
                    <div className="font-medium">Manage</div>
                    <div className="text-xs text-muted-foreground">
                      Can edit and configure this {resourceType}
                    </div>
                  </div>
                </Label>
              </div>

              {resourceType === 'app' || resourceType === 'page' ? (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="publish"
                    checked={selectedPermissions.publish || false}
                    onCheckedChange={(checked) =>
                      setSelectedPermissions({ ...selectedPermissions, publish: checked as boolean })
                    }
                  />
                  <Label htmlFor="publish" className="text-sm font-normal cursor-pointer">
                    <div>
                      <div className="font-medium">Publish</div>
                      <div className="text-xs text-muted-foreground">
                        Can publish this {resourceType}
                      </div>
                    </div>
                  </Label>
                </div>
              ) : null}

              {resourceType === 'agent' ? (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="execute"
                    checked={selectedPermissions.execute || false}
                    onCheckedChange={(checked) =>
                      setSelectedPermissions({ ...selectedPermissions, execute: checked as boolean })
                    }
                  />
                  <Label htmlFor="execute" className="text-sm font-normal cursor-pointer">
                    <div>
                      <div className="font-medium">Execute</div>
                      <div className="text-xs text-muted-foreground">
                        Can run this agent
                      </div>
                    </div>
                  </Label>
                </div>
              ) : null}
            </div>

            {!canSave && (
              <p className="text-sm text-muted-foreground">
                Select at least one user/team and one permission
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving ? "Sharing..." : "Share"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
