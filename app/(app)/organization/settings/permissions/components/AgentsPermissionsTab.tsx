'use client'

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Bot, Settings, Users, Shield, ChevronDown, ChevronRight, Loader2, Save } from "lucide-react";
import { getAgents } from "@/app/actions/agents";
import { getAllAgentPermissionsForOrganization, updateAgentPermissions } from "@/app/actions/agent-permissions";
import type { AgentDTO } from "@/app/mappers/agent-mapper";
import type { AgentTaskPermissions } from "@/ddd/application/services/agents/agent-permissions-application-service";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AgentWithPermissions {
  agentId: number;
  agentName: string;
  permissions: AgentTaskPermissions;
  agent?: AgentDTO;
}

export function AgentsPermissionsTab() {
  const [agents, setAgents] = useState<AgentDTO[]>([]);
  const [agentPermissions, setAgentPermissions] = useState<AgentWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgents, setExpandedAgents] = useState<Set<number>>(new Set());
  const [editingAgent, setEditingAgent] = useState<AgentWithPermissions | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [agentsData, permissionsData] = await Promise.all([
        getAgents(),
        getAllAgentPermissionsForOrganization()
      ]);
      
      setAgents(agentsData || []);
      
      if (permissionsData.success && permissionsData.data) {
        // Merge agent data with permissions
        const agentsWithPermissions = permissionsData.data.map(perm => ({
          ...perm,
          agent: agentsData.find(a => a.id === perm.agentId)
        }));
        setAgentPermissions(agentsWithPermissions);
      }
    } catch (error) {
      console.error("Error loading agents data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAgentExpanded = (agentId: number) => {
    const newExpanded = new Set(expandedAgents);
    if (newExpanded.has(agentId)) {
      newExpanded.delete(agentId);
    } else {
      newExpanded.add(agentId);
    }
    setExpandedAgents(newExpanded);
  };

  const getPermissionSummary = (permissions: AgentTaskPermissions): string => {
    const assignment = permissions.assignment || {};
    const parts: string[] = [];

    if (assignment.allowOrgAdmins) parts.push("Org Admins");
    if (assignment.allowTeamMembers) parts.push("Team Members");
    if (assignment.allowOrgMembers) parts.push("Org Members");
    if (assignment.allowedUsers?.length) parts.push(`${assignment.allowedUsers.length} Users`);
    if (assignment.allowedAgents?.length) parts.push(`${assignment.allowedAgents.length} Agents`);
    if (assignment.allowedTeams?.length) parts.push(`${assignment.allowedTeams.length} Teams`);

    return parts.length > 0 ? parts.join(", ") : "Owner Only";
  };

  const getRoutingSummary = (permissions: AgentTaskPermissions): string => {
    const routing = permissions.routing || {};
    const parts: string[] = [];

    if (routing.allowAnyOrgAgent) parts.push("Any Org Agent");
    if (routing.allowAnyTeamAgent) parts.push("Team Agents");
    if (routing.allowCrossTeamRouting) parts.push("Cross-Team");
    if (routing.allowedAgents?.length) parts.push(`${routing.allowedAgents.length} Agents`);
    if (routing.allowedTeams?.length) parts.push(`${routing.allowedTeams.length} Teams`);

    return parts.length > 0 ? parts.join(", ") : "No Routing";
  };

  const handleSavePermissions = async (agentId: number, permissions: AgentTaskPermissions) => {
    setSaveLoading(true);
    try {
      const result = await updateAgentPermissions(agentId, permissions);
      if (result.success) {
        await loadData(); // Refresh data
        setEditingAgent(null);
      } else {
        console.error("Failed to update permissions:", result.error);
      }
    } catch (error) {
      console.error("Error updating permissions:", error);
    } finally {
      setSaveLoading(false);
    }
  };

  const renderPermissionEditor = (agentWithPerms: AgentWithPermissions) => {
    const [editPermissions, setEditPermissions] = useState<AgentTaskPermissions>(agentWithPerms.permissions);

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

    return (
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Permissions: {agentWithPerms.agentName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Task Assignment Permissions */}
          <div>
            <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Who can assign tasks to this agent
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowOrgAdmins"
                  checked={editPermissions.assignment?.allowOrgAdmins || false}
                  onCheckedChange={(checked) => updateAssignmentPermission('allowOrgAdmins', checked)}
                />
                <label htmlFor="allowOrgAdmins" className="text-sm">
                  Organization admins can assign tasks
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowTeamMembers"
                  checked={editPermissions.assignment?.allowTeamMembers || false}
                  onCheckedChange={(checked) => updateAssignmentPermission('allowTeamMembers', checked)}
                />
                <label htmlFor="allowTeamMembers" className="text-sm">
                  Team members can assign tasks
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowOrgMembers"
                  checked={editPermissions.assignment?.allowOrgMembers || false}
                  onCheckedChange={(checked) => updateAssignmentPermission('allowOrgMembers', checked)}
                />
                <label htmlFor="allowOrgMembers" className="text-sm">
                  Any organization member can assign tasks
                </label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Task Routing Permissions */}
          <div>
            <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Where this agent can route tasks
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowAnyTeamAgent"
                  checked={editPermissions.routing?.allowAnyTeamAgent || false}
                  onCheckedChange={(checked) => updateRoutingPermission('allowAnyTeamAgent', checked)}
                />
                <label htmlFor="allowAnyTeamAgent" className="text-sm">
                  Can route to other team agents
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowAnyOrgAgent"
                  checked={editPermissions.routing?.allowAnyOrgAgent || false}
                  onCheckedChange={(checked) => updateRoutingPermission('allowAnyOrgAgent', checked)}
                />
                <label htmlFor="allowAnyOrgAgent" className="text-sm">
                  Can route to any organization agent
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowCrossTeamRouting"
                  checked={editPermissions.routing?.allowCrossTeamRouting || false}
                  onCheckedChange={(checked) => updateRoutingPermission('allowCrossTeamRouting', checked)}
                />
                <label htmlFor="allowCrossTeamRouting" className="text-sm">
                  Can route to other teams
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setEditingAgent(null)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleSavePermissions(agentWithPerms.agentId, editPermissions)}
              disabled={saveLoading}
            >
              {saveLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading agents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Agent Task Permissions ({agentPermissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agentPermissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No agents found. Create some agents to manage their permissions!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Assignment Permissions</TableHead>
                  <TableHead>Routing Permissions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentPermissions.map((agentWithPerms) => (
                  <>
                    <TableRow key={agentWithPerms.agentId}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAgentExpanded(agentWithPerms.agentId)}
                        >
                          {expandedAgents.has(agentWithPerms.agentId) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{agentWithPerms.agentName}</div>
                            <div className="text-sm text-muted-foreground">
                              {agentWithPerms.agent?.status === 'active' ? (
                                <Badge variant="outline" className="text-xs">Active</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Inactive</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {agentWithPerms.agent?.ownerId || 'Unknown'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getPermissionSummary(agentWithPerms.permissions)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getRoutingSummary(agentWithPerms.permissions)}</span>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setEditingAgent(agentWithPerms)}
                            >
                              <Settings className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                          </DialogTrigger>
                          {editingAgent?.agentId === agentWithPerms.agentId && renderPermissionEditor(editingAgent)}
                        </Dialog>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Details Row */}
                    {expandedAgents.has(agentWithPerms.agentId) && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/50">
                          <div className="p-4 space-y-4">
                            <div>
                              <h4 className="font-medium mb-2">Assignment Details</h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <strong>Allowed Users:</strong> {agentWithPerms.permissions.assignment?.allowedUsers?.length || 0}
                                </div>
                                <div>
                                  <strong>Allowed Agents:</strong> {agentWithPerms.permissions.assignment?.allowedAgents?.length || 0}
                                </div>
                                <div>
                                  <strong>Allowed Teams:</strong> {agentWithPerms.permissions.assignment?.allowedTeams?.length || 0}
                                </div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium mb-2">Routing Details</h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <strong>Allowed Agents:</strong> {agentWithPerms.permissions.routing?.allowedAgents?.length || 0}
                                </div>
                                <div>
                                  <strong>Allowed Teams:</strong> {agentWithPerms.permissions.routing?.allowedTeams?.length || 0}
                                </div>
                              </div>
                            </div>
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
    </div>
  );
}