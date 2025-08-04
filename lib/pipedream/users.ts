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
    const accounts = await pipedreamClient.accounts.list({ 
      externalUserId: externalUserId 
    });
    
    // Transform accounts to match the expected connection format
    return accounts.map((account: any) => ({
      id: account.id,
      app: account.app,
      account_name: account.name || account.email || account.username,
      status: account.status || 'connected',
      created_at: account.created_at || new Date().toISOString(),
      updated_at: account.updated_at || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Failed to get user connections:', error);
    return [];
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
    const token = await pipedreamClient.tokens.create({
      external_user_id: externalUserId,
      allowed_origins: redirectUrl ? [redirectUrl] : ['http://localhost:3000', 'http://localhost:3002'],
    });
    
    // Return the connect URL that uses this token
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://connect.pipedream.com' 
      : 'https://connect.pipedream.com';
    
    const connectUrl = `${baseUrl}?token=${token.token}&app=${appName}&redirect_uri=${encodeURIComponent(redirectUrl || window?.location?.origin || 'http://localhost:3000')}`;
    
    return connectUrl;
  } catch (error) {
    console.error('Failed to generate connection URL:', error);
    throw new Error('Failed to generate connection URL');
  }
}