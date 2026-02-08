'use client';

import React from 'react';
import { Link2, Plus, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { ConnectionDTO } from '@/app/mappers/connection-mapper';

interface CompactConnectionsListProps {
  connections: ConnectionDTO[];
  onManageConnections?: () => void;
  className?: string;
}

const STATUS_CONFIG = {
  active: {
    icon: CheckCircle,
    color: 'text-green-500',
    label: 'Active'
  },
  inactive: {
    icon: XCircle,
    color: 'text-red-500',
    label: 'Inactive'
  },
  error: {
    icon: AlertCircle,
    color: 'text-yellow-500',
    label: 'Error'
  }
};

export function CompactConnectionsList({
  connections,
  onManageConnections,
  className = ''
}: CompactConnectionsListProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Connections</h4>
          <span className="text-xs text-muted-foreground">({connections.length})</span>
        </div>
        {onManageConnections && (
          <button
            onClick={onManageConnections}
            className="p-1 hover:bg-accent rounded transition-colors"
            title="Manage connections"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {connections.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4 border rounded-md bg-muted/20">
          No authorized connections
        </div>
      ) : (
        <div className="space-y-1">
          {connections.map((connection) => {
            const statusKey = connection.status.toLowerCase() as keyof typeof STATUS_CONFIG;
            const statusConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG.inactive;
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={connection.id}
                className="w-full flex items-center justify-between p-2 border rounded-md bg-card"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate capitalize">{connection.app}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {connection.account_name}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <StatusIcon className={`h-3 w-3 ${statusConfig.color}`} />
                    <span className={`text-xs ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
