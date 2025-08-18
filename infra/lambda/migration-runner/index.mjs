import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { execSync } from "child_process";

const secretsManager = new SecretsManagerClient();

async function getDatabaseUrl() {
  const secretArn = process.env.DB_SECRET_ARN;
  const secret = await secretsManager.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const secretDict = JSON.parse(secret.SecretString);

  const { username, password, host, port, dbname } = secretDict;
  return `postgresql://${username}:${password}@${host}:${port}/${dbname}`;
}

async function runMigrations() {
  const databaseUrl = await getDatabaseUrl();
  console.log("Database URL configured successfully");
  
  // For now, let's just test the connection and create basic tables
  try {
    console.log("Starting migration process...");
    
    // Simple approach: just ensure the basic schema exists
    const { Client } = await import('pg');
    const client = new Client({ connectionString: databaseUrl });
    
    await client.connect();
    console.log("Connected to database successfully");
    
    // Create basic tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT,
        email TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT,
        provider_account_id TEXT,
        access_token TEXT,
        refresh_token TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        expires TIMESTAMP,
        session_token TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await client.end();
    console.log("Basic migration completed successfully");
    
  } catch (error) {
    console.error("Migration failed:", error.message);
    console.error("Stack:", error.stack);
    throw error;
  }
}

export async function handler(event, context) {
  console.log("## EVENT");
  console.log(JSON.stringify(event));

  const requestType = event.RequestType;
  if (requestType === "Create" || requestType === "Update") {
    await runMigrations();
  }

  return { Status: "SUCCESS" };
}
