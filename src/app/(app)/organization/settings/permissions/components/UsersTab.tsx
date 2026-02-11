'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  createColumnHelper,
  flexRender
} from '@tanstack/react-table';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Loader2 } from "lucide-react";
import { getOrganizationMembers, getPendingInvitations, inviteUser } from "@/app/actions/invitations";
import { assignUserRoles } from "@/app/actions/permissions";
import { getOrganizationRolesForSelection } from "@/app/actions/roles";
import { EntityMultiSelect } from "./EntityMultiSelect";
import { RoleDisplay } from "@/components/ui/RoleDisplay";

import type { InvitationDTO } from "@/app/dtos/invitation.dto";
import { OrganizationMemberDTO } from '@/app/mappers/organization-mapper';

export function UsersTab() {
  const [members, setMembers] = useState<OrganizationMemberDTO[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<InvitationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoles, setInviteRoles] = useState<number[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(true);
  const [availableRoles, setAvailableRoles] = useState<{id: number; name: string; description: string; isSystem: boolean}[]>([]);

  // Batch role assignment state
  const [pendingRoleChanges, setPendingRoleChanges] = useState<Record<string, number[]>>({});
  const hasPendingChanges = Object.keys(pendingRoleChanges).length > 0;

  // Batch role assignment handlers
  const handleRoleSelection = useCallback((userId: string, selectedRoleIds: number[]) => {
    setPendingRoleChanges(prev => ({
      ...prev,
      [userId]: selectedRoleIds
    }));
  }, []);

  const handleApplyAllChanges = useCallback(async () => {
    if (!hasPendingChanges) return;

    try {
      setRoleUpdating('all');

      // Apply changes for all modified users
      const results = await Promise.all(
        Object.entries(pendingRoleChanges).map(async ([userId, roleIds]) => {
          console.log('Applying role changes:', { userId, roleIds });
          const result = await assignUserRoles({ userId, roleIds });
          console.log('Role assignment result:', { userId, result });
          return { userId, result };
        })
      );

      // Check for any failures
      const failures = results.filter(r => !r.result.success);
      if (failures.length > 0) {
        console.error('Some role assignments failed:', failures);
      }

      setPendingRoleChanges({});

      // Refresh the data
      await loadData();
    } catch (error) {
      console.error('Error applying role changes:', error);
    } finally {
      setRoleUpdating(null);
    }
  }, [hasPendingChanges, pendingRoleChanges]);

  const handleDiscardChanges = useCallback(() => {
    setPendingRoleChanges({});
  }, []);

  useEffect(() => {
    loadData();
    
    // Load available roles for EntityMultiSelect
    const loadRoles = async () => {
      try {
        
        const roles = await getOrganizationRolesForSelection();
        setAvailableRoles(roles);
      } catch (error) {
        console.error("Error loading available roles:", error);
      }
    };
    loadRoles();
    
    return () => {
      setIsMounted(false);
    };
  }, []);

  const loadData = async () => {
    try {
      if (!isMounted) return;
      setLoading(true);

      const [membersData, invitationsData] = await Promise.all([
        getOrganizationMembers(),
        getPendingInvitations()
      ]);

      if (!isMounted) return; // Check again after async operations

      setMembers(membersData);
      setPendingInvitations(invitationsData || []);
    } catch (error) {
      console.error("Error loading users data:", error);
      // Only update state if component is still mounted
      if (isMounted) {
        setMembers([]);
        setPendingInvitations([]);
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !isMounted) return;

    setInviteLoading(true);
    try {
      const formData = new FormData();
      formData.append("email", inviteEmail);
      formData.append("roleIds", JSON.stringify(inviteRoles));

      const result = await inviteUser(formData);

      if (!isMounted) return; // Check after async operation

      if (result.success) {
        setInviteEmail("");
        setInviteRoles([]);
        await loadData(); // Refresh data
      } else {
        console.error("Failed to invite user:", result.error);
      }
    } catch (error) {
      console.error("Error inviting user:", error);
    } finally {
      if (isMounted) {
        setInviteLoading(false);
      }
    }
  };

  const handleRoleChange = async (userId: string, roleIds: number[]) => {
    if (!isMounted) return;
    setRoleUpdating(userId);
    try {
      const result = await assignUserRoles({
      userId,
      roleIds: roleIds || []
    });

      if (!isMounted) return; // Check after async operation

      if (result.success) {
        await loadData(); // Refresh data
      } else {
        console.error("Failed to update role:", result.error);
      }
    } catch (error) {
      console.error("Error updating role:", error);
    } finally {
      if (isMounted) {
        setRoleUpdating(null);
      }
    }
  };

  

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invite New User */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Invite New Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInviteUser} className="flex items-center gap-4">
            <Input
              type="email"
              placeholder="user@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="flex-1"
            />
            <EntityMultiSelect
              entityType="role"
              selectedIds={inviteRoles}
              onSelectionChange={(selectedIds) => setInviteRoles(selectedIds as number[])}
              placeholder="Select roles for new member..."
              fetchOptions={async () => 
                availableRoles.map(role => ({
                  id: role.id,
                  name: role.name,
                  type: 'role' as const, // Will fix later
                  description: role.description || ''
                }))
              }
            />
            <Button type="submit" disabled={inviteLoading || !inviteEmail.trim()}>
              {inviteLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Send Invitation"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Organization Members */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No members found. Invite some users to get started!
            </div>
          ) : (
            <MembersTable
              members={members}
              roleUpdating={roleUpdating}
              onRoleSelection={handleRoleSelection}
              pendingRoleChanges={pendingRoleChanges}
              availableRoles={availableRoles}
            />
          )}
        </CardContent>
      </Card>

      {/* Batch Role Operations */}
      {hasPendingChanges && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  Unsaved Role Changes
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  {Object.keys(pendingRoleChanges).length} user(s) have pending role changes.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscardChanges}
                  disabled={roleUpdating === 'all'}
                  className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                >
                  Discard All
                </Button>
                <Button
                  size="sm"
                  onClick={handleApplyAllChanges}
                  disabled={roleUpdating === 'all'}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {roleUpdating === 'all' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Applying...
                    </>
                  ) : (
                    `Apply All Changes (${Object.keys(pendingRoleChanges).length})`
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations ({pendingInvitations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvitations.map((invitation) => {
                // Map roleIds to role objects for display
                const invitationRoles = invitation.roleIds
                  .map(roleId => availableRoles.find(r => r.id === roleId))
                  .filter((r): r is {id: number; name: string; description: string; isSystem: boolean} => r !== undefined)
                  .map(r => ({ id: r.id, name: r.name, isSystem: r.isSystem }));

                return (
                  <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">
                        {invitation.email}
                      </p>
                      <div className="text-sm text-muted-foreground mt-1">
                        <RoleDisplay roles={invitationRoles} variant="text" />
                      </div>
                    </div>
                    <Badge variant="outline">Pending</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// TanStack Table component for members
interface MembersTableProps {
  members: OrganizationMemberDTO[];
  roleUpdating: string | null;
  onRoleSelection?: (userId: string, roleIds: number[]) => void;
  onRoleChange?: (userId: string, roleIds: number[]) => void;
  pendingRoleChanges?: Record<string, number[]>;
  availableRoles: Array<{id: number; name: string; description: string; isSystem: boolean}>;
}

function MembersTable({ members, roleUpdating, onRoleSelection, onRoleChange, pendingRoleChanges = {}, availableRoles }: MembersTableProps) {
  const columnHelper = createColumnHelper<OrganizationMemberDTO>();

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'User',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name || 'Unnamed User'}</div>
          <div className="text-sm text-muted-foreground">{row.original.email}</div>
        </div>
      ),
    }),
    columnHelper.display({
      id: 'assignedRoles',
      header: 'Current Roles',
      cell: ({ row }) => {
        const member = row.original;
        return <RoleDisplay roles={member.roles || []} variant="badge" />;
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Roles',
      cell: ({ row }) => {
        const member = row.original;
        const currentRoleIds = member.roles?.map(r => r.id) || [];
        const pendingRoleIds = pendingRoleChanges[member.userId] || currentRoleIds;
        const hasPendingChanges = pendingRoleChanges[member.userId] !== undefined;

        return (
          <div className="flex items-center gap-2 min-w-[200px]">
            <EntityMultiSelect
              entityType="role"
              selectedIds={pendingRoleIds}
              onBatchApply={(newIds) => onRoleSelection?.(member.userId, newIds as number[])}
              batchMode={true}
              disabled={roleUpdating === member.userId || roleUpdating === 'all'}
              placeholder="Select roles..."
              fetchOptions={async () =>
                availableRoles.map(role => ({
                  id: role.id,
                  name: role.name,
                  type: 'role' as const,
                  description: role.description || ''
                }))
              }
            />

            {hasPendingChanges && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-400">
                Modified
              </Badge>
            )}

            {roleUpdating === member.userId && <Loader2 className="w-4 h-4 animate-spin" />}
          </div>
        );
      },
    }),
  ], [roleUpdating, pendingRoleChanges, onRoleSelection, availableRoles]);

  const table = useReactTable({
    data: members,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
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
  );
}