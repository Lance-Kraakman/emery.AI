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
import { AgentPermissionEditor } from './AgentPermissionEditor';
import { CombinedPermissionBadge } from './PermissionLevelBadge';
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
                  <TableHead>Access Level</TableHead>
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
                        <CombinedPermissionBadge 
                          permissions={agentWithPerms.permissions} 
                          compact={true} 
                        />
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setEditingAgent(agentWithPerms)}
                        >
                          <Settings className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Details Row */}
                    {expandedAgents.has(agentWithPerms.agentId) && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/50">
                          <div className="p-4">
                            <CombinedPermissionBadge 
                              permissions={agentWithPerms.permissions} 
                              compact={false} 
                            />
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

      {/* Edit Agent Permissions Dialog */}
      {editingAgent && (
        <Dialog open={!!editingAgent} onOpenChange={() => setEditingAgent(null)}>
          <AgentPermissionEditor
            agentId={editingAgent.agentId}
            agentName={editingAgent.agentName}
            initialPermissions={editingAgent.permissions}
            onSave={handleSavePermissions}
            onCancel={() => setEditingAgent(null)}
            saveLoading={saveLoading}
          />
        </Dialog>
      )}
    </div>
  );
}