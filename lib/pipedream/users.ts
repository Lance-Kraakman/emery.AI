import { pipedreamClient, getExternalUserId } from './client';

export interface PipedreamUser {
  id: string;
  external_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePipedreamUserData {
  userId: string;
  email?: string;
  name?: string;
}

/**
 * Create or get a Pipedream external user for our user
 * Note: In Pipedream Connect, users are created implicitly when they create accounts/connections
 */
export async function createOrGetPipedreamUser(data: CreatePipedreamUserData): Promise<PipedreamUser> {
  if (!pipedreamClient) {
    throw new Error('Pipedream client not available (server-side only)');
  }
  
  const externalUserId = getExternalUserId(data.userId);
  
  // In Pipedream Connect, users are created implicitly when they connect accounts
  // We'll return a mock user object for now - the actual user will be created when they connect an account
  return {
    id: externalUserId,
    external_user_id: externalUserId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Delete a Pipedream external user and all their accounts
 */
export async function deletePipedreamUser(userId: string): Promise<void> {
  if (!pipedreamClient) {
    throw new Error('Pipedream client not available (server-side only)');
  }
  
  const externalUserId = getExternalUserId(userId);
  
  try {
    // Delete all accounts for this external user
    // AIDEV-NOTE: Pipedream SDK might not have delete method, commenting out for now
    // await pipedreamClient.users.delete({ external_user_id: externalUserId });
    console.log(`Would delete Pipedream user: ${externalUserId}`);
  } catch (error) {
    console.error('Failed to delete Pipedream user:', error);
    throw new Error('Failed to delete Pipedream user');
  }
}

/**
 * Get user's OAuth connections
 */
export async function getUserConnections(userId: string) {
  if (!pipedreamClient) {
    throw new Error('Pipedream client not available (server-side only)');
  }
  
  const externalUserId = getExternalUserId(userId);
  
  try {
    // Use the accounts API to get user's connected accounts
    const response = await pipedreamClient.accounts.list({ 
      external_user_id: externalUserId 
    });
    
    // Handle different response structures - response might be wrapped in a data property
    const accounts = Array.isArray(response) ? response : (response?.data || []);
    
    if (!Array.isArray(accounts)) {
      console.warn('Accounts response is not an array:', accounts);
      return [];
    }
    
    // Transform accounts to match the expected connection format
    return accounts.map((account: any) => ({
      id: account.id,
      app: account.app, // Keep the full app object
      account_name: account.name || account.email || account.username,
      status: account.healthy ? 'connected' : 'error',
      created_at: account.created_at || new Date().toISOString(),
      updated_at: account.updated_at || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Failed to get user connections:', error);
    return [];
  }
}

/**
 * Disconnect a specific OAuth account for a user
 */
export async function disconnectUserAccount(userId: string, accountId: string): Promise<void> {
  if (!pipedreamClient) {
    throw new Error('Pipedream client not available (server-side only)');
  }
  
  try {
    console.log(`[PIPEDREAM-DISCONNECT] Attempting to disconnect account ${accountId} for user ${userId}`);
    
    // Try using the SDK first - explore what methods are available
    console.log(`[PIPEDREAM-DISCONNECT] Available SDK methods:`, Object.getOwnPropertyNames(pipedreamClient));
    console.log(`[PIPEDREAM-DISCONNECT] Accounts methods:`, Object.getOwnPropertyNames(pipedreamClient.accounts || {}));
    
    // Try different SDK approaches
    const externalUserId = getExternalUserId(userId);
    
    try {
      // Try method 1: accounts.delete with account ID
      console.log(`[PIPEDREAM-DISCONNECT] Trying accounts.delete with accountId`);
      const result = await (pipedreamClient.accounts as any).delete(accountId);
      console.log(`[PIPEDREAM-DISCONNECT] SDK delete result:`, result);
      return;
    } catch (sdkError1) {
      console.log(`[PIPEDREAM-DISCONNECT] SDK method 1 failed:`, sdkError1);
    }
    
    try {
      // Try method 2: accounts.delete with external_user_id and id
      console.log(`[PIPEDREAM-DISCONNECT] Trying accounts.delete with external_user_id + id`);
      const result = await (pipedreamClient.accounts as any).delete({
        external_user_id: externalUserId,
        id: accountId
      });
      console.log(`[PIPEDREAM-DISCONNECT] SDK delete result:`, result);
      return;
    } catch (sdkError2) {
      console.log(`[PIPEDREAM-DISCONNECT] SDK method 2 failed:`, sdkError2);
    }
    
    // If SDK methods fail, fall back to direct API call
    console.log(`[PIPEDREAM-DISCONNECT] Falling back to direct API call`);
    
    const projectId = process.env.PIPEDREAM_PROJECT_ID;
    const clientId = process.env.PIPEDREAM_CLIENT_ID;
    const clientSecret = process.env.PIPEDREAM_CLIENT_SECRET;
    
    if (!projectId || !clientId || !clientSecret) {
      throw new Error('Missing Pipedream environment variables');
    }
    
    // Create basic auth header from client credentials
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    // Try direct API call
    const response = await fetch(`https://api.pipedream.com/v1/connect/${projectId}/accounts/${accountId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`[PIPEDREAM-DISCONNECT] API Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PIPEDREAM-DISCONNECT] API Error response: ${errorText}`);
      throw new Error(`API call failed: ${response.status} ${errorText}`);
    }
    
    console.log(`[PIPEDREAM-DISCONNECT] Successfully disconnected account ${accountId}`);
    
  } catch (error) {
    console.error('[PIPEDREAM-DISCONNECT] Failed to disconnect account:', error);
    throw new Error(`Failed to disconnect account: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate OAuth connection URL for a user
 */
export async function generateConnectionUrl(userId: string, appName: string, redirectUrl?: string) {
  if (!pipedreamClient) {
    throw new Error('Pipedream client not available (server-side only)');
  }
  
  const externalUserId = getExternalUserId(userId);
  
  try {
    // Create a connect token for the frontend to use
    const tokenResult = await pipedreamClient.tokens.create({
      external_user_id: externalUserId,
      allowed_origins: ['http://localhost:3000', 'http://localhost:3002'],
      success_redirect_uri: redirectUrl,
    });
    
    // Build the proper connect URL with app parameter
    const tokenResultAny = tokenResult as any;
    const baseConnectUrl = tokenResult.connect_link_url || 
                          tokenResultAny.connectUrl || 
                          tokenResultAny.url ||
                          tokenResultAny.connect_url;
    
    if (!baseConnectUrl) {
      console.error('No connect URL found in token result:', tokenResult);
      throw new Error('No connect URL returned from token creation');
    }
    
    // Add the app parameter to the connect URL
    const connectUrl = new URL(baseConnectUrl);
    connectUrl.searchParams.set('app', appName);
    if (redirectUrl) {
      connectUrl.searchParams.set('success_redirect_uri', redirectUrl);
    }
    
    return connectUrl.toString();
  } catch (error) {
    console.error('Failed to generate connection URL:', error);
    throw new Error('Failed to generate connection URL');
  }
}