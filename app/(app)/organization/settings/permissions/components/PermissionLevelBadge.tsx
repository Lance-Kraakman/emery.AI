'use client';

import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, ShieldX, Users, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentTaskPermissions } from "@/ddd/application/services/agents/agent-permissions-application-service";
import type { TeamTaskPermissions } from "@/ddd/application/services/teams/team-permissions-application-service";

type PermissionLevel = 'restricted' | 'moderate' | 'open' | 'custom';

interface PermissionLevelBadgeProps {
  permissions: AgentTaskPermissions | TeamTaskPermissions;
  type: 'assignment' | 'routing';
  compact?: boolean;
}

interface PermissionSummary {
  level: PermissionLevel;
  label: string;
  description: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  details: string[];
}

function analyzeAssignmentPermissions(assignment: any): PermissionSummary {
  const parts: string[] = [];
  let restrictiveness = 0;

  if (assignment?.allowOrgAdmins) {
    parts.push("Org Admins");
    restrictiveness += 1;
  }
  
  if (assignment?.allowTeamMembers) {
    parts.push("Team Members");
    restrictiveness += 2;
  }
  
  if (assignment?.allowOrgMembers) {
    parts.push("All Org Members");
    restrictiveness += 3;
  }

  const specificCount = (assignment?.allowedUsers?.length || 0) + 
                       (assignment?.allowedAgents?.length || 0) + 
                       (assignment?.allowedTeams?.length || 0);

  if (specificCount > 0) {
    parts.push(`${specificCount} Specific`);
    restrictiveness += 1;
  }

  if (restrictiveness === 0) {
    return {
      level: 'restricted',
      label: 'Owner Only',
      description: 'Only owner can assign tasks',
      color: 'bg-red-100 text-red-800 border-red-200',
      icon: ShieldX,
      details: ['Owner only']
    };
  } else if (restrictiveness <= 2) {
    return {
      level: 'moderate',
      label: 'Limited',
      description: 'Limited assignment permissions',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: Shield,
      details: parts
    };
  } else if (assignment?.allowOrgMembers) {
    return {
      level: 'open',
      label: 'Organization',
      description: 'All organization members can assign',
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: ShieldCheck,
      details: parts
    };
  } else {
    return {
      level: 'custom',
      label: 'Custom',
      description: 'Custom permission configuration',
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: Shield,
      details: parts
    };
  }
}

function analyzeRoutingPermissions(routing: any): PermissionSummary {
  const parts: string[] = [];
  let openness = 0;

  if (routing?.allowAnyOrgAgent) {
    parts.push("Any Org Agent");
    openness += 3;
  }
  
  if (routing?.allowAnyTeamAgent) {
    parts.push("Team Agents");
    openness += 2;
  }
  
  if (routing?.allowCrossTeamRouting) {
    parts.push("Cross-Team");
    openness += 2;
  }

  const specificCount = (routing?.allowedAgents?.length || 0) + 
                       (routing?.allowedTeams?.length || 0);

  if (specificCount > 0) {
    parts.push(`${specificCount} Specific`);
    openness += 1;
  }

  if (routing?.internalRoutingStrategy) {
    parts.push(`${routing.internalRoutingStrategy}`);
  }

  if (openness === 0 && specificCount === 0) {
    return {
      level: 'restricted',
      label: 'No Routing',
      description: 'Cannot route to other agents',
      color: 'bg-red-100 text-red-800 border-red-200',
      icon: ShieldX,
      details: ['No routing allowed']
    };
  } else if (openness >= 5 || routing?.allowAnyOrgAgent) {
    return {
      level: 'open',
      label: 'Organization',
      description: 'Can route to any organization agent',
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: ShieldCheck,
      details: parts
    };
  } else if (openness >= 2) {
    return {
      level: 'moderate',
      label: 'Limited',
      description: 'Limited routing permissions',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: Shield,
      details: parts
    };
  } else {
    return {
      level: 'custom',
      label: 'Specific',
      description: 'Specific agents/teams only',
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: Shield,
      details: parts
    };
  }
}

export function PermissionLevelBadge({ 
  permissions, 
  type, 
  compact = false 
}: PermissionLevelBadgeProps) {
  const summary = type === 'assignment' 
    ? analyzeAssignmentPermissions(permissions.assignment)
    : analyzeRoutingPermissions(permissions.routing);

  const Icon = summary.icon;

  if (compact) {
    return (
      <Badge 
        variant="outline" 
        className={cn("text-xs font-medium", summary.color)}
        title={`${summary.description}\n${summary.details.join(', ')}`}
      >
        <Icon className="w-3 h-3 mr-1" />
        {summary.label}
      </Badge>
    );
  }

  return (
    <div className="space-y-1">
      <Badge 
        variant="outline" 
        className={cn("text-xs font-medium", summary.color)}
      >
        <Icon className="w-3 h-3 mr-1" />
        {summary.label}
      </Badge>
      {summary.details.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {summary.details.join(", ")}
        </div>
      )}
    </div>
  );
}

export function CombinedPermissionBadge({ 
  permissions, 
  compact = true 
}: { 
  permissions: AgentTaskPermissions | TeamTaskPermissions;
  compact?: boolean;
}) {
  const assignmentSummary = analyzeAssignmentPermissions(permissions.assignment);
  const routingSummary = analyzeRoutingPermissions(permissions.routing);

  // Determine overall permission level
  const levels = [assignmentSummary.level, routingSummary.level];
  const hasOpen = levels.includes('open');
  const hasRestricted = levels.includes('restricted');
  
  let overallLevel: PermissionLevel;
  let overallColor: string;
  let overallIcon: React.ComponentType<{ className?: string }>;
  let overallLabel: string;

  if (hasRestricted && !hasOpen) {
    overallLevel = 'restricted';
    overallColor = 'bg-red-100 text-red-800 border-red-200';
    overallIcon = ShieldX;
    overallLabel = 'Restricted';
  } else if (hasOpen && !hasRestricted) {
    overallLevel = 'open';
    overallColor = 'bg-green-100 text-green-800 border-green-200';
    overallIcon = ShieldCheck;
    overallLabel = 'Open';
  } else if (levels.every(l => l === 'moderate')) {
    overallLevel = 'moderate';
    overallColor = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    overallIcon = Shield;
    overallLabel = 'Limited';
  } else {
    overallLevel = 'custom';
    overallColor = 'bg-blue-100 text-blue-800 border-blue-200';
    overallIcon = Shield;
    overallLabel = 'Mixed';
  }

  const OverallIcon = overallIcon;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge 
          variant="outline" 
          className={cn("text-xs font-medium", overallColor)}
          title={`Assignment: ${assignmentSummary.label} | Routing: ${routingSummary.label}`}
        >
          <OverallIcon className="w-3 h-3 mr-1" />
          {overallLabel}
        </Badge>
        <div className="flex gap-1">
          <Badge variant="secondary" className="text-xs">
            <Users className="w-3 h-3 mr-1" />
            {assignmentSummary.label}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <Bot className="w-3 h-3 mr-1" />
            {routingSummary.label}
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Badge 
        variant="outline" 
        className={cn("text-sm font-medium", overallColor)}
      >
        <OverallIcon className="w-4 h-4 mr-1" />
        {overallLabel} Permissions
      </Badge>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="font-medium">Assignment:</span> {assignmentSummary.label}
        </div>
        <div>
          <span className="font-medium">Routing:</span> {routingSummary.label}
        </div>
      </div>
    </div>
  );
}