// AIDEV-NOTE: Shared database connection string parser
// Handle both connection string and AWS RDS secret JSON formats

interface DatabaseSecret {
  host: string;
  username: string;
  password: string;
  dbname: string;
  port: number;
}

export function parseConnectionString(dbUrl: string): string {
  // Handle null or undefined input
  if (!dbUrl) {
    return dbUrl;
  }
  
  // Check if it's already a proper connection string
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    // Disable SSL for development RDS connections to avoid certificate issues
    if (dbUrl.includes('rds.amazonaws.com') && !dbUrl.includes('sslmode=')) {
      const separator = dbUrl.includes('?') ? '&' : '?';
      return `${dbUrl}${separator}sslmode=disable`;
    }
    return dbUrl;
  }
  
  // Try to parse as JSON (AWS RDS secret format)
  try {
    const secret = JSON.parse(dbUrl) as DatabaseSecret;
    if (secret.host && secret.username && secret.password && secret.dbname) {
      // Default port to 5432 if not provided
      const port = secret.port || 5432;
      let connectionString = `postgresql://${secret.username}:${secret.password}@${secret.host}:${port}/${secret.dbname}`;
      
      // Disable SSL for development to avoid certificate issues
      if (secret.host.includes('rds.amazonaws.com')) {
        connectionString += '?sslmode=disable';
      }
      
      console.log('[DATABASE] Parsed AWS RDS secret into connection string (SSL disabled for dev)');
      return connectionString;
    }
  } catch (e) {
    // Not JSON, might be malformed connection string
  }
  
  // Return as-is and let postgres client handle the error
  return dbUrl;
}