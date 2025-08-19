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
  // Check if it's already a proper connection string
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    // Add SSL for RDS connections if not already present
    if (dbUrl.includes('rds.amazonaws.com') && !dbUrl.includes('sslmode=')) {
      const separator = dbUrl.includes('?') ? '&' : '?';
      return `${dbUrl}${separator}sslmode=require&sslcert=&sslkey=&sslrootcert=&sslcrl=`;
    }
    return dbUrl;
  }
  
  // Try to parse as JSON (AWS RDS secret format)
  try {
    const secret = JSON.parse(dbUrl) as DatabaseSecret;
    if (secret.host && secret.username && secret.password && secret.dbname && secret.port) {
      let connectionString = `postgresql://${secret.username}:${secret.password}@${secret.host}:${secret.port}/${secret.dbname}`;
      
      // Add SSL for RDS connections with certificate verification disabled
      if (secret.host.includes('rds.amazonaws.com')) {
        connectionString += '?sslmode=require&sslcert=&sslkey=&sslrootcert=&sslcrl=';
      }
      
      console.log('[DATABASE] Parsed AWS RDS secret into connection string with SSL');
      return connectionString;
    }
  } catch (e) {
    // Not JSON, might be malformed connection string
  }
  
  // Return as-is and let postgres client handle the error
  return dbUrl;
}