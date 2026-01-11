'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { getUserOAuthConnectionsPaginated, getAppConnectionUrl, disconnectOAuthAccount, getAvailableAppsPaginated } from '@/app/actions/connections';
import { getOwnerDelegationsSummary, revokeServiceFromAgent, type DelegationSummaryItem } from '@/app/actions/delegations';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UnifiedConnectionsGrid } from './components/UnifiedConnectionsGrid';
import { DelegationsGrid } from './components/DelegationsGrid';
import { ConnectionDTO as Connection } from '@/app/mappers/connection-mapper';
import { toast } from 'sonner';

type TabValue = 'connections' | 'browse' | 'delegations';

export function ConnectionsManager() {
  const [activeTab, setActiveTab] = useState<TabValue>('connections');

  // My Connections tab state
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [connectionsLoadingMore, setConnectionsLoadingMore] = useState(false);
  const [connectionsNextCursor, setConnectionsNextCursor] = useState<string | undefined>(undefined);
  const [connectionsHasMore, setConnectionsHasMore] = useState(false);

  // Browse Apps tab state
  const [availableApps, setAvailableApps] = useState<Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
  }>>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsLoadingMore, setAppsLoadingMore] = useState(false);
  const [appsOffset, setAppsOffset] = useState(0);
  const [appsTotal, setAppsTotal] = useState(0);
  const [appsHasMore, setAppsHasMore] = useState(false);
  const [appsSearch, setAppsSearch] = useState('');

  // Agent Delegations tab state
  const [delegations, setDelegations] = useState<DelegationSummaryItem[]>([]);
  const [delegationsLoading, setDelegationsLoading] = useState(false);
  const [revokingDelegation, setRevokingDelegation] = useState<string | null>(null);

  // Shared state
  const [error, setError] = useState<string | null>(null);
  const [connectingApp, setConnectingApp] = useState<string | null>(null);
  const [disconnectingAccount, setDisconnectingAccount] = useState<string | null>(null);

  // Load connections on mount
  useEffect(() => {
    loadConnections();
  }, []);

  // Load apps when Browse tab is accessed
  useEffect(() => {
    if (activeTab === 'browse' && availableApps.length === 0 && !appsLoading) {
      loadAvailableApps();
    }
  }, [activeTab]);

  // Load delegations when Delegations tab is accessed
  useEffect(() => {
    if (activeTab === 'delegations' && delegations.length === 0 && !delegationsLoading) {
      loadDelegations();
    }
  }, [activeTab]);

  // Handle successful connection redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connectedApp = urlParams.get('connected');
    
    if (connectedApp) {
      // Connection was successful, refresh the connections list
      console.log(`Successfully connected ${connectedApp}`);
      
      // Clean up the URL first to prevent re-renders
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      
      // Then refresh connections
      loadConnections();
    }
  }, []); // Empty dependency array is correct here

  const loadConnections = useCallback(async () => {
    try {
      setConnectionsLoading(true);
      setError(null);

      // Use paginated API with default page size of 50
      const result = await getUserOAuthConnectionsPaginated({ limit: 50 });

      if (result.success && result.data) {
        console.log('🔍 Paginated connections loaded:', {
          count: result.data.connections.length,
          hasMore: result.data.hasMore,
          nextCursor: result.data.nextCursor
        });
        setConnections(result.data.connections);
        setConnectionsNextCursor(result.data.nextCursor);
        setConnectionsHasMore(result.data.hasMore);
      } else {
        setError(result.error || 'Failed to load connections');
      }
    } catch (err) {
      setError('Failed to load connections');
      console.error('Error loading connections:', err);
    } finally {
      setConnectionsLoading(false);
    }
  }, []);

  const loadMoreConnections = useCallback(async () => {
    if (!connectionsHasMore || !connectionsNextCursor || connectionsLoadingMore) {
      return;
    }

    try {
      setConnectionsLoadingMore(true);
      setError(null);

      console.log('📄 Loading more connections with cursor:', connectionsNextCursor);

      const result = await getUserOAuthConnectionsPaginated({
        limit: 50,
        cursor: connectionsNextCursor
      });

      if (result.success && result.data) {
        const { connections: newConnections, nextCursor: newCursor, hasMore: moreAvailable } = result.data;

        console.log('📄 More connections loaded:', {
          count: newConnections.length,
          hasMore: moreAvailable,
          nextCursor: newCursor
        });

        // Append new connections to existing ones
        setConnections(prev => [...prev, ...newConnections]);
        setConnectionsNextCursor(newCursor);
        setConnectionsHasMore(moreAvailable);
      } else {
        setError(result.error || 'Failed to load more connections');
      }
    } catch (err) {
      setError('Failed to load more connections');
      console.error('Error loading more connections:', err);
    } finally {
      setConnectionsLoadingMore(false);
    }
  }, [connectionsHasMore, connectionsNextCursor, connectionsLoadingMore]);

  const loadAvailableApps = useCallback(async (reset = false) => {
    try {
      setAppsLoading(true);
      setError(null);

      const offset = reset ? 0 : appsOffset;

      console.log(`📱 Loading available apps from database (offset: ${offset}, search: ${appsSearch || 'none'})...`);

      const result = await getAvailableAppsPaginated({
        limit: 50,
        offset,
        search: appsSearch || undefined
      });

      if (result.success && result.data) {
        console.log(`📱 Loaded ${result.data.apps.length} of ${result.data.total} available apps`);

        if (reset) {
          setAvailableApps(result.data.apps);
          setAppsOffset(0);
        } else {
          setAvailableApps(result.data.apps);
        }

        setAppsTotal(result.data.total);
        setAppsHasMore(result.data.hasMore);
      } else {
        console.error('❌ Failed to load available apps:', result.error);
        setError(result.error || 'Failed to load available apps');
      }
    } catch (err) {
      console.error('❌ Error loading available apps:', err);
      setError('Failed to load available apps');
    } finally {
      setAppsLoading(false);
    }
  }, [appsOffset, appsSearch]);

  const loadMoreApps = useCallback(async () => {
    if (!appsHasMore || appsLoadingMore) {
      return;
    }

    try {
      setAppsLoadingMore(true);
      setError(null);

      const newOffset = appsOffset + 50;

      console.log(`📄 Loading more apps (offset: ${newOffset})...`);

      const result = await getAvailableAppsPaginated({
        limit: 50,
        offset: newOffset,
        search: appsSearch || undefined
      });

      if (result.success && result.data) {
        const { apps: newApps, total, hasMore } = result.data;

        console.log(`📄 More apps loaded: ${newApps.length} of ${total}`);

        // Append new apps to existing ones
        setAvailableApps(prev => [...prev, ...newApps]);
        setAppsOffset(newOffset);
        setAppsTotal(total);
        setAppsHasMore(hasMore);
      } else {
        setError(result.error || 'Failed to load more apps');
      }
    } catch (err) {
      setError('Failed to load more apps');
      console.error('Error loading more apps:', err);
    } finally {
      setAppsLoadingMore(false);
    }
  }, [appsHasMore, appsLoadingMore, appsOffset, appsSearch]);

  // Handle server-side search for Browse Apps tab
  const handleAppsSearch = useCallback((term: string) => {
    setAppsSearch(term);
    setAppsOffset(0); // Reset pagination when search changes
    // Note: loadAvailableApps will be triggered by the useEffect below
  }, []);

  // Load delegations for the current user
  const loadDelegations = useCallback(async () => {
    try {
      setDelegationsLoading(true);
      setError(null);

      const result = await getOwnerDelegationsSummary();

      if (result.success && result.data) {
        setDelegations(result.data);
      } else {
        setError(result.error || 'Failed to load delegations');
      }
    } catch (err) {
      setError('Failed to load delegations');
      console.error('Error loading delegations:', err);
    } finally {
      setDelegationsLoading(false);
    }
  }, []);

  // Handle revoking a service from an agent
  const handleRevokeDelegation = useCallback(async (agentId: number, service: string) => {
    const confirmRevoke = confirm(
      `Are you sure you want to revoke ${service} access from this agent?`
    );
    if (!confirmRevoke) return;

    try {
      setRevokingDelegation(`${agentId}-${service}`);
      setError(null);

      const result = await revokeServiceFromAgent(agentId, service);

      if (result.success) {
        toast.success('Service access revoked');
        // Refresh delegations
        await loadDelegations();
      } else {
        setError(result.error || 'Failed to revoke access');
        toast.error(result.error || 'Failed to revoke access');
      }
    } catch (err) {
      setError('Failed to revoke access');
      console.error('Error revoking delegation:', err);
      toast.error('Failed to revoke access');
    } finally {
      setRevokingDelegation(null);
    }
  }, [loadDelegations]);

  // Trigger app reload when search term changes
  useEffect(() => {
    if (activeTab === 'browse') {
      loadAvailableApps(true); // Reset to get fresh search results
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appsSearch]); // Only trigger on search change, not activeTab or loadAvailableApps

  const handleDisconnectAccount = async (accountId: string) => {
    console.log('🗑️ Disconnect button clicked for account:', accountId);
    
    try {
      setDisconnectingAccount(accountId);
      setError(null);
      
      console.log('📞 Calling disconnectOAuthAccount...');
      const result = await disconnectOAuthAccount({ accountId });
      console.log('📞 Disconnect result:', result);
      
      if (result.success) {
        console.log('✅ Disconnect successful, refreshing connections...');
        // Refresh connections list after successful disconnect
        await loadConnections();
      } else {
        console.error('❌ Disconnect failed:', result.error);
        setError(result.error || 'Failed to disconnect account');
      }
    } catch (err) {
      console.error('💥 Disconnect error:', err);
      setError('Failed to disconnect account');
      console.error('Error disconnecting account:', err);
    } finally {
      setDisconnectingAccount(null);
    }
  };

  const handleConnectApp = async (appId: string, forceNew = false, reconnectExisting = false) => {
    try {
      setConnectingApp(appId);
      setError(null);

      const result = await getAppConnectionUrl({
        appName: appId,
        redirectUrl: `${window.location.origin}/connections?connected=${appId}`,
        forceNew,
        reconnectExisting,
      });

      if (result.success && result.data) {
        const { url, existingConnection, warningMessage } = result.data;

        if (existingConnection && warningMessage) {
          // Show dialog asking user what they want to do
          const userChoice = confirm(
            `${warningMessage}\n\nChoose:\n` +
            `• OK: Reconnect existing account\n` +
            `• Cancel: Add new account (may create duplicates)`
          );

          if (userChoice) {
            // User chose to reconnect existing
            return handleConnectApp(appId, false, true);
          } else {
            // User chose to add new account
            return handleConnectApp(appId, true, false);
          }
        }

        if (url) {
          // Open connection URL immediately in the same window to avoid token expiration
          // Use window.location.href instead of window.open to prevent popup blockers
          window.location.href = url;
        } else {
          setError('No connection URL generated');
        }
      } else {
        setError(result.error || 'Failed to generate connection URL');
      }
    } catch (err) {
      setError('Failed to connect app');
      console.error('Error connecting app:', err);
    } finally {
      setConnectingApp(null);
    }
  };


  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="text-destructive font-medium">{error}</div>
          <button
            onClick={() => {
              if (activeTab === 'connections') loadConnections();
              else if (activeTab === 'browse') loadAvailableApps(true);
              else if (activeTab === 'delegations') loadDelegations();
            }}
            className="mt-2 text-destructive hover:text-destructive/80 text-sm underline transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="connections">
            My Connections {connections.length > 0 && `(${connections.length})`}
          </TabsTrigger>
          <TabsTrigger value="browse">
            Browse Apps {appsTotal > 0 && `(${appsTotal})`}
          </TabsTrigger>
          <TabsTrigger value="delegations">
            Agent Delegations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="mt-6">
          {connectionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading connections...</span>
            </div>
          ) : (
            <UnifiedConnectionsGrid
              mode="connections"
              connections={connections}
              connectingApp={connectingApp}
              disconnectingAccount={disconnectingAccount}
              hasMore={connectionsHasMore}
              loadingMore={connectionsLoadingMore}
              onConnect={handleConnectApp}
              onDisconnect={handleDisconnectAccount}
              onReconnect={(appId) => handleConnectApp(appId, false, true)}
              onLoadMore={loadMoreConnections}
            />
          )}
        </TabsContent>

        <TabsContent value="browse" className="mt-6">
          {appsLoading && availableApps.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading apps...</span>
            </div>
          ) : (
            <UnifiedConnectionsGrid
              mode="browse"
              apps={availableApps}
              connections={connections}
              connectingApp={connectingApp}
              disconnectingAccount={disconnectingAccount}
              hasMore={appsHasMore}
              loadingMore={appsLoadingMore}
              onConnect={handleConnectApp}
              onDisconnect={handleDisconnectAccount}
              onReconnect={(appId) => handleConnectApp(appId, false, true)}
              onLoadMore={loadMoreApps}
              onSearch={handleAppsSearch}
              isSearching={appsLoading}
            />
          )}
        </TabsContent>

        <TabsContent value="delegations" className="mt-6">
          <DelegationsGrid
            delegations={delegations}
            loading={delegationsLoading}
            revoking={revokingDelegation}
            onRevoke={handleRevokeDelegation}
            onRefresh={loadDelegations}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
