'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Bot,
  Link2Off,
  Mail,
  MessageSquare,
  Cloud,
  Calendar,
  FileText,
  Database,
  Users,
  Settings,
  type LucideIcon
} from 'lucide-react';
import { ShareDialog } from '@/components/permissions/ShareDialog';
import type { DelegationSummaryItem, AgentWithAccess } from '@/app/actions/delegations';

interface DelegationsGridProps {
  delegations: DelegationSummaryItem[];
  loading: boolean;
  revoking: string | null; // Format: "agentId-service"
  onRevoke: (agentId: number, service: string) => void;
  onRefresh?: () => void;
}

// Service icon mapping
const serviceIcons: Record<string, LucideIcon> = {
  gmail: Mail,
  slack: MessageSquare,
  google_drive: Cloud,
  google_calendar: Calendar,
  google_docs: FileText,
  notion: FileText,
  airtable: Database,
};

function getServiceIcon(service: string): LucideIcon {
  const normalizedService = service.toLowerCase().replace(/[^a-z_]/g, '_');
  return serviceIcons[normalizedService] || Cloud;
}

function formatServiceName(service: string): string {
  const formatMap: Record<string, string> = {
    gmail: 'Gmail',
    slack: 'Slack',
    google_drive: 'Google Drive',
    google_calendar: 'Google Calendar',
    google_docs: 'Google Docs',
    notion: 'Notion',
    airtable: 'Airtable',
  };

  const normalizedService = service.toLowerCase().replace(/[^a-z_]/g, '_');
  if (formatMap[normalizedService]) {
    return formatMap[normalizedService];
  }

  return service
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function DelegationsGrid({
  delegations,
  loading,
  revoking,
  onRevoke,
  onRefresh
}: DelegationsGridProps) {
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [shareDialogAgent, setShareDialogAgent] = useState<AgentWithAccess | null>(null);

  const toggleService = (service: string) => {
    setExpandedServices(prev => {
      const next = new Set(prev);
      if (next.has(service)) {
        next.delete(service);
      } else {
        next.add(service);
      }
      return next;
    });
  };

  const handleShareDialogClose = () => {
    setShareDialogAgent(null);
    // Refresh to get updated access lists
    onRefresh?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading delegations...</span>
      </div>
    );
  }

  if (delegations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Link2Off className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No connections found</p>
        <p className="text-sm mt-1">Connect OAuth services first to delegate them to agents.</p>
      </div>
    );
  }

  // Count total agents across all services
  const totalAgents = new Set(
    delegations.flatMap(d => d.agents.map(a => a.id))
  ).size;

  return (
    <>
      <div className="space-y-4">
        {/* Explainer */}
        <div className="p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
          <p>
            <strong>Delegations</strong> show which agents can use your OAuth credentials.
            Each agent may have users/teams who can trigger it.
          </p>
        </div>

        {/* Summary */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {delegations.length} connected {delegations.length === 1 ? 'service' : 'services'}
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span>
            {totalAgents} {totalAgents === 1 ? 'agent' : 'agents'} using credentials
          </span>
        </div>

        {/* Services List */}
        <div className="space-y-3">
          {delegations.map((delegation) => {
            const Icon = getServiceIcon(delegation.service);
            const isExpanded = expandedServices.has(delegation.service);
            const hasAgents = delegation.agents.length > 0;

            return (
              <Card key={delegation.service}>
                <CardHeader
                  className={`py-3 cursor-pointer ${hasAgents ? 'hover:bg-muted/50' : ''}`}
                  onClick={() => hasAgents && toggleService(delegation.service)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-primary/10 text-primary">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-medium">
                          {formatServiceName(delegation.service)}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {delegation.accountName}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasAgents ? (
                        <>
                          <Badge variant="secondary">
                            {delegation.agents.length} {delegation.agents.length === 1 ? 'agent' : 'agents'}
                          </Badge>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not delegated</span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && hasAgents && (
                  <CardContent className="pt-0 pb-3">
                    <div className="border-t pt-3 space-y-3">
                      {delegation.agents.map((agent) => {
                        const isRevoking = revoking === `${agent.id}-${delegation.service}`;
                        const accessCount = agent.accessList.length;

                        return (
                          <div
                            key={agent.id}
                            className="rounded-md border bg-card"
                          >
                            {/* Agent header */}
                            <div className="flex items-center justify-between p-3">
                              <div className="flex items-center gap-2">
                                <Bot className="w-4 h-4 text-primary" />
                                <span className="font-medium">{agent.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShareDialogAgent(agent);
                                  }}
                                >
                                  <Settings className="w-3 h-3 mr-1" />
                                  Manage Access
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRevoke(agent.id, delegation.service);
                                  }}
                                  disabled={isRevoking}
                                >
                                  {isRevoking ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    'Revoke Service'
                                  )}
                                </Button>
                              </div>
                            </div>

                            {/* Access list */}
                            <div className="px-3 pb-3">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                                <Users className="w-3 h-3" />
                                <span>
                                  {accessCount === 0
                                    ? 'No users/teams with access'
                                    : `${accessCount} ${accessCount === 1 ? 'user/team' : 'users/teams'} can trigger this agent`}
                                </span>
                              </div>
                              {accessCount > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {agent.accessList.slice(0, 5).map((entry) => (
                                    <Badge
                                      key={entry.id}
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {entry.type === 'team' && '👥 '}
                                      {entry.name}
                                    </Badge>
                                  ))}
                                  {accessCount > 5 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{accessCount - 5} more
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Share Dialog */}
      {shareDialogAgent && (
        <ShareDialog
          open={true}
          onOpenChange={handleShareDialogClose}
          resourceType="agent"
          resourceId={shareDialogAgent.id}
          resourceName={shareDialogAgent.name}
        />
      )}
    </>
  );
}
