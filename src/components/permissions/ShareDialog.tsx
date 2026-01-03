'use client'

import React, { useState, useEffect } from 'react';
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
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Users, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { assignResourcePermissions, getResourceAccessList, removeResourcePermission, type AccessEntry } from "@/app/actions/resource-permissions";

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
  // Outer tabs: Current Access vs Grant Access
  const [mainTab, setMainTab] = useState('current');

  // Grant Access form state
  const [grantTab, setGrantTab] = useState('users');
  const [selectedUsers, setSelectedUsers] = useState<(number | string)[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<(number | string)[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({
    view: true,
    manage: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Current Access state
  const [accessList, setAccessList] = useState<AccessEntry[]>([]);
  const [isLoadingAccess, setIsLoadingAccess] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  // Fetch access list when dialog opens
  useEffect(() => {
    if (open) {
      fetchAccessList();
    }
  }, [open, resourceType, resourceId]);

  const fetchAccessList = async () => {
    setIsLoadingAccess(true);
    try {
      const result = await getResourceAccessList(resourceType, resourceId);
      if (result.success && result.data) {
        setAccessList(result.data);
      } else {
        console.error('Failed to fetch access list:', result.error);
      }
    } catch (error) {
      console.error('Error fetching access list:', error);
    } finally {
      setIsLoadingAccess(false);
    }
  };

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

      // Reset form
      setSelectedUsers([]);
      setSelectedTeams([]);
      setSelectedPermissions({ view: true, manage: false });

      // Refresh access list and switch to Current Access tab
      await fetchAccessList();
      setMainTab('current');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to share resource");
      console.error("Error sharing resource:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAccess = async (entityId: string, entityType: 'user' | 'team') => {
    setIsRemoving(entityId);
    try {
      const result = await removeResourcePermission({
        resourceType,
        resourceId,
        entityType,
        entityId
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to remove access');
      }

      toast.success('Access removed successfully');
      await fetchAccessList();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove access");
      console.error("Error removing access:", error);
    } finally {
      setIsRemoving(null);
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
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Share {resourceName}</DialogTitle>
          <DialogDescription>
            Manage who can access this {resourceType}
          </DialogDescription>
        </DialogHeader>

        {/* Main Tabs: Current Access | Grant Access */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 shrink-0">
            <TabsTrigger value="current" className="gap-2">
              <Users className="h-4 w-4" />
              Current Access
            </TabsTrigger>
            <TabsTrigger value="grant" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Grant Access
            </TabsTrigger>
          </TabsList>

          {/* Current Access Tab */}
          <TabsContent value="current" className="flex-1 overflow-y-auto mt-4 min-h-0">
            {isLoadingAccess ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : accessList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">No one has been granted access yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMainTab('grant')}
                  className="mt-4"
                >
                  Grant Access
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {accessList.map((entry) => (
                  <div
                    key={`${entry.type}-${entry.id}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{entry.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {entry.type}
                        </Badge>
                      </div>
                      <div className="flex gap-1 mt-1">
                        {entry.permissions.map((perm) => (
                          <Badge key={perm} variant="outline" className="text-xs">
                            {perm}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAccess(entry.id, entry.type)}
                      disabled={isRemoving === entry.id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {isRemoving === entry.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Grant Access Tab */}
          <TabsContent value="grant" className="flex-1 flex flex-col mt-4 min-h-0 overflow-hidden">
            <div className="grid grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
              {/* Left Side: Select Users/Teams */}
              <div className="flex flex-col min-h-0 overflow-hidden">
                <h3 className="text-sm font-medium shrink-0 mb-4">Select People or Teams</h3>
                <Tabs value={grantTab} onValueChange={setGrantTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <TabsList className="grid w-full grid-cols-2 shrink-0">
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="teams">Teams</TabsTrigger>
                  </TabsList>
                  <TabsContent value="users" className="mt-4 flex-1 overflow-y-auto min-h-0">
                    <ResourceSelector
                      resourceType="user"
                      selectedResourceIds={selectedUsers}
                      onSelectionChange={setSelectedUsers}
                      className="border-0 shadow-none"
                    />
                  </TabsContent>
                  <TabsContent value="teams" className="mt-4 flex-1 overflow-y-auto min-h-0">
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

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!canSave || isSaving}>
                {isSaving ? "Sharing..." : "Share"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
