'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EntityMultiSelect, type EntityOption } from './EntityMultiSelect';
import { PermissionPresets } from './PermissionPresets';
import { getOrganizationMembers } from "@/app/actions/invitations";
import { getAgents } from "@/app/actions/agents";
import { getTeams } from "@/app/actions/teams";
import type { AgentTaskPermissions } from "@/ddd/application/services/agents/agent-permissions-application-service";

interface AgentPermissionEditorProps {
  agentId: number;
  agentName: string;
  initialPermissions: AgentTaskPermissions;
  onSave: (agentId: number, permissions: AgentTaskPermissions) => Promise<void>;
  onCancel: () => void;
  saveLoading: boolean;
}

export function AgentPermissionEditor({
  agentId,
  agentName,
  initialPermissions,
  onSave,
  onCancel,
  saveLoading
}: AgentPermissionEditorProps) {
  const [editPermissions, setEditPermissions] = useState<AgentTaskPermissions>(initialPermissions);

  const updateAssignmentPermission = (key: keyof NonNullable<AgentTaskPermissions['assignment']>, value: any) => {
    setEditPermissions(prev => ({
      ...prev,
      assignment: {
        ...prev.assignment,
        [key]: value
      }
    }));
  };

  const updateRoutingPermission = (key: keyof NonNullable<AgentTaskPermissions['routing']>, value: any) => {
    setEditPermissions(prev => ({
      ...prev,
      routing: {
        ...prev.routing,
        [key]: value
      }
    }));
  };

  // Entity fetcher functions
  const fetchUsers = async (): Promise<EntityOption[]> => {
    try {
      const members = await getOrganizationMembers();
      return members.map(member => ({
        id: member.id,
        name: member.name || member.email || 'Unknown User',
        type: 'user' as const,
        status: member.systemRole,
        description: member.email
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  };

  const fetchAgents = async (): Promise<EntityOption[]> => {
    try {
      const agents = await getAgents();
      return agents
        .filter(agent => agent.id !== agentId) // Exclude current agent
        .map(agent => ({
          id: agent.id,
          name: agent.name,
          type: 'agent' as const,
          status: agent.status,
          description: agent.description
        }));
    } catch (error) {
      console.error('Error fetching agents:', error);
      return [];
    }
  };

  const fetchTeams = async (): Promise<EntityOption[]> => {
    try {
      const teams = await getTeams();
      return teams.map(team => ({
        id: team.id,
        name: team.name,
        type: 'team' as const,
        status: 'active',
        description: team.description || undefined
      }));
    } catch (error) {
      console.error('Error fetching teams:', error);
      return [];
    }
  };

  const handleApplyPreset = (preset: AgentTaskPermissions) => {
    setEditPermissions(preset);
  };

  return (
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit Permissions: {agentName}</DialogTitle>
      </DialogHeader>
      
      <div className="space-y-6">
        {/* Permission Presets */}
        <PermissionPresets
          type="agent"
          currentPermissions={editPermissions}
          onApplyPreset={handleApplyPreset}
        />
        {/* Task Assignment Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Who can assign tasks to this agent?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Role-based permissions */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowOrgAdmins"
                  checked={editPermissions.assignment?.allowOrgAdmins || false}
                  onCheckedChange={(checked) => updateAssignmentPermission('allowOrgAdmins', checked)}
                />
                <Label htmlFor="allowOrgAdmins" className="cursor-pointer text-sm">
                  Organization admins
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowTeamMembers"
                  checked={editPermissions.assignment?.allowTeamMembers || false}
                  onCheckedChange={(checked) => updateAssignmentPermission('allowTeamMembers', checked)}
                />
                <Label htmlFor="allowTeamMembers" className="cursor-pointer text-sm">
                  Team members
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowOrgMembers"
                  checked={editPermissions.assignment?.allowOrgMembers || false}
                  onCheckedChange={(checked) => updateAssignmentPermission('allowOrgMembers', checked)}
                />
                <Label htmlFor="allowOrgMembers" className="cursor-pointer text-sm">
                  Any organization member
                </Label>
              </div>
            </div>

            <Separator />

            {/* Specific entity permissions */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Specific Users</Label>
                <EntityMultiSelect
                  entityType="user"
                  selectedIds={editPermissions.assignment?.allowedUsers || []}
                  onSelectionChange={(selectedIds) => updateAssignmentPermission('allowedUsers', selectedIds)}
                  placeholder="Select specific users..."
                  fetchOptions={fetchUsers}
                />
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Specific Agents</Label>
                <EntityMultiSelect
                  entityType="agent"
                  selectedIds={editPermissions.assignment?.allowedAgents || []}
                  onSelectionChange={(selectedIds) => updateAssignmentPermission('allowedAgents', selectedIds)}
                  placeholder="Select specific agents..."
                  fetchOptions={fetchAgents}
                />
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Specific Teams</Label>
                <EntityMultiSelect
                  entityType="team"
                  selectedIds={editPermissions.assignment?.allowedTeams || []}
                  onSelectionChange={(selectedIds) => updateAssignmentPermission('allowedTeams', selectedIds)}
                  placeholder="Select specific teams..."
                  fetchOptions={fetchTeams}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Routing Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Where can this agent route tasks?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* General routing permissions */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowAnyTeamAgent"
                  checked={editPermissions.routing?.allowAnyTeamAgent || false}
                  onCheckedChange={(checked) => updateRoutingPermission('allowAnyTeamAgent', checked)}
                />
                <Label htmlFor="allowAnyTeamAgent" className="cursor-pointer text-sm">
                  Any agent in the same team
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowAnyOrgAgent"
                  checked={editPermissions.routing?.allowAnyOrgAgent || false}
                  onCheckedChange={(checked) => updateRoutingPermission('allowAnyOrgAgent', checked)}
                />
                <Label htmlFor="allowAnyOrgAgent" className="cursor-pointer text-sm">
                  Any agent in the organization
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowCrossTeamRouting"
                  checked={editPermissions.routing?.allowCrossTeamRouting || false}
                  onCheckedChange={(checked) => updateRoutingPermission('allowCrossTeamRouting', checked)}
                />
                <Label htmlFor="allowCrossTeamRouting" className="cursor-pointer text-sm">
                  Cross-team routing
                </Label>
              </div>
            </div>

            <Separator />

            {/* Specific routing targets */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Specific Agents</Label>
                <EntityMultiSelect
                  entityType="agent"
                  selectedIds={editPermissions.routing?.allowedAgents || []}
                  onSelectionChange={(selectedIds) => updateRoutingPermission('allowedAgents', selectedIds)}
                  placeholder="Select specific agents for routing..."
                  fetchOptions={fetchAgents}
                />
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Specific Teams</Label>
                <EntityMultiSelect
                  entityType="team"
                  selectedIds={editPermissions.routing?.allowedTeams || []}
                  onSelectionChange={(selectedIds) => updateRoutingPermission('allowedTeams', selectedIds)}
                  placeholder="Select specific teams for routing..."
                  fetchOptions={fetchTeams}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={() => onSave(agentId, editPermissions)}
          disabled={saveLoading}
        >
          {saveLoading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </DialogContent>
  );
}