'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, ShieldX, Zap } from "lucide-react";
import type { AgentTaskPermissions } from "@/ddd/application/services/agents/agent-permissions-application-service";
import type { TeamTaskPermissions } from "@/ddd/application/services/teams/team-permissions-application-service";

type PermissionTemplate = {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  permissions: {
    assignment: NonNullable<AgentTaskPermissions['assignment']>;
    routing: NonNullable<AgentTaskPermissions['routing']>;
  };
};

const AGENT_PRESETS: PermissionTemplate[] = [
  {
    id: 'restricted',
    name: 'Restricted',
    description: 'Owner only, no routing to other agents',
    icon: ShieldX,
    color: 'bg-red-100 text-red-800 border-red-200',
    permissions: {
      assignment: {
        allowOrgAdmins: false,
        allowTeamMembers: false,
        allowOrgMembers: false,
        allowedUsers: [],
        allowedAgents: [],
        allowedTeams: []
      },
      routing: {
        allowAnyTeamAgent: false,
        allowAnyOrgAgent: false,
        allowCrossTeamRouting: false,
        allowedAgents: [],
        allowedTeams: []
      }
    }
  },
  {
    id: 'team_only',
    name: 'Team Only',
    description: 'Team members can assign, route within team',
    icon: Shield,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    permissions: {
      assignment: {
        allowOrgAdmins: true,
        allowTeamMembers: true,
        allowOrgMembers: false,
        allowedUsers: [],
        allowedAgents: [],
        allowedTeams: []
      },
      routing: {
        allowAnyTeamAgent: true,
        allowAnyOrgAgent: false,
        allowCrossTeamRouting: false,
        allowedAgents: [],
        allowedTeams: []
      }
    }
  },
  {
    id: 'organization_wide',
    name: 'Organization Wide',
    description: 'Any org member can assign, route anywhere',
    icon: ShieldCheck,
    color: 'bg-green-100 text-green-800 border-green-200',
    permissions: {
      assignment: {
        allowOrgAdmins: true,
        allowTeamMembers: true,
        allowOrgMembers: true,
        allowedUsers: [],
        allowedAgents: [],
        allowedTeams: []
      },
      routing: {
        allowAnyTeamAgent: true,
        allowAnyOrgAgent: true,
        allowCrossTeamRouting: true,
        allowedAgents: [],
        allowedTeams: []
      }
    }
  },
  {
    id: 'admin_only',
    name: 'Admin Only',
    description: 'Only organization admins, flexible routing',
    icon: Zap,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    permissions: {
      assignment: {
        allowOrgAdmins: true,
        allowTeamMembers: false,
        allowOrgMembers: false,
        allowedUsers: [],
        allowedAgents: [],
        allowedTeams: []
      },
      routing: {
        allowAnyTeamAgent: true,
        allowAnyOrgAgent: true,
        allowCrossTeamRouting: true,
        allowedAgents: [],
        allowedTeams: []
      }
    }
  }
];

const TEAM_PRESETS: PermissionTemplate[] = [
  {
    id: 'restricted',
    name: 'Restricted',
    description: 'Owner only, no external routing',
    icon: ShieldX,
    color: 'bg-red-100 text-red-800 border-red-200',
    permissions: {
      assignment: {
        allowOrgAdmins: false,
        allowTeamMembers: false,
        allowOrgMembers: false,
        allowedUsers: [],
        allowedAgents: [],
        allowedTeams: []
      },
      routing: {
        allowAnyOrgAgent: false,
        allowCrossTeamRouting: false,
        allowedAgents: [],
        allowedTeams: []
      }
    }
  },
  {
    id: 'internal_only',
    name: 'Internal Only',
    description: 'Team members can assign, internal routing only',
    icon: Shield,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    permissions: {
      assignment: {
        allowOrgAdmins: true,
        allowTeamMembers: true,
        allowOrgMembers: false,
        allowedUsers: [],
        allowedAgents: [],
        allowedTeams: []
      },
      routing: {
        allowAnyOrgAgent: false,
        allowCrossTeamRouting: false,
        allowedAgents: [],
        allowedTeams: []
      }
    }
  },
  {
    id: 'collaborative',
    name: 'Collaborative',
    description: 'Org members can assign, cross-team routing',
    icon: ShieldCheck,
    color: 'bg-green-100 text-green-800 border-green-200',
    permissions: {
      assignment: {
        allowOrgAdmins: true,
        allowTeamMembers: true,
        allowOrgMembers: true,
        allowedUsers: [],
        allowedAgents: [],
        allowedTeams: []
      },
      routing: {
        allowAnyOrgAgent: true,
        allowCrossTeamRouting: true,
        allowedAgents: [],
        allowedTeams: []
      }
    }
  }
];

interface PermissionPresetsProps {
  type: 'agent' | 'team';
  currentPermissions?: AgentTaskPermissions | TeamTaskPermissions;
  onApplyPreset: (permissions: AgentTaskPermissions | TeamTaskPermissions) => void;
  className?: string;
}

export function PermissionPresets({ 
  type, 
  currentPermissions, 
  onApplyPreset, 
  className = "" 
}: PermissionPresetsProps) {
  const presets = type === 'agent' ? AGENT_PRESETS : TEAM_PRESETS;
  
  const isCurrentPreset = (preset: PermissionTemplate): boolean => {
    if (!currentPermissions) return false;
    
    const assignment = currentPermissions.assignment || {};
    const routing = currentPermissions.routing || {};
    
    // Check assignment permissions
    const assignmentMatches = 
      (assignment.allowOrgAdmins || false) === (preset.permissions.assignment.allowOrgAdmins) &&
      (assignment.allowTeamMembers || false) === (preset.permissions.assignment.allowTeamMembers) &&
      (assignment.allowOrgMembers || false) === (preset.permissions.assignment.allowOrgMembers) &&
      (assignment.allowedUsers?.length || 0) === 0 &&
      (assignment.allowedAgents?.length || 0) === 0 &&
      (assignment.allowedTeams?.length || 0) === 0;
    
    // Check routing permissions
    const routingMatches = type === 'agent' 
      ? (routing.allowAnyTeamAgent || false) === (preset.permissions.routing.allowAnyTeamAgent || false) &&
        (routing.allowAnyOrgAgent || false) === (preset.permissions.routing.allowAnyOrgAgent) &&
        (routing.allowCrossTeamRouting || false) === (preset.permissions.routing.allowCrossTeamRouting) &&
        (routing.allowedAgents?.length || 0) === 0 &&
        (routing.allowedTeams?.length || 0) === 0
      : (routing.allowAnyOrgAgent || false) === (preset.permissions.routing.allowAnyOrgAgent) &&
        (routing.allowCrossTeamRouting || false) === (preset.permissions.routing.allowCrossTeamRouting) &&
        (routing.allowedAgents?.length || 0) === 0 &&
        (routing.allowedTeams?.length || 0) === 0;
    
    return assignmentMatches && routingMatches;
  };

  const applyPreset = (preset: PermissionTemplate) => {
    const permissions = type === 'team' 
      ? {
          assignment: preset.permissions.assignment,
          routing: {
            ...preset.permissions.routing,
            internalRoutingStrategy: (currentPermissions as TeamTaskPermissions)?.routing?.internalRoutingStrategy || 'manual'
          }
        }
      : preset.permissions;
    
    onApplyPreset(permissions);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Quick Templates</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {presets.map((preset) => {
            const Icon = preset.icon;
            const isCurrent = isCurrentPreset(preset);
            
            return (
              <Button
                key={preset.id}
                variant={isCurrent ? "default" : "outline"}
                className={`h-auto p-3 text-left justify-start ${isCurrent ? "" : "hover:bg-muted/50"}`}
                onClick={() => applyPreset(preset)}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className={`p-1 rounded ${preset.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{preset.name}</span>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-xs">Current</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {preset.description}
                    </p>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}