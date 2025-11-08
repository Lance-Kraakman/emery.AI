'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { getUserOAuthConnectionsPaginated, getAppConnectionUrl, disconnectOAuthAccount, getAvailableApps } from '@/app/actions/connections';
import { Button } from '@/components/ui/button';
import { UnifiedConnectionsGrid } from './components/UnifiedConnectionsGrid';
import { ConnectionDTO as Connection } from '@/app/mappers/connection-mapper';

export function ConnectionsManager() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [availableApps, setAvailableApps] = useState<Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectingApp, setConnectingApp] = useState<string | null>(null);
  const [disconnectingAccount, setDisconnectingAccount] = useState<string | null>(null);

  // Pagination state
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadConnections();
    loadAvailableApps();
  }, []);

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
      setLoading(true);
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
        setNextCursor(result.data.nextCursor);
        setHasMore(result.data.hasMore);
      } else {
        setError(result.error || 'Failed to load connections');
      }
    } catch (err) {
      setError('Failed to load connections');
      console.error('Error loading connections:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMoreConnections = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore) {
      return;
    }

    try {
      setLoadingMore(true);
      setError(null);

      console.log('📄 Loading more connections with cursor:', nextCursor);

      const result = await getUserOAuthConnectionsPaginated({
        limit: 50,
        cursor: nextCursor
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
        setNextCursor(newCursor);
        setHasMore(moreAvailable);
      } else {
        setError(result.error || 'Failed to load more connections');
      }
    } catch (err) {
      setError('Failed to load more connections');
      console.error('Error loading more connections:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, nextCursor, loadingMore]);

  const loadAvailableApps = useCallback(async () => {
    try {
      console.log('📱 Loading available apps from database...');
      const result = await getAvailableApps();

      if (result.success && result.data) {
        console.log(`📱 Loaded ${result.data.length} available apps`);
        setAvailableApps(result.data);
      } else {
        console.error('❌ Failed to load available apps:', result.error);
        setError(result.error || 'Failed to load available apps');
      }
    } catch (err) {
      console.error('❌ Error loading available apps:', err);
      setError('Failed to load available apps');
    }
  }, []);

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


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading connections...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="text-destructive font-medium">{error}</div>
          <button
            onClick={loadConnections}
            className="mt-2 text-destructive hover:text-destructive/80 text-sm underline transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Unified Connections Grid */}
      <UnifiedConnectionsGrid
        apps={availableApps}
        connections={connections}
        connectingApp={connectingApp}
        disconnectingAccount={disconnectingAccount}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onConnect={handleConnectApp}
        onDisconnect={handleDisconnectAccount}
        onReconnect={(appId) => handleConnectApp(appId, false, true)}
        onLoadMore={loadMoreConnections}
      />
    </div>
  );
}
