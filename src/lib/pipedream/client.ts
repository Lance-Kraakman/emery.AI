import { PipedreamClient } from '@pipedream/sdk';

// Check if Pipedream is properly configured (server-side only)
const isPipedreamConfigured = typeof window === 'undefined' && 
  process.env.PIPEDREAM_PROJECT_ID && 
  process.env.PIPEDREAM_CLIENT_ID && 
  process.env.PIPEDREAM_CLIENT_SECRET &&
  process.env.PIPEDREAM_PROJECT_ID.trim() !== '' &&
  process.env.PIPEDREAM_CLIENT_ID.trim() !== '' &&
  process.env.PIPEDREAM_CLIENT_SECRET.trim() !== '';

export const pipedreamClient = isPipedreamConfigured
  ? new PipedreamClient({
      projectEnvironment: 'development', // Use development to avoid production plan limits
      clientId: process.env.PIPEDREAM_CLIENT_ID!,
      clientSecret: process.env.PIPEDREAM_CLIENT_SECRET!,
      projectId: process.env.PIPEDREAM_PROJECT_ID!,
    })
  : null;

// Helper function to get external user ID from our user ID
export function getExternalUserId(userId: string): string {
  return `emery_user_${userId}`;
}

// Helper function to get external user ID for an agent (uses owner's ID)
export function getExternalUserIdForAgent(ownerUserId: string): string {
  return getExternalUserId(ownerUserId);
}