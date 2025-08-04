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
 */
export async function createOrGetPipedreamUser(data: CreatePipedreamUserData): Promise<PipedreamUser> {
  if (!pipedreamClient) {
    throw new Error('Pipedream client not available (server-side only)');
  }
  
  const externalUserId = getExternalUserId(data.userId);
  
  try {
    // Try to get existing user first
    const existingUser = await pipedreamClient.users.get({ external_user_id: externalUserId });
    return existingUser;
  } catch (error) {
    // User doesn't exist, create them
    try {
      const newUser = await pipedreamClient.users.create({
        external_user_id: externalUserId,
        // Include optional metadata
        ...(data.email && { email: data.email }),
        ...(data.name && { name: data.name }),
      });
      return newUser;
    } catch (createError) {
      console.error('Failed to create Pipedream user:', createError);
      throw new Error('Failed to create Pipedream user');
    }
  }
}

/**
 * Delete a Pipedream external user
 */
export async function deletePipedreamUser(userId: string): Promise<void> {
  if (!pipedreamClient) {
    throw new Error('Pipedream client not available (server-side only)');
  }
  
  const externalUserId = getExternalUserId(userId);
  
  try {
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
    const connections = await pipedreamClient.users.getConnections({ external_user_id: externalUserId });
    return connections;
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
    const connectionUrl = await pipedreamClient.users.generateConnectionUrl({
      external_user_id: externalUserId,
      app: appName,
      ...(redirectUrl && { redirect_url: redirectUrl }),
    });
    return connectionUrl;
  } catch (error) {
    console.error('Failed to generate connection URL:', error);
    throw new Error('Failed to generate connection URL');
  }
}