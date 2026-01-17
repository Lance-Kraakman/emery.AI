'use client'

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Users, User, X, Eye, Edit, Play, FileText } from "lucide-react";
import { ShareDialog } from "./ShareDialog";
import { useResourcePermission } from "@/hooks/use-resource-permission";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getResourceAccessList, removeResourcePermission } from "@/app/actions/resource-permissions";

interface AccessEntry {
  id: string;
  type: 'user' | 'team';
  name: string;
  permissions: string[];
}

interface PermissionsPanelProps {
  resourceType: string;
  resourceId: number;
  resourceName: string;
}

/**
 * PermissionsPanel - Collapsible panel for resource detail views
 *
 * Shows current access list and allows managing permissions.
 * Read-only mode if user lacks manage permission.
 *
 * @example
 * ```tsx
 * <PermissionsPanel
 *   resourceType="app"
 *   resourceId={app.id}
 *   resourceName={app.name}
 * />
 * ```
 */
export function PermissionsPanel({
  resourceType,
  resourceId,
  resourceName
}: PermissionsPanelProps) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [accessList, setAccessList] = useState<AccessEntry[]>([]);
  const [isLoadingAccess, setIsLoadingAccess] = useState(true);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [accessToRemove, setAccessToRemove] = useState<AccessEntry | null>(null);

  // Check if user has manage permission
  const { hasPermission: canManage, isLoading } = useResourcePermission(
    `${resourceType}s:manage`,
    resourceType,
    resourceId
  );

  // Fetch access list
  const fetchAccessList = async () => {
    setIsLoadingAccess(true);
    try {
      const result = await getResourceAccessList(resourceType, resourceId);

      if (result.success && result.data) {
        setAccessList(result.data);
      } else {
        toast.error(result.error || 'Failed to load access list');
        setAccessList([]);
      }
    } catch (error) {
      console.error('Error fetching access list:', error);
      toast.error('Failed to load access list');
      setAccessList([]);
    } finally {
      setIsLoadingAccess(false);
    }
  };

  // Fetch access list on mount and when resource changes
  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      if (cancelled) return;
      await fetchAccessList();
    }

    fetch();

    return () => {
      cancelled = true;
    };
  }, [resourceType, resourceId]);

  const handleRemoveAccess = (entry: AccessEntry) => {
    setAccessToRemove(entry);
    setRemoveDialogOpen(true);
  };

  const confirmRemoveAccess = async () => {
    if (!accessToRemove) return;

    try {
      const result = await removeResourcePermission({
        resourceType,
        resourceId,
        entityType: accessToRemove.type,
        entityId: accessToRemove.id
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to remove access');
      }

      setAccessList(prev => prev.filter(a => a.id !== accessToRemove.id));
      toast.success(`Removed access for ${accessToRemove.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove access");
      console.error("Error removing access:", error);
    } finally {
      setRemoveDialogOpen(false);
      setAccessToRemove(null);
    }
  };

  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case 'view':
        return <Eye className="w-3 h-3" />;
      case 'manage':
        return <Edit className="w-3 h-3" />;
      case 'execute':
        return <Play className="w-3 h-3" />;
      case 'publish':
        return <FileText className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getPermissionLabel = (permission: string) => {
    return permission.charAt(0).toUpperCase() + permission.slice(1);
  };

  if (isLoading || isLoadingAccess) {
    return (
      <div className="pt-4 border-t">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">Access Control</h3>
        </div>
        <div className="text-sm text-muted-foreground">Loading permissions...</div>
      </div>
    );
  }

  return (
    <>
      <div className="pt-4 border-t">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Access Control</h3>
            <p className="text-xs text-muted-foreground">Manage who can access this {resourceType}</p>
          </div>
          {canManage && (
            <Button
              size="sm"
              onClick={() => setShareDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Access
            </Button>
          )}
        </div>

        {accessList.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No one has been granted access yet</p>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShareDialogOpen(true)}
                className="mt-3"
              >
                <Plus className="w-4 h-4 mr-2" />
                Grant Access
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {accessList.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-2 border rounded hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback>
                      {entry.type === 'team' ? (
                        <Users className="w-3.5 h-3.5" />
                      ) : (
                        <User className="w-3.5 h-3.5" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-sm">{entry.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {entry.permissions.map((permission) => (
                        <Badge
                          key={permission}
                          variant="secondary"
                          className="text-xs h-5 flex items-center gap-1"
                        >
                          {getPermissionIcon(permission)}
                          {getPermissionLabel(permission)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAccess(entry)}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {!canManage && accessList.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
            You need manage permission to modify access
          </p>
        )}
      </div>

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={(open) => {
          setShareDialogOpen(open);
          // Refetch access list when dialog closes (to show newly added permissions)
          if (!open) {
            fetchAccessList();
          }
        }}
        resourceType={resourceType}
        resourceId={resourceId}
        resourceName={resourceName}
      />

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove access for {accessToRemove?.name}?
              They will no longer be able to view or interact with this {resourceType}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveAccess}>
              Remove Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
