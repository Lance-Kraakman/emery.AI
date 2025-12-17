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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Crown, Shield, User, Loader2, Eye, Users as TeamIcon } from "lucide-react";
import { getOrganizationMembers, getPendingInvitations, inviteUser } from "@/app/actions/invitations";
import { assignUserRoles } from "@/app/actions/permissions";
import { getOrganizationRolesForSelection, type CustomRole } from "@/app/actions/roles";
import { EntityMultiSelect } from "./EntityMultiSelect";
import type { OrganizationMember } from "@/ddd/domain/organizations/entities/organization";

import type { InvitationDTO } from "@/app/dtos/invitation.dto";


// DTO for UI layer - converts domain OrganizationMember to UI-friendly format
interface OrganizationMemberDTO {
  id: string; // userId.value  
  name: string;
  email: string;
  roles: Array<{id: number; name: string; isSystem: boolean}>; // Multiple roles only
  teams?: string[];
  lastActive?: Date;
}

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

      setMembers([]); // Temporary fix until service is updated
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
              onRoleChange={handleRoleChange}
              availableRoles={availableRoles}
            />
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations ({pendingInvitations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">
                      {invitation.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Role: Member
                    </p>
                  </div>
                  <Badge variant="outline">Pending</Badge>
                </div>
              ))}
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
  onRoleChange: (userId: string, roleIds: number[]) => void;
  availableRoles: Array<{id: number; name: string; description: string; isSystem: boolean}>;
}

function MembersTable({ members, roleUpdating, onRoleChange, availableRoles }: MembersTableProps) {
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
        const roles = member.roles || [];
        
        if (roles.length === 0) {
          return <span className="text-muted-foreground text-sm">No roles assigned</span>;
        }
        
        return (
          <div className="flex gap-1 flex-wrap">
            {roles.map((role) => (
              <Badge 
                key={role.id} 
                variant={role.isSystem ? 'default' : 'secondary'} 
                className="text-xs"
              >
                {role.name}
              </Badge>
            ))}
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Roles',
      cell: ({ row }) => {
        const member = row.original;
        const selectedRoleIds = member.roles?.map(r => r.id) || [];
        
        return (
          <div className="flex items-center gap-2 min-w-[200px]">
            <EntityMultiSelect
              entityType="role"
              selectedIds={selectedRoleIds}
              onSelectionChange={(newIds) => onRoleChange(member.id, newIds as number[])}
              disabled={roleUpdating === member.id}
              placeholder="Select roles..."
              fetchOptions={async () => 
                availableRoles.map(role => ({
                  id: role.id,
                  name: role.name,
                  type: 'role' as const, // Will fix later
                  description: role.description || ''
                }))
              }
            />
            {roleUpdating === member.id && <Loader2 className="w-4 h-4 animate-spin" />}
          </div>
        );
      },
    }),
    columnHelper.accessor('teams', {
      header: 'Teams',
      cell: ({ getValue }) => (
        <div className="flex gap-1 flex-wrap">
          {getValue()?.map((team) => (
            <Badge key={team} variant="outline" className="text-xs">
              {team}
            </Badge>
          )) || (
            <span className="text-muted-foreground text-sm">No teams</span>
          )}
        </div>
      ),
    }),
    columnHelper.accessor('lastActive', {
      header: 'Last Active',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">
          {getValue() ? new Date(getValue()!).toLocaleDateString() : 'Never'}
        </span>
      ),
    }),
  ], [roleUpdating, onRoleChange, availableRoles]);

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