import { execSync } from 'child_process';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function getDatabaseUrl() {
  const secretArn = process.env.DB_SECRET_ARN;
  
  if (!secretArn) {
    throw new Error('DB_SECRET_ARN environment variable is required');
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await secretsClient.send(command);
    
    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    // Parse the RDS secret JSON
    const secret = JSON.parse(response.SecretString);
    const { username, password, engine, host, port, dbname } = secret;
    
    if (!username || !password || !host || !port || !dbname) {
      throw new Error('Secret is missing required database connection fields');
    }

    return `postgresql://${username}:${password}@${host}:${port}/${dbname}`;
  } catch (error) {
    console.error('Failed to retrieve database URL from secrets manager:', error);
    throw error;
  }
}

async function runMigrations() {
  const databaseUrl = await getDatabaseUrl();
  
  console.log("Starting database migration...");
  
  try {
    const output = execSync("pnpm db:migrate", {
      env: { 
        ...process.env, 
        DATABASE_URL: databaseUrl,
        NODE_ENV: process.env.NODE_ENV || "production"
      },
      stdio: "pipe",
      encoding: "utf8",
      cwd: "/var/task"
    });

    console.log("Migration output:", output);
    console.log("✅ Database migrations completed successfully");
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Database migrations completed successfully",
        output: output
      })
    };
  } catch (error) {
    console.error("❌ Migration failed:", error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Database migration failed",
        error: error.message,
        output: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || ''
      })
    };
  }
}

export async function handler(event, context) {
  console.log("## EVENT");
  console.log(JSON.stringify(event, null, 2));
  
  try {
    const result = await runMigrations();
    console.log("Migration result:", result);
    return result;
  } catch (error) {
    console.error("Handler error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Lambda execution failed",
        error: error.message
      })
    };
  }
}