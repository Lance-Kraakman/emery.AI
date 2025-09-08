'use client'

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Crown, Shield, User, Loader2, Eye, Users as TeamIcon } from "lucide-react";
import { getOrganizationMembers, getPendingInvitations, inviteUser } from "@/app/actions/invitations";
import { assignUserRole } from "@/app/actions/permissions";
import type { OrganizationMember } from "@/ddd/domain/organizations/entities/organization";
import { SYSTEM_ROLES, type SystemRoleType } from "@/ddd/domain/rbac/entities/role";


// DTO for UI layer - converts domain Invitation to UI-friendly format
interface PendingInvitation {
  id: number; // invitationId.value
  email: string; // email.value
  systemRole: SystemRoleType; // Updated to use RBAC system role
  expiresAt?: Date;
}

// DTO for UI layer - converts domain OrganizationMember to UI-friendly format
interface OrganizationMemberDTO {
  id: string; // userId.value  
  name: string;
  email: string;
  systemRole: SystemRoleType | string; // SystemRoleType or error message
  teams?: string[];
  lastActive?: Date;
  hasRoleError?: boolean; // Flag to indicate role loading error
}

export function UsersTab() {
  const [members, setMembers] = useState<OrganizationMemberDTO[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SystemRoleType>(SYSTEM_ROLES.MEMBER);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [membersData, invitationsData] = await Promise.all([
        getOrganizationMembers(),
        getPendingInvitations()
      ]);
      
      setMembers(membersData || []);
      setPendingInvitations(invitationsData || []);
    } catch (error) {
      console.error("Error loading users data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteLoading(true);
    try {
      const formData = new FormData();
      formData.append("email", inviteEmail);
      formData.append("systemRole", inviteRole);
      
      const result = await inviteUser(formData);
      
      if (result.success) {
        setInviteEmail("");
        setInviteRole(SYSTEM_ROLES.MEMBER);
        await loadData(); // Refresh data
      } else {
        console.error("Failed to invite user:", result.error);
      }
    } catch (error) {
      console.error("Error inviting user:", error);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: SystemRoleType) => {
    setRoleUpdating(userId);
    try {
      const result = await assignUserRole(userId, newRole as any);
      if (result.success) {
        await loadData(); // Refresh data
      } else {
        console.error("Failed to update role:", result.error);
      }
    } catch (error) {
      console.error("Error updating role:", error);
    } finally {
      setRoleUpdating(null);
    }
  };

  const getRoleIcon = (role: SystemRoleType | string) => {
    // Handle error case - if role is not a valid SystemRoleType, return default icon
    if (!Object.values(SYSTEM_ROLES).includes(role as SystemRoleType)) {
      return <User className="w-4 h-4" />;
    }
    
    switch (role as SystemRoleType) {
      case SYSTEM_ROLES.ORGANIZATION_OWNER:
        return <Crown className="w-4 h-4" />;
      case SYSTEM_ROLES.ORGANIZATION_ADMIN:
        return <Shield className="w-4 h-4" />;
      case SYSTEM_ROLES.TEAM_LEAD:
        return <TeamIcon className="w-4 h-4" />;
      case SYSTEM_ROLES.MEMBER:
        return <User className="w-4 h-4" />;
      case SYSTEM_ROLES.VIEWER:
        return <Eye className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleBadgeVariant = (role: SystemRoleType | string) => {
    // Handle error case - if role is not a valid SystemRoleType, return default variant
    if (!Object.values(SYSTEM_ROLES).includes(role as SystemRoleType)) {
      return 'outline' as const;
    }
    
    switch (role as SystemRoleType) {
      case SYSTEM_ROLES.ORGANIZATION_OWNER:
        return 'default' as const;
      case SYSTEM_ROLES.ORGANIZATION_ADMIN:
        return 'secondary' as const;
      case SYSTEM_ROLES.TEAM_LEAD:
        return 'destructive' as const;
      case SYSTEM_ROLES.MEMBER:
        return 'outline' as const;
      case SYSTEM_ROLES.VIEWER:
        return 'secondary' as const;
      default:
        return 'outline' as const;
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
            <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as SystemRoleType)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SYSTEM_ROLES.VIEWER}>Viewer</SelectItem>
                <SelectItem value={SYSTEM_ROLES.MEMBER}>Member</SelectItem>
                <SelectItem value={SYSTEM_ROLES.TEAM_LEAD}>Team Lead</SelectItem>
                <SelectItem value={SYSTEM_ROLES.ORGANIZATION_ADMIN}>Organization Admin</SelectItem>
                <SelectItem value={SYSTEM_ROLES.ORGANIZATION_OWNER}>Organization Owner</SelectItem>
              </SelectContent>
            </Select>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Teams</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{member.name || 'Unnamed User'}</div>
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.hasRoleError ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <span className="text-xs">⚠️</span>
                          Error loading role
                        </Badge>
                      ) : (
                        <Badge variant={getRoleBadgeVariant(member.systemRole)} className="flex items-center gap-1 w-fit">
                          {getRoleIcon(member.systemRole)}
                          {member.systemRole}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {member.teams?.map((team) => (
                          <Badge key={team} variant="outline" className="text-xs">
                            {team}
                          </Badge>
                        )) || (
                          <span className="text-muted-foreground text-sm">No teams</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {member.lastActive ? new Date(member.lastActive).toLocaleDateString() : 'Never'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.systemRole}
                        onValueChange={(newRole) => handleRoleChange(member.id, newRole as SystemRoleType)}
                        disabled={roleUpdating === member.id}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SYSTEM_ROLES.VIEWER}>Viewer</SelectItem>
                          <SelectItem value={SYSTEM_ROLES.MEMBER}>Member</SelectItem>
                          <SelectItem value={SYSTEM_ROLES.TEAM_LEAD}>Team Lead</SelectItem>
                          <SelectItem value={SYSTEM_ROLES.ORGANIZATION_ADMIN}>Organization Admin</SelectItem>
                          <SelectItem value={SYSTEM_ROLES.ORGANIZATION_OWNER}>Organization Owner</SelectItem>
                        </SelectContent>
                      </Select>
                      {roleUpdating === member.id && (
                        <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                      Role: {invitation.systemRole || 'Member'}
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