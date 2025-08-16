// Database connection retry utility for Docker environments
import postgres from "postgres";

export async function waitForDatabase(connectionString: string, maxRetries = 30, delay = 2000): Promise<void> {
  console.log('[DATABASE] Waiting for database to be ready...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = postgres(connectionString, {
        max: 1,
        connect_timeout: 5,
        idle_timeout: 1,
        ssl: false
      });
      
      await client`SELECT 1`;
      await client.end();
      
      console.log(`[DATABASE] Database ready after ${i + 1} attempts`);
      return;
    } catch (error) {
      console.log(`[DATABASE] Attempt ${i + 1}/${maxRetries} failed:`, (error as Error).message);
      
      if (i === maxRetries - 1) {
        throw new Error(`Database not ready after ${maxRetries} attempts`);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}