'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  createColumnHelper,
  flexRender,
  type ColumnDef
} from '@tanstack/react-table';
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
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    loadRoles();
    return () => {
      setIsMounted(false);
    };
  }, []);

  const loadRoles = async () => {
    try {
      if (!isMounted) return;
      setLoading(true);

      const rolesData = await getOrganizationRoles();

      if (!isMounted) return; // Check again after async operation

      setRoles(rolesData || []);
    } catch (error) {
      console.error("Error loading roles:", error);
      // Only update state if component is still mounted
      if (isMounted) {
        setRoles([]);
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  const handleCreateSuccess = () => {
    if (!isMounted) return;
    setCreateDialogOpen(false);
    loadRoles(); // Refresh roles list
  };

  const handleEditSuccess = () => {
    if (!isMounted) return;
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
    if (!deletingRole || !isMounted) return;

    setDeleteLoading(true);
    try {
      const result = await deleteCustomRole(deletingRole.id);

      if (!isMounted) return; // Check after async operation

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
      if (isMounted) {
        setDeleteLoading(false);
      }
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

  const columnHelper = createColumnHelper<CustomRole>();

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Role',
      cell: ({ row }) => {
        const role = row.original;
        return (
          <div className="flex items-center gap-2">
            <Badge variant={getRoleBadgeVariant(role)} className="flex items-center gap-1 w-fit">
              {getRoleIcon(role)}
              {role.name}
            </Badge>
            {role.isSystem && (
              <Badge variant="secondary" className="text-xs">
                System
              </Badge>
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor('description', {
      header: 'Description',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.description || (row.original.isSystem ? 'System-defined role' : 'Custom role')}
        </span>
      ),
    }),
    columnHelper.accessor('permissionCount', {
      header: 'Permissions',
      cell: ({ getValue }) => (
        <span className="text-sm font-medium">
          {getValue()} permissions
        </span>
      ),
    }),
    columnHelper.accessor('userCount', {
      header: 'Users',
      cell: ({ getValue }) => (
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">{getValue()} users</span>
        </div>
      ),
    }),
    columnHelper.accessor('createdAt', {
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.isSystem ? 'Built-in' : new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const role = row.original;
        return role.isSystem ? (
          <span className="text-sm text-muted-foreground">Not editable</span>
        ) : (
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
        );
      },
    }),
  ], [handleEditRole, handleDeleteRole, getRoleIcon, getRoleBadgeVariant]);

  const table = useReactTable({
    data: roles,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading roles...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unified Roles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Roles ({roles.length})
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                System roles are built-in and cannot be modified. Create custom roles for organization-specific permission sets.
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Role
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No roles found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
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