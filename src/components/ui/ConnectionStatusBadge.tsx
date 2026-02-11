'use client'

import React from 'react';
import { Badge } from './badge';
import { Button } from './button';
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolConnectionStatus } from '@/app/actions/connections';

interface ConnectionStatusBadgeProps {
  tool: ToolConnectionStatus;
  showSetupButton?: boolean;
  onSetupClick?: (appName: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ConnectionStatusBadge({
  tool,
  showSetupButton = false,
  onSetupClick,
  size = 'md',
  className
}: ConnectionStatusBadgeProps) {
  const getStatusInfo = () => {
    if (tool.connectionType === 'none') {
      return {
        icon: CheckCircle,
        color: 'bg-green-500',
        badgeVariant: 'secondary' as const,
        text: 'No auth needed',
        tooltip: 'This tool doesn\'t require authentication'
      };
    }

    if (tool.isConnected) {
      return {
        icon: CheckCircle,
        color: 'bg-green-500',
        badgeVariant: 'secondary' as const,
        text: 'Connected',
        tooltip: `Connected to: ${tool.requiredApps.join(', ')}`
      };
    }

    return {
      icon: XCircle,
      color: 'bg-red-500',
      badgeVariant: 'destructive' as const,
      text: 'Setup needed',
      tooltip: `Needs connections: ${tool.missingApps.join(', ')}`
    };
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4'
  };

  const iconSize = sizeClasses[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Status indicator dot */}
      <div className="relative">
        <div
          className={cn(
            'rounded-full',
            iconSize,
            statusInfo.color
          )}
          title={statusInfo.tooltip}
        />
      </div>

      {/* Connection details */}
      {size !== 'sm' && (
        <div className="flex items-center gap-2">
          <Badge variant={statusInfo.badgeVariant} className="text-xs">
            {statusInfo.text}
          </Badge>

          {/* Required apps list */}
          {tool.requiredApps.length > 0 && size === 'lg' && (
            <span className="text-xs text-muted-foreground">
              ({tool.requiredApps.join(', ')})
            </span>
          )}

          {/* Setup button */}
          {showSetupButton && !tool.isConnected && tool.connectionType !== 'none' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetupClick?.(tool.missingApps[0])}
              className="h-6 px-2 py-0"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Setup
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface ConnectionStatusIconProps {
  status: 'connected' | 'disconnected' | 'none' | 'loading';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  tooltip?: string;
}

export function ConnectionStatusIcon({
  status,
  size = 'md',
  className,
  tooltip
}: ConnectionStatusIconProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-100'
        };
      case 'disconnected':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-100'
        };
      case 'loading':
        return {
          icon: Loader2,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          animate: true
        };
      default: // 'none'
        return {
          icon: CheckCircle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'h-4 w-4 p-0.5',
    md: 'h-5 w-5 p-1',
    lg: 'h-6 w-6 p-1'
  };

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center',
        config.bgColor,
        sizeClasses[size],
        className
      )}
      title={tooltip}
    >
      <Icon className={cn(
        'h-full w-full',
        config.color,
        config.animate && 'animate-spin'
      )} />
    </div>
  );
}

interface ConnectionStatusDotProps {
  isConnected: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ConnectionStatusDot({
  isConnected,
  size = 'md',
  className
}: ConnectionStatusDotProps) {
  const sizeClasses = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-3 w-3'
  };

  return (
    <div className={cn(
      'rounded-full',
      isConnected ? 'bg-green-500' : 'bg-red-500',
      sizeClasses[size],
      className
    )} />
  );
}