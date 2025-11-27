'use client'

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Badge } from './badge';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import type { ToolConnectionStatus } from '@/app/actions/connections';

interface ConnectionSummaryCardProps {
  tools?: ToolConnectionStatus[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onSetupConnection?: (appName: string) => void;
  onViewAllConnections?: () => void;
  title?: string;
  className?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export function ConnectionSummaryCard({
  tools = [],
  isLoading = false,
  onRefresh,
  onSetupConnection,
  onViewAllConnections,
  title = "Connection Status",
  className,
  collapsible = false,
  defaultExpanded = true
}: ConnectionSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Calculate connection statistics
  const connectedCount = tools.filter(t => t.isConnected || t.connectionType === 'none').length;
  const totalCount = tools.length;
  const needsConnectionCount = tools.filter(t => !t.isConnected && t.connectionType !== 'none').length;

  // Get unique missing apps
  const missingApps = new Set<string>();
  tools.forEach(tool => {
    if (!tool.isConnected && tool.connectionType !== 'none') {
      tool.missingApps.forEach(app => missingApps.add(app));
    }
  });

  // Determine overall health status
  const getHealthStatus = () => {
    if (totalCount === 0) return { status: 'none', color: 'text-gray-500', icon: CheckCircle };
    if (needsConnectionCount === 0) return { status: 'healthy', color: 'text-green-600', icon: CheckCircle };
    if (connectedCount > needsConnectionCount) return { status: 'warning', color: 'text-yellow-600', icon: AlertTriangle };
    return { status: 'critical', color: 'text-red-600', icon: XCircle };
  };

  const health = getHealthStatus();
  const HealthIcon = health.icon;

  const getSummaryText = () => {
    if (totalCount === 0) return "No tools selected";
    if (needsConnectionCount === 0) return `All ${totalCount} tools ready`;
    return `${connectedCount} of ${totalCount} tools ready`;
  };

  return (
    <Card className={cn("border-l-4", {
      "border-l-green-500": health.status === 'healthy',
      "border-l-yellow-500": health.status === 'warning',
      "border-l-red-500": health.status === 'critical',
      "border-l-gray-300": health.status === 'none'
    }, className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HealthIcon className={cn("h-4 w-4", health.color)} />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {collapsible && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="ml-auto"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {(!collapsible || isExpanded) && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Summary stats */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {getSummaryText()}
              </p>
              {needsConnectionCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {needsConnectionCount} need setup
                </Badge>
              )}
            </div>

            {/* Missing connections */}
            {missingApps.size > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Missing connections:
                </p>
                <div className="flex flex-wrap gap-1">
                  {Array.from(missingApps).map(app => (
                    <Badge key={app} variant="outline" className="text-xs">
                      {app}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tool details (if not too many) */}
            {tools.length > 0 && tools.length <= 5 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Tools:</p>
                {tools.map((tool, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span className="truncate">{tool.displayName}</span>
                    <ConnectionStatusBadge
                      tool={tool}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              {needsConnectionCount > 0 && onSetupConnection && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSetupConnection(Array.from(missingApps)[0])}
                  className="text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Setup Missing
                </Button>
              )}
              {onViewAllConnections && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onViewAllConnections}
                  className="text-xs"
                >
                  View All
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface SimpleConnectionStatusProps {
  connectedCount: number;
  totalCount: number;
  missingApps?: string[];
  className?: string;
}

export function SimpleConnectionStatus({
  connectedCount,
  totalCount,
  missingApps = [],
  className
}: SimpleConnectionStatusProps) {
  const getStatusColor = () => {
    if (totalCount === 0) return 'text-gray-500';
    if (connectedCount === totalCount) return 'text-green-600';
    if (connectedCount > totalCount / 2) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = () => {
    if (totalCount === 0) return CheckCircle;
    if (connectedCount === totalCount) return CheckCircle;
    if (connectedCount > totalCount / 2) return AlertTriangle;
    return XCircle;
  };

  const StatusIcon = getStatusIcon();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <StatusIcon className={cn("h-4 w-4", getStatusColor())} />
      <span className="text-sm">
        {totalCount === 0 ? "No tools" : `${connectedCount}/${totalCount} ready`}
      </span>
      {missingApps.length > 0 && (
        <Badge variant="outline" className="text-xs">
          {missingApps.length} missing
        </Badge>
      )}
    </div>
  );
}