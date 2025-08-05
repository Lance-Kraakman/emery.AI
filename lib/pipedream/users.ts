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
    await pipedreamClient.users.delete({ external_user_id: externalUserId });
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
    const accounts = Array.isArray(response) ? response : (response?.data || response?.accounts || []);
    
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
  
  const externalUserId = getExternalUserId(userId);
  
  try {
    // Delete the specific account
    await pipedreamClient.accounts.delete({ 
      external_user_id: externalUserId,
      id: accountId 
    });
  } catch (error) {
    console.error('Failed to disconnect account:', error);
    throw new Error('Failed to disconnect account');
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
    const baseConnectUrl = tokenResult.connect_link_url || 
                          tokenResult.connectUrl || 
                          tokenResult.url ||
                          tokenResult.connect_url;
    
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