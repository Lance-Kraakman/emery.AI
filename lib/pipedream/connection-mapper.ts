/**
 * AIDEV-NOTE
 * This file contains the logic for mapping and normalizing raw Pipedream connection data
 * into a consistent format that the application can use. By centralizing this logic,
 * we can easily manage how different services are represented and ensure that the
 * rest of the application works with a standardized connection object.
 */

export interface NormalizedConnection {
  id: string;
  app: string; // The normalized app name (e.g., 'gmail', 'slack')
  account_name: string;
  status: string;
  raw_status?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Normalizes the name of a Pipedream app for consistent tool matching.
 * - Consolidates all Google-related services under a single 'gmail' identifier.
 * - Handles different ways the app name might be structured in the raw data.
 *
 * @param app - The raw app data from Pipedream, which can be a string or an object.
 * @returns The normalized app name as a string.
 */
function getNormalizedAppName(app: any): string {
  let appName = 'unknown';

  if (typeof app === 'string') {
    appName = app;
  } else if (app && typeof app.name === 'string') {
    appName = app.name;
  }

  // Consolidate Google services for unified tool matching
  if (appName === 'google' || appName.startsWith('google_')) {
    return 'gmail';
  }

  return appName;
}

/**
 * Transforms a raw list of Pipedream accounts into a normalized format.
 * This ensures that the application has a consistent and predictable structure
 * for user connections, regardless of the data source.
 *
 * @param accounts - An array of raw account objects from the Pipedream API.
 * @returns An array of normalized connection objects.
 */
export function normalizePipedreamConnections(accounts: any[]): NormalizedConnection[] {
  if (!Array.isArray(accounts)) {
    return [];
  }

  return accounts.map((account: any) => {
    const appName = getNormalizedAppName(account.app);
    
    return {
      id: account.id,
      app: appName,
      account_name: account.account_name || account.name || account.email || account.username || 'Unknown Account',
      status: account.status || 'unknown',
      raw_status: account.status,
      created_at: account.created_at || new Date().toISOString(),
      updated_at: account.updated_at || new Date().toISOString(),
    };
  });
}
