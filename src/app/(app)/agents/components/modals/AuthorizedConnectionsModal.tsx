'use client';

import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ShieldCheck, ShieldX, Trash2, AlertCircle, Users, Info, Settings } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import {
  getAgentDelegation,
  updateAgentDelegationServices,
  revokeAgentDelegation,
  getAgentAccessCount
} from '@/app/actions/delegations';
import { getConnectionIcon, formatConnectionName } from '../../lib/delegation-helpers';
import { ShareDialog } from '@/components/permissions/ShareDialog';

interface AuthorizedConnectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentDTO;
  onUpdate?: () => void;
}

interface ConnectionItem {
  appName: string;
  accountName: string;
  status: string;
  isDelegated: boolean;
}

export function AuthorizedConnectionsModal({
  isOpen,
  onClose,
  agent,
  onUpdate
}: AuthorizedConnectionsModalProps) {
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [delegatedServices, setDelegatedServices] = useState<string[]>([]);
  const [delegationId, setDelegationId] = useState<number | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessCount, setAccessCount] = useState<number>(0);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Load delegation data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadDelegationData();
    } else {
      // Reset state when modal closes
      setError(null);
      setUpdating(null);
      setRevoking(false);
    }
  }, [isOpen, agent.id]);

  const loadDelegationData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch delegation data and access count in parallel
      const [result, accessResult] = await Promise.all([
        getAgentDelegation(agent.id),
        getAgentAccessCount(agent.id)
      ]);

      // Set access count
      if (accessResult.success) {
        setAccessCount(accessResult.count);
      }

      if (!result.success || !result.data) {
        setError(result.error || 'Failed to load delegation data');
        return;
      }

      const { delegation, connections: ownerConnections } = result.data;

      // Store delegation ID and services
      if (delegation) {
        setDelegationId(delegation.id);
        setDelegatedServices(delegation.services);
      } else {
        setDelegationId(null);
        setDelegatedServices([]);
      }

      // Merge owner's connections with delegation status
      const mergedConnections: ConnectionItem[] = ownerConnections.map(conn => ({
        appName: conn.appName,
        accountName: conn.accountName,
        status: conn.status,
        isDelegated: delegation ? delegation.services.includes(conn.appName) : false
      }));

      setConnections(mergedConnections);
    } catch (err) {
      console.error('Error loading delegation data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleService = async (appName: string, currentlyDelegated: boolean) => {
    try {
      setUpdating(appName);
      setError(null);

      // Calculate new services list
      const newServices = currentlyDelegated
        ? delegatedServices.filter(s => s !== appName)
        : [...delegatedServices, appName];

      // Update delegation on server
      const result = await updateAgentDelegationServices(agent.id, newServices);

      if (!result.success) {
        setError(result.error || 'Failed to update delegation');
        return;
      }

      // Update local state
      setDelegatedServices(newServices);
      setConnections(prev =>
        prev.map(conn =>
          conn.appName === appName
            ? { ...conn, isDelegated: !currentlyDelegated }
            : conn
        )
      );

      // Trigger parent update
      onUpdate?.();
    } catch (err) {
      console.error('Error toggling service:', err);
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setUpdating(null);
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm('Are you sure you want to revoke all OAuth access for this agent? This cannot be undone.')) {
      return;
    }

    try {
      setRevoking(true);
      setError(null);

      const result = await revokeAgentDelegation(agent.id);

      if (!result.success) {
        setError(result.error || 'Failed to revoke delegation');
        return;
      }

      // Trigger parent update and close modal
      onUpdate?.();
      onClose();
    } catch (err) {
      console.error('Error revoking delegation:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke');
    } finally {
      setRevoking(false);
    }
  };

  const getDelegationCount = () => delegatedServices.length;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Authorized Connections"
      description="Manage which OAuth services this agent can access on your behalf"
      size="lg"
    >
      <div className="space-y-4">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* RBAC Access Banner */}
        {!loading && !error && (
          <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-md">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <span className="font-medium">
                  {accessCount === 0
                    ? 'No users or teams have'
                    : `${accessCount} ${accessCount === 1 ? 'user or team has' : 'users or teams have'}`}
                </span> access to this agent.
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                {accessCount > 0
                  ? 'They can trigger actions using the services below.'
                  : 'Only you can use this agent. Share it to let others trigger it.'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
              onClick={() => setShareDialogOpen(true)}
            >
              <Settings className="w-3 h-3 mr-1" />
              Manage Access
            </Button>
          </div>
        )}

        {/* No Connections State */}
        {!loading && !error && connections.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <ShieldX className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No connections found.</p>
            <p className="text-xs mt-1">Connect services in the Connections page first.</p>
          </div>
        )}

        {/* Connections List */}
        {!loading && !error && connections.length > 0 && (
          <>
            {/* Summary Badge */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">
                  {getDelegationCount()} of {connections.length} service{connections.length === 1 ? '' : 's'} authorized
                </span>
              </div>
              {delegationId && getDelegationCount() > 0 && (
                <Badge variant="outline" className="text-xs">Active</Badge>
              )}
            </div>

            {/* Connections Grid */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {connections.map((connection) => {
                const Icon = getConnectionIcon(connection.appName);
                const isUpdating = updating === connection.appName;

                return (
                  <Card
                    key={connection.appName}
                    className={`transition-colors ${
                      connection.isDelegated ? 'border-primary/30 bg-primary/5' : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`p-2 rounded-md ${
                            connection.isDelegated
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {formatConnectionName(connection.appName)}
                              </span>
                              {connection.isDelegated ? (
                                <Badge variant="default" className="text-xs">Authorized</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Not Authorized</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {connection.accountName}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Switch
                              checked={connection.isDelegated}
                              onCheckedChange={() =>
                                handleToggleService(connection.appName, connection.isDelegated)
                              }
                              disabled={revoking}
                            />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Revoke All Button */}
            {delegationId && getDelegationCount() > 0 && (
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleRevokeAll}
                  disabled={revoking || updating !== null}
                >
                  {revoking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Revoking Access...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Revoke All Access
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  This will prevent the agent from using any of your OAuth credentials
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Share Dialog for managing RBAC access */}
      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={(open) => {
          setShareDialogOpen(open);
          if (!open) {
            // Refresh access count when dialog closes
            loadDelegationData();
          }
        }}
        resourceType="agent"
        resourceId={agent.id}
        resourceName={agent.name}
      />
    </BaseModal>
  );
}
