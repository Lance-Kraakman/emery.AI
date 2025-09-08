'use client'

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, Trash2, Users, Shield, Crown, Loader2 } from "lucide-react";
import { getOrganizationRoles, deleteCustomRole, type CustomRole } from "@/app/actions/roles";
import { CreateRoleDialog } from "./CreateRoleDialog";
import { EditRoleDialog } from "./EditRoleDialog";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

export function RolesTab() {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<CustomRole | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const rolesData = await getOrganizationRoles();
      setRoles(rolesData || []);
    } catch (error) {
      console.error("Error loading roles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    setCreateDialogOpen(false);
    loadRoles(); // Refresh roles list
  };

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    setEditingRole(null);
    loadRoles(); // Refresh roles list
  };

  const handleEditRole = (role: CustomRole) => {
    setEditingRole(role);
    setEditDialogOpen(true);
  };

  const handleDeleteRole = (role: CustomRole) => {
    setDeletingRole(role);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteRole = async () => {
    if (!deletingRole) return;

    setDeleteLoading(true);
    try {
      const result = await deleteCustomRole(deletingRole.id);
      
      if (result.success) {
        setDeleteDialogOpen(false);
        setDeletingRole(null);
        loadRoles(); // Refresh roles list
      } else {
        console.error("Failed to delete role:", result.error);
        // TODO: Add toast notification for error
      }
    } catch (error) {
      console.error("Error deleting role:", error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const getRoleIcon = (role: CustomRole) => {
    if (role.isSystem) {
      // System roles get special icons
      if (role.name.includes("Owner")) {
        return <Crown className="w-4 h-4" />;
      } else if (role.name.includes("Admin")) {
        return <Shield className="w-4 h-4" />;
      }
    }
    return <Settings className="w-4 h-4" />;
  };

  const getRoleBadgeVariant = (role: CustomRole) => {
    if (role.isSystem) {
      return 'secondary' as const;
    }
    return 'outline' as const;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading roles...</span>
      </div>
    );
  }

  const systemRoles = roles.filter(role => role.isSystem);
  const customRoles = roles.filter(role => !role.isSystem);

  return (
    <div className="space-y-6">
      {/* System Roles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            System Roles ({systemRoles.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Built-in roles provided by the system. These cannot be modified.
          </p>
        </CardHeader>
        <CardContent>
          {systemRoles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No system roles found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(role)} className="flex items-center gap-1 w-fit">
                        {getRoleIcon(role)}
                        {role.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {role.description || 'System-defined role'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {role.permissionCount} permissions
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{role.userCount} users</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Custom Roles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Custom Roles ({customRoles.length})
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Organization-specific roles with custom permission sets.
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Role
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {customRoles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No custom roles created yet.</p>
              <p className="text-sm mt-1">Create custom roles to define specific permission sets for your organization.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(role)} className="flex items-center gap-1 w-fit">
                        {getRoleIcon(role)}
                        {role.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {role.description || 'Custom role'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {role.permissionCount} permissions
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{role.userCount} users</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(role.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditRole(role)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRole(role)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Role Dialog */}
      <CreateRoleDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Role Dialog */}
      {editingRole && (
        <EditRoleDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          role={editingRole}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{deletingRole?.name}"? 
              This action cannot be undone.
              {deletingRole?.userCount !== undefined && deletingRole.userCount > 0 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                  ⚠️ This role is currently assigned to {deletingRole.userCount} user(s). 
                  Please reassign these users first.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRole}
              disabled={deleteLoading || (deletingRole?.userCount !== undefined && deletingRole.userCount > 0)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}