import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { execSync } from "child_process";

const secretsManager = new SecretsManagerClient();

async function getDatabaseUrl() {
  const secretArn = process.env.DB_SECRET_ARN;
  const secret = await secretsManager.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const secretString = secret.SecretString;
  
  console.log("Retrieved database secret from AWS Secrets Manager");
  
  // Return the JSON string - our drizzle config will parse it
  return secretString;
}

async function runMigrations() {
  const databaseUrl = await getDatabaseUrl();
  console.log("Starting proper database migration with drizzle-kit...");
  
  try {
    // Run the actual migration command that the main app uses
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
    
    console.log("Migration completed successfully!");
    console.log("Migration output:", output);
    
  } catch (error) {
    console.error("Migration failed:", error.message);
    if (error.stdout) console.error("STDOUT:", error.stdout);
    if (error.stderr) console.error("STDERR:", error.stderr);
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
