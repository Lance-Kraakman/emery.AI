'use client'

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { getUserOAuthConnections, getAppConnectionUrl, disconnectOAuthAccount } from '@/app/actions/connections';
import { Button } from '@/components/ui/button';

import { NormalizedConnection as Connection } from '@/lib/pipedream/connection-mapper';

const AVAILABLE_APPS = [
  { id: 'slack', name: 'Slack', description: 'Send messages, create channels, and more', icon: '/icons/slack.svg' },
  { id: 'gmail', name: 'Gmail', description: 'Send emails, read inbox, and manage labels', icon: '/icons/gmail.svg' },
  { id: 'github', name: 'GitHub', description: 'Manage repositories, issues, and pull requests', icon: '/icons/github.svg' },
  { id: 'google-sheets', name: 'Google Sheets', description: 'Read and write to spreadsheets', icon: '/icons/google-sheets.svg' },
  { id: 'discord', name: 'Discord', description: 'Send messages and manage servers', icon: '/icons/discord.svg' },
  { id: 'twitter', name: 'Twitter', description: 'Post tweets and manage your timeline', icon: '/icons/twitter.svg' },
];

export function ConnectionsManager() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingApp, setConnectingApp] = useState<string | null>(null);
  const [disconnectingAccount, setDisconnectingAccount] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();
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
      
      // Get connections (user initialization handled automatically by DDD system)
      const result = await getUserOAuthConnections();
      if (result.success) {
        console.log('🔍 Raw connections data:', JSON.stringify(result.data, null, 2));
        setConnections(result.data || []);
      } else {
        setError(result.error || 'Failed to load connections');
      }
    } catch (err) {
      setError('Failed to load connections');
      console.error('Error loading connections:', err);
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies needed since it only uses external functions and setters

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

  const handleConnectApp = async (appId: string) => {
    try {
      setConnectingApp(appId);
      setError(null);
      
      const result = await getAppConnectionUrl({
        appName: appId,
        redirectUrl: `${window.location.origin}/connections?connected=${appId}`,
      });
      
      if (result.success && result.data?.url) {
        // Open connection URL immediately in the same window to avoid token expiration
        // Use window.location.href instead of window.open to prevent popup blockers
        window.location.href = result.data.url;
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

  const getConnectionStatus = (connection: Connection) => {
    const isConnected = connection.status === 'connected' || connection.status === 'active';
    const statusText = connection.raw_status || connection.status;

    if (isConnected) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 capitalize">
          {statusText}
        </span>
      );
    }

    if (connection.status === 'error') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive capitalize">
          {statusText}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground capitalize">
        {statusText}
      </span>
    );
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

      {/* Connected Apps */}
      {connections && connections.length > 0 && (
        <div className="bg-card border border-border rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-medium">Connected Apps</h2>
            <p className="text-sm text-muted-foreground">
              Apps that your agents can use on your behalf
            </p>
          </div>
          <div className="divide-y divide-border">
            {connections?.map((connection) => (
              <div key={connection.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <img className="w-10 h-10 rounded-lg" src={AVAILABLE_APPS.find(a => a.id === connection.app)?.icon || ''} alt={connection.app} />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium">
                      {AVAILABLE_APPS.find(a => a.id === connection.app)?.name || 'Unknown App'}
                    </div>
                    {connection.account_name && (
                      <div className="text-sm text-muted-foreground">
                        {connection.account_name}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {getConnectionStatus(connection)}
                  <Button
                    onClick={() => handleDisconnectAccount(connection.id)}
                    disabled={disconnectingAccount === connection.id}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    title="Disconnect"
                  >
                    {disconnectingAccount === connection.id ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Apps */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-medium">Available Apps</h2>
          <p className="text-sm text-muted-foreground">
            Connect apps to allow your agents to use them
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {AVAILABLE_APPS.map((app) => {
            const connectedApp = connections?.find(c => c.app === app.id);
            const isConnected = !!connectedApp && (connectedApp.status === 'connected' || connectedApp.status === 'active');
            const isConnecting = connectingApp === app.id;

            return (
              <div key={app.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <img className="w-10 h-10 rounded-lg" src={app.icon} alt={app.name} />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium">
                      {app.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {app.description}
                    </div>
                  </div>
                </div>
                <div>
                  {isConnected ? (
                    <span className="text-green-600 text-sm font-medium">Connected</span>
                  ) : (
                    <Button
                      onClick={() => handleConnectApp(app.id)}
                      disabled={isConnecting}
                      size="sm"
                    >
                      {isConnecting ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Plus className="w-4 h-4 mr-1" />
                      )}
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
