'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Plus,
  Trash2,
  RefreshCw,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Link,
  ExternalLink,
  TestTube
} from 'lucide-react';
import { ConnectionDTO as Connection } from '@/app/mappers/connection-mapper';

export interface AppInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface AppConnectionCardProps {
  app: AppInfo;
  connection?: Connection | null;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
  onConnect: (appId: string) => void;
  onDisconnect: (connectionId: string) => void;
  onReconnect?: (appId: string) => void;
  className?: string;
}

export function AppConnectionCard({
  app,
  connection,
  isConnecting = false,
  isDisconnecting = false,
  onConnect,
  onDisconnect,
  onReconnect,
  className = ""
}: AppConnectionCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getConnectionStatus = () => {
    if (!connection) {
      return {
        type: 'available' as const,
        label: 'Available',
        description: 'Ready to connect',
        variant: 'outline' as const,
        icon: <Link className="w-3 h-3" />
      };
    }

    const isConnected = connection.status === 'connected' || connection.status === 'active';

    if (isConnected) {
      return {
        type: 'connected' as const,
        label: 'Connected',
        description: connection.account_name || 'Connected account',
        variant: 'default' as const,
        icon: <CheckCircle className="w-3 h-3" />
      };
    }

    if (connection.status === 'error') {
      return {
        type: 'error' as const,
        label: 'Error',
        description: 'Connection failed',
        variant: 'destructive' as const,
        icon: <AlertCircle className="w-3 h-3" />
      };
    }

    return {
      type: 'unknown' as const,
      label: connection.raw_status || connection.status || 'Unknown',
      description: 'Status unknown',
      variant: 'secondary' as const,
      icon: <AlertCircle className="w-3 h-3" />
    };
  };

  const status = getConnectionStatus();
  const isConnected = status.type === 'connected';
  const hasError = status.type === 'error';

  const handlePrimaryAction = () => {
    if (isConnected && connection) {
      onDisconnect(connection.id);
    } else if (hasError && onReconnect) {
      onReconnect(app.id);
    } else {
      onConnect(app.id);
    }
  };

  const getPrimaryActionContent = () => {
    if (isDisconnecting && connection) {
      return (
        <>
          <RefreshCw className="w-4 h-4 animate-spin mr-1" />
          Disconnecting
        </>
      );
    }

    if (isConnecting) {
      return (
        <>
          <RefreshCw className="w-4 h-4 animate-spin mr-1" />
          Connecting
        </>
      );
    }

    if (isConnected) {
      return (
        <>
          <Trash2 className="w-4 h-4 mr-1" />
          Disconnect
        </>
      );
    }

    if (hasError) {
      return (
        <>
          <RefreshCw className="w-4 h-4 mr-1" />
          Reconnect
        </>
      );
    }

    return (
      <>
        <Plus className="w-4 h-4 mr-1" />
        Connect
      </>
    );
  };

  const getPrimaryButtonVariant = () => {
    if (isConnected) return 'destructive';
    if (hasError) return 'outline';
    return 'default';
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${isConnected ? 'ring-1 ring-green-200 bg-green-50/30' : ''} ${className}`}>
      <CardContent className="p-3">
        <div className="space-y-2">
          {/* Top Row: Icon + Menu */}
          <div className="flex items-center justify-between">
            <div className="flex-shrink-0">
              <img
                className="w-8 h-8 rounded-lg ring-1 ring-border"
                src={app.icon}
                alt={app.name}
                onError={(e) => {
                  // Fallback to a simple colored circle with first letter
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {app.name.charAt(0)}
              </div>
            </div>

            {/* More Options Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {isConnected && (
                  <>
                    <DropdownMenuItem onClick={() => setShowDetails(!showDetails)}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    {onReconnect && (
                      <DropdownMenuItem onClick={() => onReconnect(app.id)}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reconnect
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem>
                      <TestTube className="w-4 h-4 mr-2" />
                      Test Connection
                    </DropdownMenuItem>
                  </>
                )}
                {!isConnected && (
                  <DropdownMenuItem onClick={() => setShowDetails(!showDetails)}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Learn More
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Full Width App Name */}
          <h3 className="font-medium text-sm line-clamp-2">{app.name}</h3>

          {/* Status Badge */}
          <Badge
            variant={status.variant}
            className="text-xs flex items-center gap-1 w-fit"
          >
            {status.icon}
            {status.label}
          </Badge>

          {/* Status Description */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground truncate">
              {isConnected && connection?.account_name
                ? connection.account_name
                : app.description
              }
            </p>

            {/* Error Details */}
            {hasError && connection && (
              <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
                Connection error - click reconnect to fix
              </div>
            )}

            {/* Expanded Details */}
            {showDetails && (
              <div className="text-xs space-y-0.5 bg-muted/50 rounded p-2">
                {connection ? (
                  <>
                    <div><strong>Status:</strong> {connection.raw_status || connection.status}</div>
                    <div><strong>App:</strong> {connection.app}</div>
                    {connection.account_name && (
                      <div><strong>Account:</strong> {connection.account_name}</div>
                    )}
                    <div><strong>ID:</strong> {connection.id}</div>
                  </>
                ) : (
                  <div className="text-muted-foreground">
                    Connect this app to allow your agents to use it on your behalf.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <Button
            onClick={handlePrimaryAction}
            disabled={isConnecting || isDisconnecting}
            variant={getPrimaryButtonVariant()}
            size="sm"
            className="w-full justify-center"
          >
            {getPrimaryActionContent()}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}