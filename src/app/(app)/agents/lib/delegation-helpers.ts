/**
 * Helper functions for OAuth credential delegation UI
 */

import { Mail, MessageSquare, Github, Globe, Link2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Get the appropriate icon for a connection/service
 */
export function getConnectionIcon(appName: string): LucideIcon {
  const lowerAppName = appName.toLowerCase();

  if (lowerAppName.includes('gmail') || lowerAppName.includes('mail')) {
    return Mail;
  }
  if (lowerAppName.includes('slack')) {
    return MessageSquare;
  }
  if (lowerAppName.includes('github')) {
    return Github;
  }
  if (lowerAppName.includes('google') || lowerAppName.includes('drive')) {
    return Globe;
  }

  // Default icon for unknown services
  return Link2;
}

/**
 * Format connection/app name for display
 */
export function formatConnectionName(appName: string): string {
  // Capitalize first letter and handle special cases
  const formatted = appName.charAt(0).toUpperCase() + appName.slice(1).toLowerCase();

  const specialCases: Record<string, string> = {
    'Gmail': 'Gmail',
    'Github': 'GitHub',
    'Slack': 'Slack',
    'Drive': 'Google Drive',
    'Sheets': 'Google Sheets',
    'Docs': 'Google Docs'
  };

  return specialCases[formatted] || formatted;
}

/**
 * Get delegation status info for ConfigurationCard
 */
export function getDelegationStatus(delegatedCount: number): {
  status: 'configured' | 'partial' | 'empty';
  statusText: string;
} {
  if (delegatedCount === 0) {
    return {
      status: 'empty',
      statusText: 'No services'
    };
  }

  if (delegatedCount >= 3) {
    return {
      status: 'configured',
      statusText: `${delegatedCount} services`
    };
  }

  return {
    status: 'partial',
    statusText: `${delegatedCount} service${delegatedCount === 1 ? '' : 's'}`
  };
}

/**
 * Get summary text for delegation card
 */
export function getDelegationSummary(
  delegatedServices: string[],
  totalConnections: number
): string {
  if (delegatedServices.length === 0) {
    return 'No OAuth services delegated';
  }

  if (delegatedServices.length === totalConnections) {
    return `All ${totalConnections} service${totalConnections === 1 ? '' : 's'} authorized`;
  }

  const formatted = delegatedServices
    .slice(0, 2)
    .map(formatConnectionName)
    .join(', ');

  if (delegatedServices.length > 2) {
    return `${formatted} +${delegatedServices.length - 2} more`;
  }

  return formatted;
}
