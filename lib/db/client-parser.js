// AIDEV-NOTE: Extracted parseConnectionString for reuse in migration scripts
// Handle both connection string and AWS RDS secret JSON formats
function parseConnectionString(dbUrl) {
  // Check if it's already a proper connection string
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    return dbUrl;
  }
  
  // Try to parse as JSON (AWS RDS secret format)
  try {
    const secret = JSON.parse(dbUrl);
    if (secret.host && secret.username && secret.password && secret.dbname && secret.port) {
      const connectionString = `postgresql://${secret.username}:${secret.password}@${secret.host}:${secret.port}/${secret.dbname}`;
      console.log('[DATABASE] Parsed AWS RDS secret into connection string');
      return connectionString;
    }
  } catch (e) {
    // Not JSON, might be malformed connection string
  }
  
  // Return as-is and let postgres client handle the error
  return dbUrl;
}

module.exports = { parseConnectionString };