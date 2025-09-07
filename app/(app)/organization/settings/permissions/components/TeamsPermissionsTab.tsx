'use client'

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { UsersIcon, Settings, Users, Shield, ChevronDown, ChevronRight, Loader2, Save } from "lucide-react";
import { getTeams, getTeamMembers } from "@/app/actions/teams";
import { getAllTeamPermissionsForOrganization, updateTeamPermissions } from "@/app/actions/team-permissions";
import { TeamPermissionEditor } from './TeamPermissionEditor';
import { CombinedPermissionBadge } from './PermissionLevelBadge';
import type { TeamDTO } from "@/app/mappers/team-mapper";
import type { TeamTaskPermissions } from "@/ddd/application/services/teams/team-permissions-application-service";

interface TeamWithPermissions {
  teamId: number;
  teamName: string;
  permissions: TeamTaskPermissions;
  team?: TeamDTO;
  memberCount?: number;
}

export function TeamsPermissionsTab() {
  const [teams, setTeams] = useState<TeamDTO[]>([]);
  const [teamPermissions, setTeamPermissions] = useState<TeamWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set());
  const [editingTeam, setEditingTeam] = useState<TeamWithPermissions | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [teamsData, permissionsData] = await Promise.all([
        getTeams(),
        getAllTeamPermissionsForOrganization()
      ]);
      
      setTeams(teamsData || []);
      
      if (permissionsData.success && permissionsData.data) {
        // Merge team data with permissions and get member counts
        const teamsWithPermissions = await Promise.all(
          permissionsData.data.map(async (perm) => {
            const team = teamsData.find(t => t.id === perm.teamId);
            let memberCount = 0;
            
            // Get member count for each team
            try {
              const members = await getTeamMembers(perm.teamId);
              memberCount = Array.isArray(members) ? members.length : 0;
            } catch (error) {
              console.error(`Failed to get member count for team ${perm.teamId}:`, error);
            }
            
            return {
              ...perm,
              team,
              memberCount
            };
          })
        );
        setTeamPermissions(teamsWithPermissions);
      }
    } catch (error) {
      console.error("Error loading teams data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTeamExpanded = (teamId: number) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  };

  const getPermissionSummary = (permissions: TeamTaskPermissions): string => {
    const assignment = permissions.assignment || {};
    const parts: string[] = [];

    if (assignment.allowOrgAdmins) parts.push("Org Admins");
    if (assignment.allowTeamMembers) parts.push("Team Members");
    if (assignment.allowOrgMembers) parts.push("Org Members");
    if (assignment.allowedUsers?.length) parts.push(`${assignment.allowedUsers.length} Users`);
    if (assignment.allowedAgents?.length) parts.push(`${assignment.allowedAgents.length} Agents`);
    if (assignment.allowedTeams?.length) parts.push(`${assignment.allowedTeams.length} Teams`);

    return parts.length > 0 ? parts.join(", ") : "Admins Only";
  };

  const getRoutingSummary = (permissions: TeamTaskPermissions): string => {
    const routing = permissions.routing || {};
    const parts: string[] = [];

    if (routing.allowAnyOrgAgent) parts.push("Any Org Agent");
    if (routing.allowCrossTeamRouting) parts.push("Cross-Team");
    if (routing.allowedAgents?.length) parts.push(`${routing.allowedAgents.length} Agents`);
    if (routing.allowedTeams?.length) parts.push(`${routing.allowedTeams.length} Teams`);
    if (routing.internalRoutingStrategy) parts.push(`Internal: ${routing.internalRoutingStrategy}`);

    return parts.length > 0 ? parts.join(", ") : "No Routing";
  };

  const handleSavePermissions = async (teamId: number, permissions: TeamTaskPermissions) => {
    setSaveLoading(true);
    try {
      const result = await updateTeamPermissions(teamId, permissions);
      if (result.success) {
        await loadData(); // Refresh data
        setEditingTeam(null);
      } else {
        console.error("Failed to update permissions:", result.error);
      }
    } catch (error) {
      console.error("Error updating permissions:", error);
    } finally {
      setSaveLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading teams...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5" />
            Team Task Permissions ({teamPermissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teamPermissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No teams found. Create some teams to manage their permissions!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Access Level</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamPermissions.map((teamWithPerms) => (
                  <>
                    <TableRow key={teamWithPerms.teamId}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTeamExpanded(teamWithPerms.teamId)}
                        >
                          {expandedTeams.has(teamWithPerms.teamId) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UsersIcon className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{teamWithPerms.teamName}</div>
                            {teamWithPerms.team?.purpose && (
                              <div className="text-sm text-muted-foreground">
                                {teamWithPerms.team.purpose}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {teamWithPerms.memberCount || 0} members
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <CombinedPermissionBadge 
                          permissions={teamWithPerms.permissions} 
                          compact={true} 
                        />
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setEditingTeam(teamWithPerms)}
                        >
                          <Settings className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Details Row */}
                    {expandedTeams.has(teamWithPerms.teamId) && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/50">
                          <div className="p-4 space-y-4">
                            <CombinedPermissionBadge 
                              permissions={teamWithPerms.permissions} 
                              compact={false} 
                            />
                            {teamWithPerms.team?.description && (
                              <div>
                                <h4 className="font-medium mb-2">Description</h4>
                                <p className="text-sm text-muted-foreground">{teamWithPerms.team.description}</p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Team Permissions Dialog */}
      {editingTeam && (
        <Dialog open={!!editingTeam} onOpenChange={() => setEditingTeam(null)}>
          <TeamPermissionEditor
            teamId={editingTeam.teamId}
            teamName={editingTeam.teamName}
            initialPermissions={editingTeam.permissions}
            onSave={handleSavePermissions}
            onCancel={() => setEditingTeam(null)}
            saveLoading={saveLoading}
          />
        </Dialog>
      )}
    </div>
  );
}