import { PipedreamClient } from '@pipedreamhq/platform';

// Ensure this only runs on the server
if (typeof window === 'undefined') {
  if (!process.env.PIPEDREAM_PROJECT_ID) {
    throw new Error('PIPEDREAM_PROJECT_ID environment variable is required');
  }

  if (!process.env.PIPEDREAM_CLIENT_ID) {
    throw new Error('PIPEDREAM_CLIENT_ID environment variable is required');
  }

  if (!process.env.PIPEDREAM_CLIENT_SECRET) {
    throw new Error('PIPEDREAM_CLIENT_SECRET environment variable is required');
  }
}

export const pipedreamClient = typeof window === 'undefined' 
  ? new PipedreamClient({
      projectId: process.env.PIPEDREAM_PROJECT_ID!,
      clientId: process.env.PIPEDREAM_CLIENT_ID!,
      clientSecret: process.env.PIPEDREAM_CLIENT_SECRET!,
      projectEnvironment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    })
  : null;

// Helper function to get external user ID from our user ID
export function getExternalUserId(userId: string): string {
  return `orchastrate_user_${userId}`;
}

// Helper function to get external user ID for an agent (uses owner's ID)
export function getExternalUserIdForAgent(ownerUserId: string): string {
  return getExternalUserId(ownerUserId);
}